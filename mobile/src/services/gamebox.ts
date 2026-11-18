// Task 23: gravar e apagar GameBox na coleção `gamebox` (as regras deixam criar, mudar e apagar só ao dono,
// com `userid` igual ao uid). Formato da V2 (lib/gamebox). O número decifrado nunca vai para logs nem
// Crashlytics: só a etiqueta e o código do erro (lib/report).
import { collection, deleteDoc, deleteField, doc, setDoc, updateDoc } from '@react-native-firebase/firestore';
import { toGameboxDoc, type GameboxInput, normalizeGameboxNumber } from '@/lib/gamebox';
import { codeOf, reportCode } from '@/lib/report';
import { db } from '@/services/firebase';

export type GameboxSaveCode = 'OFFLINE' | 'DENIED' | 'INVALID' | 'UNKNOWN';

export class GameboxSaveError extends Error {
  /** `id`: só em OFFLINE por tempo limite numa GameBox nova; repetir com ele (reservedId) não cria outra. */
  constructor(readonly saveCode: GameboxSaveCode, readonly id?: string) {
    super(saveCode);
    this.name = 'GameboxSaveError';
  }
}

/** Sem rede a escrita fica pendente na fila local: passado este tempo conta como offline. */
export const GAMEBOX_SAVE_TIMEOUT_MS = 8000;

const PAVILION_KEYS = ['pavilionPort', 'pavilionSector', 'pavilionLine', 'pavilionSeat'] as const;

function toCode(e: unknown): GameboxSaveCode {
  const code = (codeOf(e) ?? '').replace(/^firestore\//, '');
  if (code === 'unavailable' || code === 'deadline-exceeded') return 'OFFLINE';
  if (code === 'permission-denied') return 'DENIED';
  return 'UNKNOWN';
}

/**
 * `reservedId`: documento novo cuja escrita ficou na fila local. Só se devolve no erro quando o tempo limite
 * expira (a escrita pendente ainda pode chegar ao servidor); um erro do Firestore (DENIED, UNKNOWN, unavailable)
 * quer dizer que a escrita não ficou na fila, e o id não se reutiliza.
 */
async function withTimeout(write: Promise<unknown>, tag: string, reservedId?: string): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      write,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new GameboxSaveError('OFFLINE', reservedId)), GAMEBOX_SAVE_TIMEOUT_MS);
      }),
    ]);
  } catch (e) {
    if (e instanceof GameboxSaveError) throw e;
    const code = toCode(e);
    if (code === 'UNKNOWN') reportCode(tag, e);
    throw new GameboxSaveError(code);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Grava a GameBox. Devolve o id. Rejeita com `GameboxSaveError`.
 * - Existente (`existing`, documento lido do servidor): `updateDoc`, mantém a `order`; sem pavilhão apaga `pavilion*`.
 * - Nova: `setDoc` (criar ou substituir) com o documento completo da V2 e `order` = `newOrder`, num id gerado aqui
 *   ou em `reservedId`. `reservedId` é o id que um erro OFFLINE anterior devolveu: repetir com ele substitui a
 *   escrita pendente em vez de criar outra GameBox. Nunca se faz `updateDoc` num documento que pode não existir.
 */
export async function saveGamebox(
  uid: string,
  input: GameboxInput,
  existing?: { id: string; order: number },
  newOrder = 1,
  reservedId?: string,
): Promise<string> {
  if (!normalizeGameboxNumber(input.number)) throw new GameboxSaveError('INVALID');
  if (existing) {
    const data: Record<string, unknown> = { ...toGameboxDoc(uid, input, existing.order) };
    for (const k of PAVILION_KEYS) if (!(k in data)) data[k] = deleteField();
    await withTimeout(updateDoc(doc(db(), `gamebox/${existing.id}`), data), 'GAMEBOX_SAVE_FAILED');
    return existing.id;
  }
  const ref = reservedId ? doc(db(), `gamebox/${reservedId}`) : doc(collection(db(), 'gamebox'));
  const id = reservedId ?? ref.id;
  await withTimeout(setDoc(ref, toGameboxDoc(uid, input, newOrder)), 'GAMEBOX_SAVE_FAILED', id);
  return id;
}

export async function deleteGamebox(id: string): Promise<void> {
  await withTimeout(deleteDoc(doc(db(), `gamebox/${id}`)), 'GAMEBOX_DELETE_FAILED');
}
