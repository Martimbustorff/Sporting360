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
 * pessoa com este email. Nesse caso a ligação marca o email como verificado, troca a password por
 * uma aleatória (o dono real usa "recuperar password") e revoga as sessões existentes.
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

  if (user.providerData.some((p) => p.providerId === id.provider)) return { linked: false, reason: "ALREADY_LINKED" };
  // A identidade já pertence a outra conta: não a duplicar (o signInWithCredential entra nessa conta).
  try {
    await authAdmin.getUserByProviderUid(id.provider, id.sub);
    return { linked: false, reason: "ALREADY_LINKED" };
  } catch (e) {
    if (errCode(e) !== "auth/user-not-found") throw new HttpsError("internal", "LOOKUP_FAILED");
  }

  const unverified = user.emailVerified === false;
  const hasPassword = user.providerData.some((p) => p.providerId === "password");
  try {
    // Um só pedido: a ligação e a neutralização da password ficam atómicas.
    await authAdmin.updateUser(user.uid, {
      providerToLink: { providerId: id.provider, uid: id.sub, email: id.email },
      ...(unverified ? { emailVerified: true } : {}),
      ...(unverified && hasPassword ? { password: randomBytes(32).toString("base64url") } : {}),
    });
  } catch (e) {
    const c = errCode(e);
    // A identidade já está ligada (corrida, ou ligada a outra conta): o signInWithCredential resolve.
    if (c === "auth/provider-already-linked" || c === "auth/credential-already-in-use" || c === "auth/uid-already-exists") {
      return { linked: false, reason: "ALREADY_LINKED" };
    }
    throw new HttpsError("internal", "LINK_FAILED");
  }

  if (unverified) {
    try {
      await authAdmin.revokeRefreshTokens(user.uid);
    } catch {
      throw new HttpsError("internal", "AUTH_REVOKE_FAILED");
    }
  }
  return { linked: true };
}

export const linkProviderByEmail = onCall({ region: "europe-west1" }, async (req) => {
  return handleLinkProviderByEmail(getAuth(), req.data);
});
