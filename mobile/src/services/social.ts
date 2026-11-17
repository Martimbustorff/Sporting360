// Task 14: login Google e Apple, com ligação automática à conta existente com o mesmo email (callable
// linkProviderByEmail, Task 11). Nunca registar tokens, nonces nem emails.
import * as AppleAuthentication from 'expo-apple-authentication';
import { CryptoDigestAlgorithm, CryptoEncoding, digestStringAsync, getRandomBytes } from 'expo-crypto';
import {
  getAdditionalUserInfo,
  GoogleAuthProvider,
  linkWithCredential,
  OAuthProvider,
  signInWithCredential,
} from '@react-native-firebase/auth';
import { getCrashlytics, recordError } from '@react-native-firebase/crashlytics';
import { doc, getDoc, serverTimestamp, setDoc } from '@react-native-firebase/firestore';
import { httpsCallable } from '@react-native-firebase/functions';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { authErrorMessage } from '@/lib/authErrors';
import { beginSignUp, endSignUp, markProfileEnsured } from '@/lib/profileEnsured';
import { authInstance, db, fns } from '@/services/firebase';
import { ensureProfile } from '@/services/profile';

// Valores da V2 (SCP360_V2-master/src/api/firebase/googleAuth.ts). IDs OAuth públicos, não são segredos.
// Web client: o "client_type 3" do google-services.json, necessário para um ID token que o Firebase aceite.
export const GOOGLE_WEB_CLIENT_ID = '394641993263-m82d9jj7m2do7204davvqo5k1f09epoh.apps.googleusercontent.com';
export const GOOGLE_IOS_CLIENT_ID = '394641993263-84tree10asc01anqldkhog14sbqq1k7b.apps.googleusercontent.com';

/** Spec §9: email Apple oculto (ou qualquer outra razão para não ligar) com conta S360 já existente. */
export const NEEDS_EXISTING_LOGIN_MESSAGE =
  'Já tens conta S360? Entra com o teu método habitual e liga a Apple nas Definições';
/** Variante Google: ligar o Google nas Definições não existe (só a Apple), por isso sem essa parte. */
export const GOOGLE_NEEDS_EXISTING_LOGIN_MESSAGE = 'Já tens conta S360? Entra com o teu método habitual.';
export const APPLE_IN_USE_MESSAGE = 'Esta conta Apple já está ligada a outra conta S360.';

export type SocialResult =
  | { status: 'signedIn' }
  | { status: 'cancelled' }
  | { status: 'needsExistingLogin'; message: string };

type Provider = 'google' | 'apple';
type ProviderToken = { idToken: string; rawNonce?: string; name?: string; email?: string | null };
type LinkResult = { linked: boolean; reason?: string };

const APPLE_CANCELLED = 'ERR_REQUEST_CANCELED';

class Cancelled extends Error {
  constructor() {
    super('CANCELLED');
  }
}

function codeOf(e: unknown): string | undefined {
  return typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : undefined;
}

/** Crashlytics só recebe o código do erro: nunca a mensagem (pode conter email), tokens ou nonces. */
function reportCode(tag: string, e: unknown): void {
  const code = (codeOf(e) ?? 'unknown').replace(/[^\w/.-]/g, '').slice(0, 64) || 'unknown';
  try {
    recordError(getCrashlytics(), new Error(`${tag} ${code}`));
  } catch {
    // nada mais a fazer
  }
}

// ---------- Google ----------

let googleConfigured = false;
function configureGoogle(): void {
  if (googleConfigured) return;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, iosClientId: GOOGLE_IOS_CLIENT_ID, offlineAccess: false });
  googleConfigured = true;
}

async function googleToken(silent: boolean): Promise<ProviderToken> {
  configureGoogle();
  try {
    let res: Awaited<ReturnType<typeof GoogleSignin.signIn>> | Awaited<ReturnType<typeof GoogleSignin.signInSilently>>;
    if (silent) {
      res = await GoogleSignin.signInSilently();
      // Sem credencial guardada: pede outra vez (interativo).
      if (res.type !== 'success') res = await GoogleSignin.signIn();
    } else {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      res = await GoogleSignin.signIn();
    }
    if (res.type !== 'success') throw new Cancelled();
    const { idToken, user } = res.data;
    if (!idToken) throw new Error('GOOGLE_NO_ID_TOKEN');
    return { idToken, name: user.name?.trim() || undefined, email: user.email };
  } catch (e) {
    if (codeOf(e) === statusCodes.SIGN_IN_CANCELLED) throw new Cancelled();
    throw e;
  }
}

// ---------- Apple ----------

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function appleName(fullName: AppleAuthentication.AppleAuthenticationFullName | null): string | undefined {
  if (!fullName) return undefined;
  const name = [fullName.givenName, fullName.familyName].filter((p) => !!p && p.trim()).join(' ').trim();
  return name || undefined;
}

/** rawNonce aleatório (32 bytes); a Apple recebe o SHA-256 em hex, o Firebase e a callable recebem o rawNonce. */
async function appleToken(): Promise<ProviderToken & { rawNonce: string }> {
  const rawNonce = toHex(getRandomBytes(32));
  const nonce = await digestStringAsync(CryptoDigestAlgorithm.SHA256, rawNonce, { encoding: CryptoEncoding.HEX });
  let cred: AppleAuthentication.AppleAuthenticationCredential;
  try {
    cred = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce,
    });
  } catch (e) {
    if (codeOf(e) === APPLE_CANCELLED) throw new Cancelled();
    throw e;
  }
  if (!cred.identityToken) throw new Error('APPLE_NO_ID_TOKEN');
  // fullName e email só chegam na primeira autorização da app.
  // R9 (T16): o authorizationCode serve para revogar o token Apple antes de apagar a conta; não é usado aqui.
  return { idToken: cred.identityToken, rawNonce, name: appleName(cred.fullName), email: cred.email };
}

function appleCredential(tok: ProviderToken) {
  return new OAuthProvider('apple.com').credential({ idToken: tok.idToken, rawNonce: tok.rawNonce });
}

// ---------- fluxo comum ----------

function credentialFor(provider: Provider, tok: ProviderToken) {
  return provider === 'google' ? GoogleAuthProvider.credential(tok.idToken) : appleCredential(tok);
}

type SignInCred = Awaited<ReturnType<typeof signInWithCredential>>;

/**
 * Primeira vez: users/{uid} com { name, email } em merge (sem name se não houver). Paridade com a V2: utilizador
 * existente sem documento users/{uid} também o recebe; com documento, não se toca. R10: garante o perfil.
 */
async function afterSignIn(cred: SignInCred, tok: ProviderToken): Promise<void> {
  const uid = cred.user.uid;
  const ref = doc(db(), `users/${uid}`);
  try {
    const isNew = getAdditionalUserInfo(cred)?.isNewUser === true;
    if (isNew || !(await getDoc(ref)).exists()) {
      const data: Record<string, unknown> = { createdAt: serverTimestamp() };
      if (tok.name) data.name = tok.name;
      const email = cred.user.email ?? tok.email;
      if (email) data.email = email;
      await setDoc(ref, data, { merge: true });
    }
  } catch (e) {
    // A sessão já está aberta: não falhar (o nome cai para o fallback do uid).
    reportCode('SOCIAL_USERS_DOC_FAILED', e);
  }
  await ensureProfile();
  markProfileEnsured(uid);
}

async function linkByEmail(provider: Provider, tok: ProviderToken): Promise<LinkResult> {
  const req: { provider: Provider; idToken: string; rawNonce?: string } = { provider, idToken: tok.idToken };
  if (tok.rawNonce) req.rawNonce = tok.rawNonce;
  const res = await httpsCallable<typeof req, LinkResult>(fns(), 'linkProviderByEmail')(req);
  return res.data;
}

/**
 * Depois de ligar: Google pede um token novo (signInSilently). Apple reutiliza o mesmo identityToken + rawNonce
 * (ainda válido, só saiu do aparelho para o Firebase e para a nossa callable) e só volta a abrir a folha da Apple
 * se o Firebase o recusar com auth/invalid-credential.
 */
async function socialSignIn(
  provider: Provider,
  getToken: (retry: boolean) => Promise<ProviderToken>,
  needsExistingMessage: string,
  reuseTokenAfterLink: boolean,
): Promise<SocialResult> {
  const needsExisting: SocialResult = { status: 'needsExistingLogin', message: needsExistingMessage };
  beginSignUp();
  try {
    let tok = await getToken(false);
    let linkedOnce = false;
    let reusedToken = false;
    for (;;) {
      try {
        const cred = await signInWithCredential(authInstance(), credentialFor(provider, tok));
        await afterSignIn(cred, tok);
        return { status: 'signedIn' };
      } catch (e) {
        const code = codeOf(e);
        if (reusedToken && code === 'auth/invalid-credential') {
          // Uma só vez: token reutilizado recusado → novo pedido (novo nonce).
          reusedToken = false;
          tok = await getToken(true);
          continue;
        }
        if (code !== 'auth/account-exists-with-different-credential') throw e;
        // T11: nunca repetir em ciclo. Depois de uma ligação, um segundo conflito é terminal.
        if (linkedOnce) return needsExisting;
        const link = await linkByEmail(provider, tok);
        if (!link?.linked) return needsExisting;
        linkedOnce = true;
        if (reuseTokenAfterLink) reusedToken = true;
        else tok = await getToken(true);
      }
    }
  } catch (e) {
    if (e instanceof Cancelled) return { status: 'cancelled' };
    reportCode(`SOCIAL_SIGN_IN_FAILED ${provider}`, e);
    throw new Error(authErrorMessage(codeOf(e)));
  } finally {
    endSignUp();
  }
}

export async function signInWithGoogle(): Promise<SocialResult> {
  const result = await socialSignIn('google', googleToken, GOOGLE_NEEDS_EXISTING_LOGIN_MESSAGE, false);
  if (result.status === 'needsExistingLogin') {
    // Deixa escolher outra conta Google na próxima tentativa.
    GoogleSignin.signOut().catch(() => {});
  }
  return result;
}

export function signInWithApple(): Promise<SocialResult> {
  return socialSignIn('apple', () => appleToken(), NEEDS_EXISTING_LOGIN_MESSAGE, true);
}

/** Definições (Plano 4): liga a Apple à conta com sessão aberta. */
export async function linkAppleToCurrentUser(): Promise<'linked' | 'cancelled' | 'inUse'> {
  const user = authInstance().currentUser;
  if (!user) throw new Error(authErrorMessage(undefined));
  let tok: ProviderToken;
  try {
    tok = await appleToken();
  } catch (e) {
    if (e instanceof Cancelled) return 'cancelled';
    throw new Error(authErrorMessage(codeOf(e)));
  }
  try {
    await linkWithCredential(user, appleCredential(tok));
    return 'linked';
  } catch (e) {
    const code = codeOf(e);
    if (code === 'auth/credential-already-in-use') return 'inUse';
    if (code === 'auth/provider-already-linked') return 'linked';
    throw new Error(authErrorMessage(code));
  }
}
