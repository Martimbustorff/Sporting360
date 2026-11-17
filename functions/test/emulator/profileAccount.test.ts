import { initializeApp, getApps, deleteApp } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";
import { handleUpdateProfile } from "../../src/callables/updateProfile";
import { handleDeleteAccount, REAUTH_MAX_AGE_S } from "../../src/callables/deleteAccount";

let db: Firestore;
let authAdmin: Auth;
const NOW = new Date("2026-11-17T12:00:00Z");

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  const app = initializeApp({ projectId: "demo-scp360" }, "profile-account-test");
  db = getFirestore(app);
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
  authAdmin = getAuth(app);
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});
beforeEach(async () => {
  for (const c of ["users", "publicProfiles"]) {
    const snap = await db.collection(c).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  const lbs = await db.collection("leaderboards").listDocuments();
  for (const lb of lbs) await db.recursiveDelete(lb);
});

async function code(p: Promise<unknown>): Promise<{ code: string; message: string }> {
  try {
    await p;
  } catch (e) {
    const x = e as { code: string; message: string };
    return { code: x.code, message: x.message };
  }
  throw new Error("expected rejection");
}

describe("updateProfile", () => {
  it("rejects without a session", async () => {
    const r = await code(handleUpdateProfile(db, undefined, {}, NOW));
    expect(r.code).toBe("unauthenticated");
  });

  it("{} for a V2 user publishes a title-cased name and never an email", async () => {
    await db.doc("users/u1").set({ name: "MARTIM BUSTORFF", email: "m@x.pt" });
    const out = await handleUpdateProfile(db, { uid: "u1" }, {}, NOW);
    expect(out).toEqual({ displayName: "Martim Bustorff", avatarId: null });
    const pub = (await db.doc("publicProfiles/u1").get()).data()!;
    expect(pub.displayName).toBe("Martim Bustorff");
    expect(pub.avatarId).toBeNull();
    expect(pub.updatedAt).toBeDefined();
    expect(JSON.stringify(pub)).not.toContain("@");
    // {} does not write users.displayName
    expect((await db.doc("users/u1").get()).data()!.displayName).toBeUndefined();
  });

  it("{} without a users doc falls back to Sportinguista #xxxx", async () => {
    const out = await handleUpdateProfile(db, { uid: "abcd1234" }, {}, NOW);
    expect(out.displayName).toBe("Sportinguista #1234");
    expect((await db.doc("publicProfiles/abcd1234").get()).data()!.displayName).toBe("Sportinguista #1234");
  });

  it("a new name is saved and propagated to the current period entries only", async () => {
    await db.doc("users/u1").set({ name: "MARTIM BUSTORFF" });
    for (const id of ["week_2026-W47", "month_2026-11", "season_2026-2027", "week_2026-W46"]) {
      await db.doc(`leaderboards/${id}/entries/u1`).set({ uid: "u1", displayName: "Martim Bustorff", points: 5 });
    }
    // current-period board without an entry for u1 must not get one
    await db.doc("leaderboards/month_2026-11/entries/other").set({ uid: "other", displayName: "Outro", points: 1 });

    const out = await handleUpdateProfile(db, { uid: "u1" }, { displayName: "Leão 77" }, NOW);
    expect(out.displayName).toBe("Leão 77");
    expect((await db.doc("users/u1").get()).data()!.displayName).toBe("Leão 77");
    expect((await db.doc("publicProfiles/u1").get()).data()!.displayName).toBe("Leão 77");
    for (const id of ["week_2026-W47", "month_2026-11", "season_2026-2027"]) {
      const e = (await db.doc(`leaderboards/${id}/entries/u1`).get()).data()!;
      expect(e.displayName).toBe("Leão 77");
      expect(e.points).toBe(5);
    }
    expect((await db.doc("leaderboards/week_2026-W46/entries/u1").get()).data()!.displayName).toBe("Martim Bustorff");
    // no new entries elsewhere
    expect((await db.doc("leaderboards/week_2026-W47/entries/other").get()).exists).toBe(false);
    expect((await db.doc("leaderboards/season_2026-2027/entries/other").get()).exists).toBe(false);
    expect((await db.collection("leaderboards/month_2026-11/entries").get()).size).toBe(2);
  });

  it("invalid name -> invalid-argument with the error code as message", async () => {
    const r = await code(handleUpdateProfile(db, { uid: "u1" }, { displayName: "a@b.pt" }, NOW));
    expect(r).toEqual({ code: "invalid-argument", message: "HAS_AT" });
    expect((await db.doc("publicProfiles/u1").get()).exists).toBe(false);
  });

  it("invalid avatar -> INVALID_AVATAR", async () => {
    const r = await code(handleUpdateProfile(db, { uid: "u1" }, { avatarId: "X Y" }, NOW));
    expect(r).toEqual({ code: "invalid-argument", message: "INVALID_AVATAR" });
  });

  it("avatarId is stored, and preserved by later calls without avatarId", async () => {
    await handleUpdateProfile(db, { uid: "u1" }, { avatarId: "leao-1" }, NOW);
    expect((await db.doc("publicProfiles/u1").get()).data()!.avatarId).toBe("leao-1");
    const out = await handleUpdateProfile(db, { uid: "u1" }, {}, NOW);
    expect(out.avatarId).toBe("leao-1");
    await handleUpdateProfile(db, { uid: "u1" }, { displayName: "Leão 77" }, NOW);
    expect((await db.doc("publicProfiles/u1").get()).data()!.avatarId).toBe("leao-1");
    const cleared = await handleUpdateProfile(db, { uid: "u1" }, { avatarId: null }, NOW);
    expect(cleared.avatarId).toBeNull();
  });

  it("legacy name cannot spoof another user's fallback name", async () => {
    await db.doc("users/abcd1234").set({ name: "SPORTINGUISTA #ZZZZ" });
    const out = await handleUpdateProfile(db, { uid: "abcd1234" }, {}, NOW);
    expect(out.displayName).toBe("Sportinguista #1234");
  });

  it("reserved displayName is rejected", async () => {
    const r = await code(handleUpdateProfile(db, { uid: "u1" }, { displayName: "Sportinguista 9" }, NOW));
    expect(r).toEqual({ code: "invalid-argument", message: "RESERVED_NAME" });
  });

  it("rename cooldown: 60 s between displayName changes; avatar-only and {} unaffected", async () => {
    await handleUpdateProfile(db, { uid: "u1" }, { displayName: "Leão 77" }, NOW);
    const later = (ms: number) => new Date(NOW.getTime() + ms);
    const r = await code(handleUpdateProfile(db, { uid: "u1" }, { displayName: "Leão 78" }, later(30_000)));
    expect(r).toEqual({ code: "resource-exhausted", message: "RENAME_COOLDOWN" });
    expect((await db.doc("users/u1").get()).data()!.displayName).toBe("Leão 77");
    await expect(handleUpdateProfile(db, { uid: "u1" }, { avatarId: "leao-1" }, later(30_000))).resolves.toBeDefined();
    await expect(handleUpdateProfile(db, { uid: "u1" }, {}, later(30_000))).resolves.toBeDefined();
    const ok = await handleUpdateProfile(db, { uid: "u1" }, { displayName: "Leão 78" }, later(61_000));
    expect(ok.displayName).toBe("Leão 78");
  });
});

describe("deleteAccount", () => {
  const NOW_S = Math.floor(NOW.getTime() / 1000);
  const authFor = (uid: string, ageS: number) => ({ uid, token: { auth_time: NOW_S - ageS } });
  const OWNED = (u: string) => [
    `users/${u}`,
    `publicProfiles/${u}`,
    `gamebox/gb_${u}`,
    `matchPredictions/m1_${u}`,
    `mvpVotes/m1_${u}`,
    `pointEvents/${u}_m1_exact`,
    `leaderboards/week_2026-W47/entries/${u}`,
    `leaderboards/month_2026-11/entries/${u}`,
    `predictions/p1_${u}`,
    `manofmatch/m1_${u}`,
    `rankings/${u}_2026`,
    `point_events/exact_score_m1_${u}`,
  ];
  const FIELD: Record<string, [string, string]> = {
    gamebox: ["userid", ""],
    matchPredictions: ["userId", ""],
    mvpVotes: ["userId", ""],
    pointEvents: ["uid", ""],
    entries: ["uid", ""],
    predictions: ["userId", ""],
    manofmatch: ["userId", ""],
    rankings: ["userId", ""],
    point_events: ["userId", ""],
  };
  async function seed(u: string) {
    for (const path of OWNED(u)) {
      const col = path.split("/").slice(-2)[0];
      const f = FIELD[col];
      const data: Record<string, unknown> = { n: 1 };
      if (f) data[f[0]] = u;
      if (col === "users") data.email = `${u}@x.pt`;
      await db.doc(path).set(data);
    }
  }
  async function existing(u: string) {
    const out: string[] = [];
    for (const path of OWNED(u)) if ((await db.doc(path).get()).exists) out.push(path);
    return out;
  }
  beforeEach(async () => {
    for (const c of ["gamebox", "matchPredictions", "mvpVotes", "pointEvents", "predictions", "manofmatch", "rankings", "point_events", "settlements"]) {
      const snap = await db.collection(c).get();
      await Promise.all(snap.docs.map((d) => d.ref.delete()));
    }
    for (const u of ["alice", "bob"]) {
      await seed(u);
      try {
        await authAdmin.deleteUser(u);
      } catch {
        /* not there */
      }
      await authAdmin.createUser({ uid: u, email: `${u}@x.pt` });
    }
    await db.doc("settlements/m1").set({ done: true });
  });

  it("REAUTH_MAX_AGE_S is 300", () => expect(REAUTH_MAX_AGE_S).toBe(300));

  it("without a session -> unauthenticated", async () => {
    const r = await code(handleDeleteAccount(db, authAdmin, undefined, NOW_S));
    expect(r.code).toBe("unauthenticated");
  });

  it("login older than 300 s -> REAUTH_REQUIRED and nothing is deleted", async () => {
    const r = await code(handleDeleteAccount(db, authAdmin, authFor("alice", 301), NOW_S));
    expect(r).toEqual({ code: "failed-precondition", message: "REAUTH_REQUIRED" });
    expect(await existing("alice")).toHaveLength(OWNED("alice").length);
    await expect(authAdmin.getUser("alice")).resolves.toBeDefined();
  });

  it("exactly 300 s is still accepted", async () => {
    await expect(handleDeleteAccount(db, authAdmin, authFor("alice", 300), NOW_S)).resolves.toMatchObject({ ok: true });
  });

  it("recent login deletes all of alice's data and her auth user, and leaves bob and settlements", async () => {
    const out = await handleDeleteAccount(db, authAdmin, authFor("alice", 10), NOW_S);
    expect(out).toEqual({ ok: true, deleted: OWNED("alice").length });
    expect(await existing("alice")).toEqual([]);
    expect(await existing("bob")).toHaveLength(OWNED("bob").length);
    expect((await db.doc("settlements/m1").get()).exists).toBe(true);
    expect(await code(authAdmin.getUser("alice"))).toMatchObject({ code: "auth/user-not-found" });
    await expect(authAdmin.getUser("bob")).resolves.toBeDefined();
  });

  it("repeating the call is safe: ok with deleted 0", async () => {
    await handleDeleteAccount(db, authAdmin, authFor("alice", 10), NOW_S);
    const again = await handleDeleteAccount(db, authAdmin, authFor("alice", 10), NOW_S);
    expect(again).toEqual({ ok: true, deleted: 0 });
  });

  it("retry after a half-done deletion (auth user already gone) still succeeds", async () => {
    await authAdmin.deleteUser("alice");
    const out = await handleDeleteAccount(db, authAdmin, authFor("alice", 10), NOW_S);
    expect(out).toEqual({ ok: true, deleted: OWNED("alice").length });
  });
});
