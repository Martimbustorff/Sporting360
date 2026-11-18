// Task 16: apagar a conta (App Store: apagar dentro da app e revogar o token Apple).
// A callable deleteAccount (Plano 3 T10) exige login com menos de 5 min (REAUTH_REQUIRED), revoga os refresh
// tokens e apaga os dados e a conta de Auth. Nunca registar tokens, códigos Apple, emails nem passwords.
import { Platform } from 'react-native';
import { EmailAuthProvider, reauthenticateWithCredential, revokeToken, updatePassword } from '@react-native-firebase/auth';
import { httpsCallable } from '@react-native-firebase/functions';
import { authErrorMessage } from '@/lib/authErrors';
import { codeOf, reportCode } from '@/lib/report';
import { setSignOutNotice } from '@/lib/signOutNotice';
import { signOut } from '@/services/auth';
import { setBiometricEnabled } from '@/services/biometrics';
import { authInstance, fns } from '@/services/firebase';
import { reauthenticateWithApple, reauthenticateWithGoogle } from '@/services/social';

export type ReauthOutcome = 'ok' | 'cancelled';

const GENERIC = authErrorMessage(undefined);

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

export const MIN_PASSWORD_LENGTH = 6;
export const CHANGE_PASSWORD_TEXT = {
  tooShort: 'A nova password tem de ter pelo menos 6 caracteres.',
  wrongCurrent: 'A password atual está incorreta.',
} as const;
const WRONG_CURRENT = new Set(['auth/wrong-password', 'auth/invalid-credential', 'auth/user-mismatch']);

/**
 * Task 26 (Plano 4): mudar a password. Valida a nova (6 ou mais caracteres) antes de qualquer chamada, reautentica com
 * a atual e só depois muda. Erros com mensagem pronta para o ecrã; nunca regista passwords.
 */
export async function changePassword(current: string, next: string): Promise<void> {
  if (next.length < MIN_PASSWORD_LENGTH) throw new Error(CHANGE_PASSWORD_TEXT.tooShort);
  const user = authInstance().currentUser;
  if (!user?.email) throw new Error(GENERIC);
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
  } catch (e) {
    const code = codeOf(e);
    throw new Error(code && WRONG_CURRENT.has(code) ? CHANGE_PASSWORD_TEXT.wrongCurrent : authErrorMessage(code));
  }
  try {
    await updatePassword(user, next);
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
    let apple: Awaited<ReturnType<typeof reauthenticateWithApple>> | undefined;
    try {
      apple = await reauthenticateWithApple();
    } catch (e) {
      // Outro Apple ID (auth/user-mismatch) com password ligada: reautentica com a password e salta a revogação
      // (não há authorizationCode do Apple ID certo). Sem password, mantém o erro.
      if (codeOf(e) !== 'auth/user-mismatch' || !providersOf(user).includes('password')) throw e;
      reportCode('APPLE_REVOKE_SKIPPED', e);
      if ((await reauth()) === 'cancelled') return 'cancelled';
    }
    if (apple?.status === 'cancelled') return 'cancelled';
    if (apple?.status === 'ok') {
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
