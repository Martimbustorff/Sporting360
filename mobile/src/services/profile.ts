import { getCrashlytics, recordError } from '@react-native-firebase/crashlytics';
import { httpsCallable } from '@react-native-firebase/functions';
import { fns } from '@/services/firebase';

/** Garante publicProfiles/{uid} (updateProfile({})). Falhas só vão para o Crashlytics. */
export async function ensureProfile(): Promise<void> {
  try {
    await httpsCallable(fns(), 'updateProfile')({});
  } catch (e) {
    try {
      recordError(getCrashlytics(), e instanceof Error ? e : new Error(String(e)));
    } catch {
      // nada mais a fazer
    }
  }
}
