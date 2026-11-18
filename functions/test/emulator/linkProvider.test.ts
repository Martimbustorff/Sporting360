import { initializeApp, getApps, deleteApp } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { handleLinkProviderByEmail } from "../../src/callables/linkProviderByEmail";
import type { VerifiedIdentity } from "../../src/auth/verifyIdToken";

let authAdmin: Auth;

beforeAll(() => {
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
  const app = initializeApp({ projectId: "demo-scp360" }, "link-provider-test");
  authAdmin = getAuth(app);
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});
beforeEach(async () => {
  const list = await authAdmin.listUsers(1000);
  if (list.users.length) await authAdmin.deleteUsers(list.users.map((u) => u.uid));
  jest.restoreAllMocks();
});

const PASSWORD = "old-password-1";

async function signInWithPassword(email: string, password: string): Promise<boolean> {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const res = await fetch(
    `http://${host}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  return res.ok;
}

function identity(over: Partial<VerifiedIdentity> = {}): VerifiedIdentity {
  return {
    provider: "apple.com",
    sub: "apple-sub-1",
    email: "a@x.pt",
    emailVerified: true,
    isPrivateRelay: false,
    ...over,
  };
}
const stub = (id: VerifiedIdentity) => jest.fn(async () => id);
const APPLE_REQ = { provider: "apple", idToken: "header.payload.sig", rawNonce: "n" };

async function code(p: Promise<unknown>): Promise<{ code: string; message: string }> {
  try {
    await p;
  } catch (e) {
    const x = e as { code: string; message: string };
    return { code: x.code, message: x.message };
  }
  throw new Error("expected rejection");
}

describe("linkProviderByEmail", () => {
  it("links a verified Apple identity to the existing password account", async () => {
    const { uid } = await authAdmin.createUser({ email: "a@x.pt", password: PASSWORD, emailVerified: true });
    const verify = stub(identity());
    await expect(handleLinkProviderByEmail(authAdmin, APPLE_REQ, verify)).resolves.toEqual({ linked: true });
    expect(verify).toHaveBeenCalledWith("apple", "header.payload.sig", "n");
    const u = await authAdmin.getUser(uid);
    const apple = u.providerData.find((p) => p.providerId === "apple.com");
    expect(apple?.uid).toBe("apple-sub-1");
    expect(u.providerData.map((p) => p.providerId)).toContain("password");
  });

  it("links a Google identity (provider google)", async () => {
    const { uid } = await authAdmin.createUser({ email: "g@x.pt", password: PASSWORD, emailVerified: true });
    const verify = stub(identity({ provider: "google.com", sub: "g-sub", email: "g@x.pt" }));
    const out = await handleLinkProviderByEmail(authAdmin, { provider: "google", idToken: "t" }, verify);
    expect(out).toEqual({ linked: true });
    expect(verify).toHaveBeenCalledWith("google", "t", undefined);
    const u = await authAdmin.getUser(uid);
    expect(u.providerData.find((p) => p.providerId === "google.com")?.uid).toBe("g-sub");
  });

  it("linking to a verified account keeps its password and sessions", async () => {
    const { uid } = await authAdmin.createUser({ email: "a@x.pt", password: PASSWORD, emailVerified: true });
    const revoke = jest.spyOn(authAdmin, "revokeRefreshTokens");
    const before = await authAdmin.getUser(uid);
    await handleLinkProviderByEmail(authAdmin, APPLE_REQ, stub(identity()));
    expect(revoke).not.toHaveBeenCalled();
    expect(await signInWithPassword("a@x.pt", PASSWORD)).toBe(true);
    const after = await authAdmin.getUser(uid);
    expect(after.emailVerified).toBe(true);
    expect(after.tokensValidAfterTime).toBe(before.tokensValidAfterTime);
  });

  it("linking to an unverified account verifies it, replaces the password and revokes sessions (pre-hijack)", async () => {
    const { uid } = await authAdmin.createUser({ email: "a@x.pt", password: PASSWORD, emailVerified: false });
    expect(await signInWithPassword("a@x.pt", PASSWORD)).toBe(true);
    const revoke = jest.spyOn(authAdmin, "revokeRefreshTokens");

    await expect(handleLinkProviderByEmail(authAdmin, APPLE_REQ, stub(identity()))).resolves.toEqual({ linked: true });

    const u = await authAdmin.getUser(uid);
    expect(u.emailVerified).toBe(true);
    expect(u.providerData.find((p) => p.providerId === "apple.com")?.uid).toBe("apple-sub-1");
    expect(await signInWithPassword("a@x.pt", PASSWORD)).toBe(false);
    expect(revoke).toHaveBeenCalled();
    for (const call of revoke.mock.calls) expect(call).toEqual([uid]);
  });

  it("unverified account: revokes BEFORE changing it, even when the update fails", async () => {
    const { uid } = await authAdmin.createUser({ email: "a@x.pt", password: PASSWORD, emailVerified: false });
    const revoke = jest.spyOn(authAdmin, "revokeRefreshTokens");
    const update = jest.spyOn(authAdmin, "updateUser").mockRejectedValue(Object.assign(new Error("boom"), { code: "auth/internal-error" }));
    const r = await code(handleLinkProviderByEmail(authAdmin, APPLE_REQ, stub(identity())));
    expect(r.code).toBe("internal");
    expect(revoke).toHaveBeenCalledWith(uid);
    expect(update).toHaveBeenCalled();
    expect(revoke.mock.invocationCallOrder[0]).toBeLessThan(update.mock.invocationCallOrder[0]);
  });

  it("unverified account: attacker's google.com identity and phone are unlinked, Apple is linked", async () => {
    const { uid } = await authAdmin.createUser({
      email: "a@x.pt",
      password: PASSWORD,
      emailVerified: false,
      phoneNumber: "+351910000001",
    });
    await authAdmin.updateUser(uid, { providerToLink: { providerId: "google.com", uid: "atk-google", email: "atk@evil.pt" } });
    expect((await authAdmin.getUser(uid)).providerData.map((p) => p.providerId).sort()).toEqual(["google.com", "password", "phone"]);

    await expect(handleLinkProviderByEmail(authAdmin, APPLE_REQ, stub(identity()))).resolves.toEqual({ linked: true });

    const u = await authAdmin.getUser(uid);
    expect(u.providerData.map((p) => p.providerId).sort()).toEqual(["apple.com", "password"]);
    expect(u.providerData.find((p) => p.providerId === "apple.com")?.uid).toBe("apple-sub-1");
    expect(u.phoneNumber).toBeUndefined();
    await expect(authAdmin.getUserByProviderUid("google.com", "atk-google")).rejects.toMatchObject({ code: "auth/user-not-found" });
  });

  it("unverified account: attacker's apple.com identity is replaced by the victim's", async () => {
    const { uid } = await authAdmin.createUser({ email: "a@x.pt", password: PASSWORD, emailVerified: false });
    await authAdmin.updateUser(uid, { providerToLink: { providerId: "apple.com", uid: "atk-apple", email: "atk@evil.pt" } });

    await expect(handleLinkProviderByEmail(authAdmin, APPLE_REQ, stub(identity()))).resolves.toEqual({ linked: true });

    const u = await authAdmin.getUser(uid);
    const apples = u.providerData.filter((p) => p.providerId === "apple.com");
    expect(apples.map((p) => p.uid)).toEqual(["apple-sub-1"]);
    expect(u.emailVerified).toBe(true);
    expect(await signInWithPassword("a@x.pt", PASSWORD)).toBe(false);
  });

  it("unverified account that already holds this exact identity: still neutralized, ALREADY_LINKED", async () => {
    const { uid } = await authAdmin.createUser({ email: "a@x.pt", password: PASSWORD, emailVerified: false });
    await authAdmin.updateUser(uid, { providerToLink: { providerId: "apple.com", uid: "apple-sub-1", email: "a@x.pt" } });
    await authAdmin.updateUser(uid, { providerToLink: { providerId: "google.com", uid: "atk-google", email: "atk@evil.pt" } });

    await expect(handleLinkProviderByEmail(authAdmin, APPLE_REQ, stub(identity()))).resolves.toEqual({
      linked: false,
      reason: "ALREADY_LINKED",
    });
    const u = await authAdmin.getUser(uid);
    expect(u.providerData.map((p) => p.providerId).sort()).toEqual(["apple.com", "password"]);
    expect(u.providerData.find((p) => p.providerId === "apple.com")?.uid).toBe("apple-sub-1");
    expect(u.emailVerified).toBe(true);
    expect(await signInWithPassword("a@x.pt", PASSWORD)).toBe(false);
  });

  it("verified account with an extra provider: extra provider untouched, Apple added", async () => {
    const { uid } = await authAdmin.createUser({ email: "a@x.pt", password: PASSWORD, emailVerified: true });
    await authAdmin.updateUser(uid, { providerToLink: { providerId: "google.com", uid: "own-google", email: "a2@x.pt" } });
    const revoke = jest.spyOn(authAdmin, "revokeRefreshTokens");

    await expect(handleLinkProviderByEmail(authAdmin, APPLE_REQ, stub(identity()))).resolves.toEqual({ linked: true });

    const u = await authAdmin.getUser(uid);
    expect(u.providerData.map((p) => p.providerId).sort()).toEqual(["apple.com", "google.com", "password"]);
    expect(u.providerData.find((p) => p.providerId === "google.com")?.uid).toBe("own-google");
    expect(revoke).not.toHaveBeenCalled();
    expect(await signInWithPassword("a@x.pt", PASSWORD)).toBe(true);
  });

  it("private relay email -> PRIVATE_RELAY, nothing changes", async () => {
    const { uid } = await authAdmin.createUser({
      email: "xyz@privaterelay.appleid.com",
      password: PASSWORD,
      emailVerified: true,
    });
    const verify = stub(identity({ email: "xyz@privaterelay.appleid.com", isPrivateRelay: true }));
    await expect(handleLinkProviderByEmail(authAdmin, APPLE_REQ, verify)).resolves.toEqual({
      linked: false,
      reason: "PRIVATE_RELAY",
    });
    const u = await authAdmin.getUser(uid);
    expect(u.providerData.map((p) => p.providerId)).toEqual(["password"]);
  });

  it("no account with that email -> NO_ACCOUNT", async () => {
    await authAdmin.createUser({ email: "other@x.pt", password: PASSWORD });
    await expect(handleLinkProviderByEmail(authAdmin, APPLE_REQ, stub(identity()))).resolves.toEqual({
      linked: false,
      reason: "NO_ACCOUNT",
    });
  });

  it("identity email not verified -> EMAIL_NOT_VERIFIED, nothing changes", async () => {
    const { uid } = await authAdmin.createUser({ email: "a@x.pt", password: PASSWORD, emailVerified: true });
    await expect(
      handleLinkProviderByEmail(authAdmin, APPLE_REQ, stub(identity({ emailVerified: false }))),
    ).resolves.toEqual({ linked: false, reason: "EMAIL_NOT_VERIFIED" });
    const u = await authAdmin.getUser(uid);
    expect(u.providerData.map((p) => p.providerId)).toEqual(["password"]);
  });

  it("second call -> ALREADY_LINKED", async () => {
    await authAdmin.createUser({ email: "a@x.pt", password: PASSWORD, emailVerified: true });
    await handleLinkProviderByEmail(authAdmin, APPLE_REQ, stub(identity()));
    await expect(handleLinkProviderByEmail(authAdmin, APPLE_REQ, stub(identity()))).resolves.toEqual({
      linked: false,
      reason: "ALREADY_LINKED",
    });
  });

  it("identity already linked to another account -> ALREADY_LINKED", async () => {
    await authAdmin.createUser({ email: "b@x.pt", password: PASSWORD, emailVerified: true });
    await handleLinkProviderByEmail(authAdmin, APPLE_REQ, stub(identity({ email: "b@x.pt" })));
    await authAdmin.createUser({ email: "a@x.pt", password: PASSWORD, emailVerified: true });
    await expect(handleLinkProviderByEmail(authAdmin, APPLE_REQ, stub(identity()))).resolves.toEqual({
      linked: false,
      reason: "ALREADY_LINKED",
    });
  });

  it("verifier that throws -> unauthenticated without details", async () => {
    await authAdmin.createUser({ email: "a@x.pt", password: PASSWORD, emailVerified: true });
    const verify = jest.fn(async () => {
      throw new Error("Invalid token signature: header.payload.sig a@x.pt");
    });
    const r = await code(handleLinkProviderByEmail(authAdmin, APPLE_REQ, verify));
    expect(r.code).toBe("unauthenticated");
    expect(r.message).not.toContain("header.payload.sig");
    expect(r.message).not.toContain("a@x.pt");
  });

  it.each([
    ["null", null],
    ["string", "x"],
    ["missing provider", { idToken: "t" }],
    ["provider apple.com", { provider: "apple.com", idToken: "t", rawNonce: "n" }],
    ["unknown provider", { provider: "facebook", idToken: "t" }],
    ["missing idToken", { provider: "google" }],
    ["empty idToken", { provider: "google", idToken: "" }],
    ["numeric idToken", { provider: "google", idToken: 1 }],
    ["huge idToken", { provider: "google", idToken: "a".repeat(20_000) }],
    ["numeric rawNonce", { provider: "apple", idToken: "t", rawNonce: 5 }],
  ])("bad request shape (%s) -> invalid-argument, verifier not called", async (_label, data) => {
    const verify = stub(identity());
    const r = await code(handleLinkProviderByEmail(authAdmin, data, verify));
    expect(r.code).toBe("invalid-argument");
    expect(verify).not.toHaveBeenCalled();
  });
});
