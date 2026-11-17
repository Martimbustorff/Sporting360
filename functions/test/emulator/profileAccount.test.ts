import { initializeApp, getApps, deleteApp } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { handleUpdateProfile } from "../../src/callables/updateProfile";

let db: Firestore;
const NOW = new Date("2026-11-17T12:00:00Z");

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  const app = initializeApp({ projectId: "demo-scp360" }, "profile-account-test");
  db = getFirestore(app);
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
});
