import { randomBytes } from "node:crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAuth, type Auth, type UserRecord } from "firebase-admin/auth";
import { verifyIdToken, type VerifiedIdentity } from "../auth/verifyIdToken";

export type LinkProviderRequest = { provider: "apple" | "google"; idToken: string; rawNonce?: string };
export type LinkProviderResult = {
  linked: boolean;
  reason?: "NO_ACCOUNT" | "PRIVATE_RELAY" | "ALREADY_LINKED" | "EMAIL_NOT_VERIFIED";
};
type Verify = (provider: "apple" | "google", idToken: string, rawNonce?: string) => Promise<VerifiedIdentity>;

const MAX_TOKEN_LEN = 8192;
const MAX_NONCE_LEN = 512;

function parseRequest(data: unknown): LinkProviderRequest {
  if (typeof data !== "object" || data === null) throw new HttpsError("invalid-argument", "INVALID_REQUEST");
  const d = data as Record<string, unknown>;
  if (d.provider !== "apple" && d.provider !== "google") throw new HttpsError("invalid-argument", "INVALID_PROVIDER");
  if (typeof d.idToken !== "string" || d.idToken === "" || d.idToken.length > MAX_TOKEN_LEN) {
    throw new HttpsError("invalid-argument", "INVALID_ID_TOKEN");
  }
  if (d.rawNonce !== undefined && (typeof d.rawNonce !== "string" || d.rawNonce.length > MAX_NONCE_LEN)) {
    throw new HttpsError("invalid-argument", "INVALID_NONCE");
  }
  return { provider: d.provider, idToken: d.idToken, rawNonce: d.rawNonce as string | undefined };
}

const errCode = (e: unknown) => (e as { code?: string }).code;

/**
 * Liga uma identidade Apple/Google verificada à conta existente com o mesmo email.
 * Sem sessão obrigatória: quem chama ainda não entrou (o `signInWithCredential` falhou com
 * `account-exists-with-different-credential`). A prova de posse é o próprio ID token.
 *
 * Pre-hijack: se a conta existente tem `emailVerified === false`, pode ter sido criada por outra
 * pessoa com este email. Nesse caso revoga as sessões, desliga todos os outros providers
 * (incluindo telefone e um Apple/Google do mesmo tipo com outro `sub`), marca o email como
 * verificado, troca a password por uma aleatória (o dono real usa "recuperar password"), liga a
 * identidade e revoga de novo.
 *
 * Nunca registar o idToken, o email ou a password gerada.
 */
export async function handleLinkProviderByEmail(
  authAdmin: Auth,
  data: unknown,
  verify: Verify = verifyIdToken,
): Promise<LinkProviderResult> {
  const req = parseRequest(data);

  let id: VerifiedIdentity;
  try {
    id = await verify(req.provider, req.idToken, req.rawNonce);
  } catch {
    throw new HttpsError("unauthenticated", "INVALID_ID_TOKEN");
  }

  if (!id.emailVerified) return { linked: false, reason: "EMAIL_NOT_VERIFIED" };
  // Defensivo: um email relay da Apple nunca coincide com o email real de uma conta existente.
  if (id.isPrivateRelay) return { linked: false, reason: "PRIVATE_RELAY" };

  let user: UserRecord;
  try {
    user = await authAdmin.getUserByEmail(id.email);
  } catch (e) {
    if (errCode(e) === "auth/user-not-found") return { linked: false, reason: "NO_ACCOUNT" };
    throw new HttpsError("internal", "LOOKUP_FAILED");
  }

  // A identidade já pertence a outra conta: não lhe tocar (o signInWithCredential entra nessa conta).
  let owner: UserRecord | undefined;
  try {
    owner = await authAdmin.getUserByProviderUid(id.provider, id.sub);
  } catch (e) {
    if (errCode(e) !== "auth/user-not-found") throw new HttpsError("internal", "LOOKUP_FAILED");
  }
  if (owner && owner.uid !== user.uid) return { linked: false, reason: "ALREADY_LINKED" };

  const link = { providerId: id.provider, uid: id.sub, email: id.email };

  if (user.emailVerified) {
    // Conta verificada: só acrescenta a identidade; password, outros providers e sessões ficam iguais.
    if (user.providerData.some((p) => p.providerId === id.provider)) return { linked: false, reason: "ALREADY_LINKED" };
    return (await linkOrConflict(authAdmin, user.uid, link)) ? { linked: true } : { linked: false, reason: "ALREADY_LINKED" };
  }

  // Conta não verificada (pre-hijack): quem a criou pode não ser o dono do email.
  // 1. Revogar primeiro: se um passo seguinte falhar, o pior caso é um logout inofensivo e um retry
  //    volta a passar por aqui. ID tokens já emitidos continuam válidos até 1 h depois da revogação.
  await revoke(authAdmin, user.uid);
  // 2. Tirar tudo o que o criador possa ter ligado (outro Google/Apple, telefone...), exceto a
  //    password (que é substituída) e esta mesma identidade, marcar verificado e trocar a password.
  const hasThisIdentity = user.providerData.some((p) => p.providerId === id.provider && p.uid === id.sub);
  const toUnlink = [
    ...new Set(
      user.providerData
        .filter((p) => p.providerId !== "password" && !(p.providerId === id.provider && p.uid === id.sub))
        .map((p) => p.providerId),
    ),
  ];
  const hasPassword = user.providerData.some((p) => p.providerId === "password");
  try {
    await authAdmin.updateUser(user.uid, {
      emailVerified: true,
      ...(hasPassword ? { password: randomBytes(32).toString("base64url") } : {}),
      ...(toUnlink.length ? { providersToUnlink: toUnlink } : {}),
    });
  } catch {
    throw new HttpsError("internal", "NEUTRALIZE_FAILED");
  }
  // 3. Ligar a identidade em pedido separado (desligar e ligar o mesmo providerId num só pedido
  //    não tem ordem garantida). Se falhar, a conta já está limpa e verificada: o retry liga-a.
  const linked = !hasThisIdentity && (await linkOrConflict(authAdmin, user.uid, link));
  // 4. Revogar de novo: fecha a janela entre o passo 1 e o passo 2 (login com credenciais antigas).
  await revoke(authAdmin, user.uid);
  return linked ? { linked: true } : { linked: false, reason: "ALREADY_LINKED" };
}

async function revoke(authAdmin: Auth, uid: string): Promise<void> {
  try {
    await authAdmin.revokeRefreshTokens(uid);
  } catch {
    throw new HttpsError("internal", "AUTH_REVOKE_FAILED");
  }
}

/** Liga a identidade; `false` se entretanto ficou ligada (a esta ou a outra conta). */
async function linkOrConflict(
  authAdmin: Auth,
  uid: string,
  link: { providerId: string; uid: string; email: string },
): Promise<boolean> {
  try {
    await authAdmin.updateUser(uid, { providerToLink: link });
    return true;
  } catch (e) {
    const c = errCode(e);
    if (c === "auth/provider-already-linked" || c === "auth/credential-already-in-use" || c === "auth/uid-already-exists") {
      return false;
    }
    throw new HttpsError("internal", "LINK_FAILED");
  }
}

export const linkProviderByEmail = onCall({ region: "europe-west1" }, async (req) => {
  return handleLinkProviderByEmail(getAuth(), req.data);
});
