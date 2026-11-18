// Task 16: apagar a conta (App Store: apagar dentro da app e revogar o token Apple).
// A callable deleteAccount (Plano 3 T10) exige login com menos de 5 min (REAUTH_REQUIRED), revoga os refresh
// tokens e apaga os dados e a conta de Auth. Nunca registar tokens, códigos Apple, emails nem passwords.
import { Platform } from 'react-native';
import { EmailAuthProvider, reauthenticateWithCredential, revokeToken } from '@react-native-firebase/auth';
import { getCrashlytics, recordError } from '@react-native-firebase/crashlytics';
import { httpsCallable } from '@react-native-firebase/functions';
import { authErrorMessage } from '@/lib/authErrors';
import { setSignOutNotice } from '@/lib/signOutNotice';
import { signOut } from '@/services/auth';
import { setBiometricEnabled } from '@/services/biometrics';
import { authInstance, fns } from '@/services/firebase';
import { reauthenticateWithApple, reauthenticateWithGoogle } from '@/services/social';

export type ReauthOutcome = 'ok' | 'cancelled';

const GENERIC = authErrorMessage(undefined);

function codeOf(e: unknown): string | undefined {
  return typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : undefined;
}

/** Crashlytics só recebe o código (nunca a mensagem: pode trazer email). */
function reportCode(tag: string, e: unknown): void {
  const code = (codeOf(e) ?? 'unknown').replace(/[^\w/.-]/g, '').slice(0, 64) || 'unknown';
  try {
    recordError(getCrashlytics(), new Error(`${tag} ${code}`));
  } catch {
    // nada mais a fazer
  }
}

function isReauthRequired(e: unknown): boolean {
  const code = (codeOf(e) ?? '').replace(/^functions\//, '');
  const message = typeof e === 'object' && e !== null ? (e as { message?: unknown }).message : undefined;
  return code === 'failed-precondition' && message === 'REAUTH_REQUIRED';
}

function providersOf(user: { providerData?: ({ providerId?: string } | null)[] } | null): string[] {
  return (user?.providerData ?? []).map((p) => p?.providerId ?? '').filter(Boolean);
}

/** Só no iPhone há pedido Apple (expo-apple-authentication); no Android o revokeToken do RNFB não faz nada. */
const hasAppleFlow = (providers: string[]) => Platform.OS === 'ios' && providers.includes('apple.com');

/** Folha da password: reautentica com o email da sessão. Password errada → mensagem de authErrorMessage. */
export async function reauthenticateWithPassword(password: string): Promise<void> {
  const user = authInstance().currentUser;
  if (!user?.email) throw new Error(GENERIC);
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  } catch (e) {
    throw new Error(authErrorMessage(codeOf(e)));
  }
}

/**
 * Reautenticação pelo provider da sessão: Google (silencioso, sem escrever nada) se ligado; senão password
 * (folha do ecrã, `askPassword`); senão Apple (iPhone). Google com outra conta (auth/user-mismatch) e password
 * ligada → folha da password.
 */
export function providerReauth(askPassword: () => Promise<ReauthOutcome>): () => Promise<ReauthOutcome> {
  return async () => {
    const providers = providersOf(authInstance().currentUser);
    if (providers.includes('google.com')) {
      try {
        return (await reauthenticateWithGoogle()).status;
      } catch (e) {
        // Outra conta Google escolhida: com password ligada, pede a password em vez de falhar.
        if (codeOf(e) === 'auth/user-mismatch' && providers.includes('password')) return askPassword();
        throw e;
      }
    }
    if (providers.includes('password')) return askPassword();
    if (hasAppleFlow(providers)) return (await reauthenticateWithApple()).status;
    throw new Error(GENERIC);
  };
}

/**
 * Apaga a conta. R9: utilizador Apple (iPhone) → reautentica com a Apple e revoga o token SEMPRE antes da primeira
 * chamada (com login recente o servidor não pediria reauth e a revogação ficava por fazer). Revogação falhada
 * (duas tentativas) só vai ao Crashlytics: não impede apagar.
 * REAUTH_REQUIRED → `reauth` e uma só nova tentativa. Outros erros → mensagem genérica, sessão mantém-se.
 * No fim: biometria desligada para o uid (capturado antes), aviso "conta-apagada" e signOut.
 */
export async function deleteMyAccount(reauth: () => Promise<ReauthOutcome>): Promise<'deleted' | 'cancelled'> {
  const user = authInstance().currentUser;
  if (!user) throw new Error(GENERIC);
  const uid = user.uid;

  if (hasAppleFlow(providersOf(user))) {
    const apple = await reauthenticateWithApple();
    if (apple.status === 'cancelled') return 'cancelled';
    // Revogar com uma nova tentativa; se falhar, regista e apaga na mesma (a falha nunca impede apagar a conta).
    try {
      await revokeToken(authInstance(), apple.authorizationCode);
    } catch {
      try {
        await revokeToken(authInstance(), apple.authorizationCode);
      } catch (e) {
        reportCode('APPLE_REVOKE_FAILED', e);
      }
    }
  }

  const call = () => httpsCallable<Record<string, never>, { ok: true; deleted: number }>(fns(), 'deleteAccount')({});
  let needsReauth = false;
  try {
    await call();
  } catch (e) {
    if (!isReauthRequired(e)) {
      reportCode('DELETE_ACCOUNT_FAILED', e);
      throw new Error(GENERIC);
    }
    needsReauth = true;
  }
  if (needsReauth) {
    if ((await reauth()) === 'cancelled') return 'cancelled';
    try {
      await call();
    } catch (e) {
      reportCode('DELETE_ACCOUNT_FAILED', e);
      throw new Error(GENERIC);
    }
  }

  // A conta já não existe: daqui para a frente nada falha para o utilizador. O aviso fica marcado já.
  setSignOutNotice('conta-apagada');
  try {
    await setBiometricEnabled(uid, false);
  } catch {
    // a chave fica órfã no Keychain; inofensivo (uid apagado)
  }
  try {
    await signOut();
  } catch (e) {
    reportCode('DELETE_SIGN_OUT_FAILED', e);
  }
  return 'deleted';
}
