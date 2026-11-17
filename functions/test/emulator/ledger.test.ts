import { initializeApp, getApps, deleteApp } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { awardPoints } from "../../src/points/ledger";

let db: Firestore;
const GAME_DATE = new Date("2026-11-16T20:30:00Z"); // 2026-W47, 2026-11, 2026-2027

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  const app = initializeApp({ projectId: "demo-scp360" }, "ledger-test");
  db = getFirestore(app);
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});
beforeEach(async () => {
  for (const c of ["pointEvents", "users"]) {
    const snap = await db.collection(c).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  const lbs = await db.collection("leaderboards").listDocuments();
  for (const lb of lbs) await db.recursiveDelete(lb);
});

const pts = async (board: string, uid: string): Promise<number | undefined> =>
  (await db.doc(`leaderboards/${board}/entries/${uid}`).get()).data()?.points;
const base = { uid: "alice", gameId: "g1", type: "prediction_exact" as const, points: 3, gameDate: GAME_DATE };

describe("awardPoints", () => {
  it("atribui pontos nos três períodos da data do jogo", async () => {
    await db.doc("users/alice").set({ displayName: "Alice" });
    expect(await awardPoints(db, base)).toBe(true);
    for (const b of ["week_2026-W47", "month_2026-11", "season_2026-2027"]) {
      expect(await pts(b, "alice")).toBe(3);
    }
    const entry = (await db.doc("leaderboards/week_2026-W47/entries/alice").get()).data()!;
    expect(entry.displayName).toBe("Alice");
    expect(entry.uid).toBe("alice");
    const ev = (await db.doc("pointEvents/alice_g1_prediction_exact").get()).data()!;
    expect(ev).toMatchObject({
      uid: "alice", gameId: "g1", type: "prediction_exact", points: 3,
      periods: { week: "2026-W47", month: "2026-11", season: "2026-2027" },
    });
  });

  it("é idempotente: repetir devolve false e os totais ficam em 3", async () => {
    expect(await awardPoints(db, base)).toBe(true);
    expect(await awardPoints(db, base)).toBe(false);
    for (const b of ["week_2026-W47", "month_2026-11", "season_2026-2027"]) {
      expect(await pts(b, "alice")).toBe(3);
    }
  });

  it("concorrência: duas chamadas com o mesmo id dão exatamente um true", async () => {
    const r = await Promise.all([awardPoints(db, base), awardPoints(db, base)]);
    expect(r.filter(Boolean)).toHaveLength(1);
    expect(await pts("week_2026-W47", "alice")).toBe(3);
    expect(await pts("season_2026-2027", "alice")).toBe(3);
  });

  it("periods: ['season'] só altera a época", async () => {
    expect(await awardPoints(db, { ...base, periods: ["season"] })).toBe(true);
    expect(await pts("season_2026-2027", "alice")).toBe(3);
    expect(await pts("week_2026-W47", "alice")).toBeUndefined();
    expect(await pts("month_2026-11", "alice")).toBeUndefined();
    const ev = (await db.doc("pointEvents/alice_g1_prediction_exact").get()).data()!;
    expect(ev.periods).toEqual({ season: "2026-2027" });
  });

  it("tipos diferentes acumulam; gameId null usa 'none'", async () => {
    await awardPoints(db, base);
    await awardPoints(db, { ...base, type: "prediction_participation", points: 1 });
    await awardPoints(db, { ...base, gameId: null, type: "mvp_correct", points: 2 });
    expect(await pts("season_2026-2027", "alice")).toBe(6);
    expect((await db.doc("pointEvents/alice_none_mvp_correct").get()).exists).toBe(true);
  });

  it("sem nome: Sportinguista #xxxx e nenhum doc de leaderboards contém @", async () => {
    await db.doc("users/bob12345").set({ displayName: "bob@example.com", email: "bob@example.com" });
    await awardPoints(db, { ...base, uid: "bob12345" });
    await awardPoints(db, { ...base, uid: "nouser9999" }); // sem doc users
    expect((await db.doc("leaderboards/week_2026-W47/entries/bob12345").get()).data()!.displayName).toBe("Sportinguista #2345");
    expect((await db.doc("leaderboards/week_2026-W47/entries/nouser9999").get()).data()!.displayName).toBe("Sportinguista #9999");
    const all = await db.collectionGroup("entries").get();
    for (const d of all.docs) expect(JSON.stringify(d.data())).not.toContain("@");
  });

  it("renomear propaga no award seguinte", async () => {
    await db.doc("users/alice").set({ displayName: "Alice" });
    await awardPoints(db, base);
    await db.doc("users/alice").set({ displayName: "Alice Nova" });
    await awardPoints(db, { ...base, gameId: "g2" });
    const e = (await db.doc("leaderboards/week_2026-W47/entries/alice").get()).data()!;
    expect(e.displayName).toBe("Alice Nova");
    expect(e.points).toBe(6);
  });

  it("rejeita pontos <= 0 ou não inteiros", async () => {
    await expect(awardPoints(db, { ...base, points: 0 })).rejects.toThrow();
    await expect(awardPoints(db, { ...base, points: -1 })).rejects.toThrow();
    await expect(awardPoints(db, { ...base, points: 1.5 })).rejects.toThrow();
  });
});
