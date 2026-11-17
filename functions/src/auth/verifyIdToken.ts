import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import { OAuth2Client } from "google-auth-library";

/**
 * Verifica ID tokens de Apple e Google emitidos para a app.
 * Qualquer falha lança `IdTokenError` com uma mensagem genérica: as bibliotecas incluem o token
 * nas mensagens de erro, por isso o erro original nunca é propagado nem registado.
 */

export const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
export const APPLE_ISSUER = "https://appleid.apple.com";
export const APPLE_AUDIENCE = "com.scp360";
/** Web client id (Android/web) e iOS client id da V2. */
export const GOOGLE_CLIENT_IDS: readonly string[] = [
  "394641993263-m82d9jj7m2do7204davvqo5k1f09epoh.apps.googleusercontent.com",
  "394641993263-84tree10asc01anqldkhog14sbqq1k7b.apps.googleusercontent.com",
];
const PRIVATE_RELAY_DOMAIN = "@privaterelay.appleid.com";

export type VerifiedIdentity = {
  provider: "apple.com" | "google.com";
  sub: string;
  email: string;
  emailVerified: boolean;
  isPrivateRelay: boolean;
};

export type VerifyDeps = {
  appleJwks?: JWTVerifyGetKey;
  googleClient?: Pick<OAuth2Client, "verifyIdToken">;
};

export class IdTokenError extends Error {
  constructor(reason: string) {
    super(`ID_TOKEN_INVALID: ${reason}`);
    this.name = "IdTokenError";
  }
}

let defaultAppleJwks: JWTVerifyGetKey | undefined;
let defaultGoogleClient: OAuth2Client | undefined;

const sha256hex = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

function identityFrom(provider: VerifiedIdentity["provider"], p: JWTPayload, emailVerified: boolean): VerifiedIdentity {
  const email = p.email;
  if (typeof p.sub !== "string" || p.sub === "") throw new IdTokenError("sub");
  if (typeof email !== "string" || email === "") throw new IdTokenError("email");
  return {
    provider,
    sub: p.sub,
    email,
    emailVerified,
    isPrivateRelay: email.toLowerCase().endsWith(PRIVATE_RELAY_DOMAIN),
  };
}

async function verifyApple(idToken: string, rawNonce: string | undefined, jwks: JWTVerifyGetKey): Promise<VerifiedIdentity> {
  if (typeof rawNonce !== "string" || rawNonce === "") throw new IdTokenError("nonce");
  let payload: JWTPayload;
  try {
    // jwtVerify valida assinatura, iss, aud e exp/nbf.
    ({ payload } = await jwtVerify(idToken, jwks, {
      issuer: APPLE_ISSUER,
      audience: APPLE_AUDIENCE,
      algorithms: ["RS256"],
    }));
  } catch {
    throw new IdTokenError("apple");
  }
  if (typeof payload.nonce !== "string" || payload.nonce !== sha256hex(rawNonce)) throw new IdTokenError("nonce");
  // A Apple envia email_verified como string ("true") ou boolean.
  const ev = payload.email_verified;
  return identityFrom("apple.com", payload, ev === true || ev === "true");
}

async function verifyGoogle(idToken: string, client: Pick<OAuth2Client, "verifyIdToken">): Promise<VerifiedIdentity> {
  let payload: JWTPayload | undefined;
  try {
    // verifyIdToken valida assinatura, iss (accounts.google.com), aud e exp.
    const ticket = await client.verifyIdToken({ idToken, audience: [...GOOGLE_CLIENT_IDS] });
    payload = ticket.getPayload() as JWTPayload | undefined;
  } catch {
    throw new IdTokenError("google");
  }
  if (!payload) throw new IdTokenError("google");
  return identityFrom("google.com", payload, payload.email_verified === true);
}

export async function verifyIdToken(
  provider: "apple" | "google",
  idToken: string,
  rawNonce?: string,
  deps: VerifyDeps = {},
): Promise<VerifiedIdentity> {
  if (typeof idToken !== "string" || idToken === "") throw new IdTokenError("token");
  if (provider === "apple") {
    const jwks = deps.appleJwks ?? (defaultAppleJwks ??= createRemoteJWKSet(new URL(APPLE_JWKS_URL)));
    return verifyApple(idToken, rawNonce, jwks);
  }
  if (provider === "google") {
    const client = deps.googleClient ?? (defaultGoogleClient ??= new OAuth2Client());
    return verifyGoogle(idToken, client);
  }
  throw new IdTokenError("provider");
}
