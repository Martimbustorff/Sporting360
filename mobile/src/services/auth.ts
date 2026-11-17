import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from '@react-native-firebase/auth';
import { getCrashlytics, recordError } from '@react-native-firebase/crashlytics';
import { doc, serverTimestamp, setDoc } from '@react-native-firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { authErrorMessage } from '@/lib/authErrors';
import { beginSignUp, endSignUp, markProfileEnsured } from '@/lib/profileEnsured';
import { authInstance, db } from '@/services/firebase';
import { ensureProfile } from '@/services/profile';

function codeOf(e: unknown): string | undefined {
  return typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : undefined;
}

function fail(e: unknown): never {
  throw new Error(authErrorMessage(codeOf(e)));
}

export async function signInEmail(email: string, password: string): Promise<void> {
  try {
    await signInWithEmailAndPassword(authInstance(), email.trim(), password);
  } catch (e) {
    fail(e);
  }
}

export async function signUpEmail(name: string, email: string, password: string): Promise<void> {
  beginSignUp();
  try {
    const cred = await createUserWithEmailAndPassword(authInstance(), email.trim(), password);
    const uid = cred.user.uid;
    // users/{uid}: perfil privado (inclui email, nunca mostrado em público). Sem displayName (R22).
    try {
      await setDoc(
        doc(db(), `users/${uid}`),
        { name: name.trim(), email: email.trim(), createdAt: serverTimestamp() },
        { merge: true },
      );
    } catch (e) {
      // A conta já existe e a sessão está aberta: não falhar. O nome cai para o fallback do uid.
      try {
        recordError(getCrashlytics(), e instanceof Error ? e : new Error(String(e)));
      } catch {
        // nada mais a fazer
      }
    }
    await ensureProfile();
    markProfileEnsured(uid);
  } catch (e) {
    fail(e);
  } finally {
    endSignUp();
  }
}

/** R18: nunca revela se o email existe. */
export async function sendReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(authInstance(), email.trim());
  } catch (e) {
    if (codeOf(e) === 'auth/user-not-found') return;
    fail(e);
  }
}

export async function signOut(): Promise<void> {
  const user = authInstance().currentUser;
  const hasGoogle = !!user?.providerData?.some((p) => p?.providerId === 'google.com');
  if (hasGoogle) {
    try {
      await GoogleSignin.signOut();
    } catch {
      // a sessão Firebase termina na mesma
    }
  }
  await fbSignOut(authInstance());
}
