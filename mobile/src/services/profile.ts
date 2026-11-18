import { httpsCallable } from '@react-native-firebase/functions';
import { reportCode } from '@/lib/report';
import { fns } from '@/services/firebase';

/** Garante publicProfiles/{uid} (updateProfile({})). Falhas só vão para o Crashlytics. */
export async function ensureProfile(): Promise<void> {
  try {
    await httpsCallable(fns(), 'updateProfile')({});
  } catch (e) {
    reportCode('ENSURE_PROFILE_FAILED', e);
  }
}

/**
 * Task 16: grava o nome público (callable updateProfile; avatarId ausente fica como está no servidor).
 * Devolve o nome gravado pelo servidor. Erros passam tal como vêm (displayNameErrorMessage traduz o código).
 */
export async function updateDisplayName(name: string): Promise<string> {
  const res = await httpsCallable<{ displayName: string }, { displayName: string; avatarId: string | null }>(
    fns(),
    'updateProfile',
  )({ displayName: name });
  return res.data.displayName;
}
