// Task 22: gravação dos campos privados do próprio em users/{uid} (as regras do Firestore deixam ao dono tudo
// menos displayName e nameChangedAt; o nome público muda pela callable updateProfile, ver services/profile.ts).
import { doc, setDoc } from '@react-native-firebase/firestore';
import { PROFILE_PATCH_KEYS, type ProfilePatch } from '@/lib/profileFields';
import { codeOf, reportCode } from '@/lib/report';
import { db } from '@/services/firebase';

export type ProfileSaveCode = 'OFFLINE' | 'DENIED' | 'UNKNOWN';

export class ProfileSaveError extends Error {
  constructor(readonly saveCode: ProfileSaveCode) {
    super(saveCode);
    this.name = 'ProfileSaveError';
  }
}

/** Sem rede o setDoc do Firestore fica pendente (a escrita fica na fila local): passado este tempo conta como offline. */
export const SAVE_TIMEOUT_MS = 8000;

const ALLOWED: ReadonlySet<string> = new Set(PROFILE_PATCH_KEYS);

function toCode(e: unknown): ProfileSaveCode {
  const code = (codeOf(e) ?? '').replace(/^firestore\//, '');
  if (code === 'unavailable' || code === 'deadline-exceeded') return 'OFFLINE';
  if (code === 'permission-denied') return 'DENIED';
  return 'UNKNOWN';
}

/**
 * Grava só as chaves de `ProfilePatch` (merge). Recusa qualquer outra chave sem escrever nada.
 * Rejeita com `ProfileSaveError`; OFFLINE nunca vai ao Crashlytics.
 */
export async function updateMyProfileFields(uid: string, patch: ProfilePatch): Promise<void> {
  const keys = Object.keys(patch);
  const bad = keys.filter((k) => !ALLOWED.has(k));
  if (bad.length > 0) throw new Error(`Campos não permitidos: ${bad.join(', ')}`);
  if (keys.length === 0) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      setDoc(doc(db(), `users/${uid}`), patch, { merge: true }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ProfileSaveError('OFFLINE')), SAVE_TIMEOUT_MS);
      }),
    ]);
  } catch (e) {
    if (e instanceof ProfileSaveError) throw e;
    const code = toCode(e);
    if (code === 'UNKNOWN') reportCode('PROFILE_FIELDS_SAVE_FAILED', e);
    throw new ProfileSaveError(code);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
