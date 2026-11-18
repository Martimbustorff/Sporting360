// Task 23: gravar e apagar GameBox na coleção `gamebox` (as regras deixam criar, mudar e apagar só ao dono,
// com `userid` igual ao uid). Formato da V2 (lib/gamebox). O número decifrado nunca vai para logs nem
// Crashlytics: só a etiqueta e o código do erro (lib/report).
import { collection, deleteDoc, deleteField, doc, setDoc, updateDoc } from '@react-native-firebase/firestore';
import { toGameboxDoc, type GameboxInput, normalizeGameboxNumber } from '@/lib/gamebox';
import { codeOf, reportCode } from '@/lib/report';
import { db } from '@/services/firebase';

export type GameboxSaveCode = 'OFFLINE' | 'DENIED' | 'INVALID' | 'UNKNOWN';

export class GameboxSaveError extends Error {
  /** `id`: documento da GameBox nova já reservado; repetir com ele não cria outra. */
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

async function withTimeout(write: Promise<unknown>, tag: string, id?: string): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      write,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new GameboxSaveError('OFFLINE', id)), GAMEBOX_SAVE_TIMEOUT_MS);
      }),
    ]);
  } catch (e) {
    if (e instanceof GameboxSaveError) throw e;
    const code = toCode(e);
    if (code === 'UNKNOWN') reportCode(tag, e);
    throw new GameboxSaveError(code, id);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Grava a GameBox. Nova (sem `existing`): documento com id gerado já aqui e `order` = `newOrder`.
 * Existente: atualiza o documento mantendo a `order`; sem pavilhão apaga os campos `pavilion*`.
 * Devolve o id. Rejeita com `GameboxSaveError`.
 */
export async function saveGamebox(
  uid: string,
  input: GameboxInput,
  existing?: { id: string; order: number },
  newOrder = 1,
): Promise<string> {
  if (!normalizeGameboxNumber(input.number)) throw new GameboxSaveError('INVALID', existing?.id);
  if (existing) {
    const data: Record<string, unknown> = { ...toGameboxDoc(uid, input, existing.order) };
    for (const k of PAVILION_KEYS) if (!(k in data)) data[k] = deleteField();
    await withTimeout(updateDoc(doc(db(), `gamebox/${existing.id}`), data), 'GAMEBOX_SAVE_FAILED', existing.id);
    return existing.id;
  }
  const ref = doc(collection(db(), 'gamebox'));
  await withTimeout(setDoc(ref, toGameboxDoc(uid, input, newOrder)), 'GAMEBOX_SAVE_FAILED', ref.id);
  return ref.id;
}

export async function deleteGamebox(id: string): Promise<void> {
  await withTimeout(deleteDoc(doc(db(), `gamebox/${id}`)), 'GAMEBOX_DELETE_FAILED');
}
