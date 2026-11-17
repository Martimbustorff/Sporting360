import { createHash } from "node:crypto";
import { SignJWT, generateKeyPair, exportJWK, exportSPKI, createLocalJWKSet, type JWTVerifyGetKey } from "jose";
import { OAuth2Client } from "google-auth-library";
import {
  verifyIdToken,
  APPLE_AUDIENCE,
  APPLE_ISSUER,
  APPLE_JWKS_URL,
  GOOGLE_CLIENT_IDS,
} from "../../src/auth/verifyIdToken";

const sha256hex = (s: string) => createHash("sha256").update(s).digest("hex");
const nowS = () => Math.floor(Date.now() / 1000);

const WEB_ID = "394641993263-m82d9jj7m2do7204davvqo5k1f09epoh.apps.googleusercontent.com";
const IOS_ID = "394641993263-84tree10asc01anqldkhog14sbqq1k7b.apps.googleusercontent.com";

type Keys = Awaited<ReturnType<typeof generateKeyPair>>;
let appleKeys: Keys;
let otherKeys: Keys;
let appleJwks: JWTVerifyGetKey;
let googleKeys: Keys;
let googleClient: OAuth2Client;

beforeAll(async () => {
  appleKeys = await generateKeyPair("RS256");
  otherKeys = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(appleKeys.publicKey)), kid: "apple-k1", alg: "RS256", use: "sig" };
  appleJwks = createLocalJWKSet({ keys: [jwk] });

  googleKeys = await generateKeyPair("RS256");
  const pem = await exportSPKI(googleKeys.publicKey);
  googleClient = new OAuth2Client();
  jest
    .spyOn(googleClient, "getFederatedSignonCertsAsync")
    .mockResolvedValue({ certs: { "google-k1": pem }, format: "PEM" } as never);
});

const RAW_NONCE = "raw-nonce-123";

async function appleToken(
  over: Record<string, unknown> = {},
  opts: { key?: Keys; kid?: string; exp?: number; iat?: number } = {},
): Promise<string> {
  const iat = opts.iat ?? nowS();
  return new SignJWT({
    email: "a@x.pt",
    email_verified: "true",
    nonce: sha256hex(RAW_NONCE),
    ...over,
  })
    .setProtectedHeader({ alg: "RS256", kid: opts.kid ?? "apple-k1" })
    .setIssuer((over.iss as string) ?? APPLE_ISSUER)
    .setAudience((over.aud as string) ?? APPLE_AUDIENCE)
    .setSubject("apple-sub-1")
    .setIssuedAt(iat)
    .setExpirationTime(opts.exp ?? iat + 600)
    .sign((opts.key ?? appleKeys).privateKey);
}

async function googleToken(over: Record<string, unknown> = {}, opts: { exp?: number; iat?: number } = {}): Promise<string> {
  const iat = opts.iat ?? nowS();
  return new SignJWT({ email: "g@x.pt", email_verified: true, ...over })
    .setProtectedHeader({ alg: "RS256", kid: "google-k1" })
    .setIssuer((over.iss as string) ?? "https://accounts.google.com")
    .setAudience((over.aud as string) ?? WEB_ID)
    .setSubject("google-sub-1")
    .setIssuedAt(iat)
    .setExpirationTime(opts.exp ?? iat + 600)
    .sign(googleKeys.privateKey);
}

// Pass `null` to omit the rawNonce (a default parameter would replace `undefined`).
const apple = (t: string, nonce: string | null = RAW_NONCE) =>
  verifyIdToken("apple", t, nonce ?? undefined, { appleJwks });
const google = (t: string) => verifyIdToken("google", t, undefined, { googleClient });

describe("constants", () => {
  it("match the requirements", () => {
    expect(APPLE_JWKS_URL).toBe("https://appleid.apple.com/auth/keys");
    expect(APPLE_ISSUER).toBe("https://appleid.apple.com");
    expect(APPLE_AUDIENCE).toBe("com.scp360");
    expect([...GOOGLE_CLIENT_IDS].sort()).toEqual([IOS_ID, WEB_ID].sort());
  });
});

describe("verifyIdToken('apple')", () => {
  it("accepts a valid token with the right nonce", async () => {
    await expect(apple(await appleToken())).resolves.toEqual({
      provider: "apple.com",
      sub: "apple-sub-1",
      email: "a@x.pt",
      emailVerified: true,
      isPrivateRelay: false,
    });
  });

  it("accepts email_verified as a boolean and reports false values", async () => {
    expect((await apple(await appleToken({ email_verified: true }))).emailVerified).toBe(true);
    expect((await apple(await appleToken({ email_verified: "false" }))).emailVerified).toBe(false);
    expect((await apple(await appleToken({ email_verified: false }))).emailVerified).toBe(false);
    expect((await apple(await appleToken({ email_verified: undefined }))).emailVerified).toBe(false);
  });

  it("flags private relay emails", async () => {
    const id = await apple(await appleToken({ email: "xyz@privaterelay.appleid.com" }));
    expect(id.isPrivateRelay).toBe(true);
  });

  it("rejects the wrong audience", async () => {
    await expect(apple(await appleToken({ aud: "com.other" }))).rejects.toThrow();
  });

  it("rejects the wrong issuer", async () => {
    await expect(apple(await appleToken({ iss: "https://evil.example" }))).rejects.toThrow();
  });

  it("rejects the wrong nonce", async () => {
    await expect(apple(await appleToken(), "another-nonce")).rejects.toThrow();
  });

  it("rejects a nonce equal to the raw value (must be its sha256)", async () => {
    await expect(apple(await appleToken({ nonce: RAW_NONCE }))).rejects.toThrow();
  });

  it("rejects a missing rawNonce", async () => {
    await expect(apple(await appleToken(), null)).rejects.toThrow();
    await expect(apple(await appleToken(), "")).rejects.toThrow();
  });

  it("rejects a token without a nonce claim", async () => {
    await expect(apple(await appleToken({ nonce: undefined }))).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    const iat = nowS() - 3600;
    await expect(apple(await appleToken({}, { iat, exp: iat + 600 }))).rejects.toThrow();
  });

  it("rejects a token signed by another key", async () => {
    await expect(apple(await appleToken({}, { key: otherKeys }))).rejects.toThrow();
  });

  it("rejects a token without an email", async () => {
    await expect(apple(await appleToken({ email: undefined }))).rejects.toThrow();
  });

  it("rejects garbage", async () => {
    await expect(apple("not-a-jwt")).rejects.toThrow();
  });
});

describe("verifyIdToken('google')", () => {
  it("accepts the web client id", async () => {
    await expect(google(await googleToken())).resolves.toEqual({
      provider: "google.com",
      sub: "google-sub-1",
      email: "g@x.pt",
      emailVerified: true,
      isPrivateRelay: false,
    });
  });

  it("accepts the iOS client id", async () => {
    expect((await google(await googleToken({ aud: IOS_ID }))).sub).toBe("google-sub-1");
  });

  it("rejects another audience", async () => {
    await expect(google(await googleToken({ aud: "123-other.apps.googleusercontent.com" }))).rejects.toThrow();
  });

  it("rejects another issuer", async () => {
    await expect(google(await googleToken({ iss: "https://evil.example" }))).rejects.toThrow();
  });

  it("reports email_verified false (only a boolean true counts)", async () => {
    expect((await google(await googleToken({ email_verified: false }))).emailVerified).toBe(false);
    expect((await google(await googleToken({ email_verified: "true" }))).emailVerified).toBe(false);
  });

  it("rejects an expired token", async () => {
    await expect(google(await googleToken({}, { iat: nowS() - 7200, exp: nowS() - 3600 }))).rejects.toThrow();
  });

  it("rejects a token without an email", async () => {
    await expect(google(await googleToken({ email: undefined }))).rejects.toThrow();
  });

  it("rejected errors never carry the token", async () => {
    const t = await googleToken({ aud: "123-other.apps.googleusercontent.com" });
    const err = await google(t).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect(String((err as Error).message)).not.toContain(t);
    const t2 = await appleToken({ aud: "com.other" });
    const err2 = await apple(t2).catch((e: Error) => e);
    expect(String((err2 as Error).message)).not.toContain(t2);
  });
});
