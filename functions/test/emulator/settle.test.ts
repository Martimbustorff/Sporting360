import { initializeApp, getApps, deleteApp } from "firebase-admin/app";
import { getFirestore, Firestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { settleDue, settleGame } from "../../src/scheduled/settle";
import { awardPoints } from "../../src/points/ledger";

let db: Firestore;
const MIN = 60_000;
const NOW = new Date("2026-11-17T23:00:00Z");
const KICKOFF = new Date(NOW.getTime() - 5 * 60 * MIN); // 18:00Z
const SEASON = "season_2026-2027";

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  const app = initializeApp({ projectId: "demo-scp360" }, "settle-test");
  db = getFirestore(app);
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});
beforeEach(async () => {
  for (const c of ["games", "players", "predictions", "matchPredictions", "mvpVotes", "pointEvents", "users", "settlements"]) {
    const snap = await db.collection(c).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  const lbs = await db.collection("leaderboards").listDocuments();
  for (const lb of lbs) await db.recursiveDelete(lb);
});

async function seedGame(over: Record<string, unknown> = {}, id = "m1", finishedMinAgo = 180) {
  await db.collection("games").doc(`doc_${id}`).set({
    api: id,
    startTime: KICKOFF.toISOString(),
    timestamp: Timestamp.fromDate(KICKOFF),
    status: "FT",
    finishedAt: new Date(NOW.getTime() - finishedMinAgo * MIN).toISOString(),
    scorehome: "2",
    scoreaway: "1",
    isActive: false,
    teamhome: { api: 228, name: "Sporting CP", logo: "x" },
    teamaway: { api: 211, name: "Benfica", logo: "x" },
    ...over,
  });
}
/** Prognóstico v2027 como a callable o escreve (com a participação já atribuída). */
async function seedPrediction(uid: string, home: number, away: number, gameId = "m1", participation = true) {
  await db.doc(`matchPredictions/${gameId}_${uid}`).set({
    gameId, userId: uid, home, away, createdAt: Timestamp.fromDate(KICKOFF), source: "v2027",
  });
  if (participation) {
    await awardPoints(db, { uid, gameId, type: "prediction_participation", points: 1, gameDate: KICKOFF });
  }
}
async function seedVote(uid: string, playerId: number, gameId = "m1", participation = true) {
  await db.doc(`mvpVotes/${gameId}_${uid}`).set({
    gameId, userId: uid, playerId: String(playerId), createdAt: Timestamp.fromDate(KICKOFF), source: "v2027",
  });
  if (participation) {
    await awardPoints(db, { uid, gameId, type: "mvp_participation", points: 1, gameDate: KICKOFF });
  }
}
async function seedPlayers(gameId = "m1") {
  await db.collection("players").doc(`228_${gameId}`).set({
    GameId: gameId, teamId: 228,
    Players: [
      { playerId: 10, name: "Gyokeres", rating: "8.05", minutes: 90 },
      { playerId: 11, name: "Trincão", rating: "7.2", minutes: 90 },
    ],
  });
}
const total = async (uid: string): Promise<number | undefined> =>
  (await db.doc(`leaderboards/${SEASON}/entries/${uid}`).get()).data()?.points;

describe("settleDue", () => {
  it("FT 2-1: prognósticos 2-1, 1-0 e 0-0 ficam com 4, 2 e 1 na época", async () => {
    await seedGame();
    await seedPlayers();
    await seedPrediction("exact", 2, 1);
    await seedPrediction("outc", 1, 0);
    await seedPrediction("wrong", 0, 0);
    expect(await settleDue(db, NOW)).toBe(1);
    expect(await total("exact")).toBe(4);
    expect(await total("outc")).toBe(2);
    expect(await total("wrong")).toBe(1);
    const s = (await db.doc("settlements/m1").get()).data()!;
    expect(s).toMatchObject({ finalHome: 2, finalAway: 1, officialMvp: ["10"] });
    expect(s.settledAt).toBeDefined();
  });

  it("PEN com golos 1-1 e prognóstico 1-1 → bónus 3", async () => {
    await seedGame({ status: "PEN", scorehome: "1", scoreaway: "1" });
    await seedPlayers();
    await seedPrediction("a", 1, 1);
    await settleDue(db, NOW);
    expect(await total("a")).toBe(4);
    expect((await db.doc("pointEvents/a_m1_prediction_exact").get()).data()?.points).toBe(3);
  });

  it("jogo terminado há 1h59 não é liquidado", async () => {
    await seedGame({}, "m1", 119);
    await seedPrediction("a", 2, 1);
    expect(await settleDue(db, NOW)).toBe(0);
    expect(await total("a")).toBe(1);
    expect((await db.doc("settlements/m1").get()).exists).toBe(false);
  });

  it("corrido duas vezes: totais iguais e settlements existe", async () => {
    await seedGame();
    await seedPlayers();
    await seedPrediction("a", 2, 1);
    await seedVote("a", 10);
    expect(await settleDue(db, NOW)).toBe(1);
    const first = await total("a");
    expect(first).toBe(1 + 3 + 1 + 2);
    expect(await settleDue(db, NOW)).toBe(0);
    expect(await total("a")).toBe(first);
    expect((await db.doc("settlements/m1").get()).exists).toBe(true);
    // forçar nova liquidação direta também é idempotente
    await settleGame(db, "m1", NOW);
    expect(await total("a")).toBe(first);
  });

  it("MVP oficial rating 8.05: quem votou nele fica com 3, os outros com 1", async () => {
    await seedGame();
    await seedPlayers();
    await seedVote("right", 10);
    await seedVote("wrong", 11);
    await settleDue(db, NOW);
    expect(await total("right")).toBe(3);
    expect(await total("wrong")).toBe(1);
  });

  it("prognóstico antigo sem source é ignorado", async () => {
    await seedGame();
    await seedPlayers();
    await db.doc("matchPredictions/old1").set({ gameId: "m1", userId: "old", home: 2, away: 1 });
    await settleDue(db, NOW);
    expect(await total("old")).toBeUndefined();
    expect((await db.doc("pointEvents/old_m1_prediction_exact").get()).exists).toBe(false);
  });

  it("prognóstico v2027 forjado, sem pointEvent de participação, não recebe bónus", async () => {
    await seedGame();
    await seedPlayers();
    await seedPrediction("forged", 2, 1, "m1", false);
    await seedVote("forged", 10, "m1", false);
    await settleDue(db, NOW);
    expect(await total("forged")).toBeUndefined();
  });

  it("sem ratings e terminado há menos de 24h: adia; passadas 24h liquida sem mvp_correct", async () => {
    await seedGame();
    await db.collection("players").doc("228_m1").set({
      GameId: "m1", teamId: 228, Players: [{ playerId: 10, name: "G", rating: "", minutes: 90 }],
    });
    await seedVote("a", 10);
    expect(await settleDue(db, NOW)).toBe(0);
    expect((await db.doc("settlements/m1").get()).exists).toBe(false);
    // 25h depois do fim
    const later = new Date(NOW.getTime() + 22 * 60 * MIN);
    expect(await settleDue(db, later)).toBe(1);
    expect((await db.doc("settlements/m1").get()).data()?.officialMvp).toEqual([]);
    expect(await total("a")).toBe(1);
  });

  it("jogo sem resultado contado é saltado; falha de um jogo não bloqueia os outros", async () => {
    await seedGame({ scorehome: "", scoreaway: "" }, "bad");
    await seedGame({}, "ok");
    await seedPlayers("ok");
    await seedPrediction("a", 2, 1, "ok");
    expect(await settleDue(db, NOW)).toBe(1);
    expect((await db.doc("settlements/bad").get()).exists).toBe(false);
    expect((await db.doc("settlements/ok").get()).exists).toBe(true);
  });

  it("não atribui outcome se o exact já existe (feed corrigido entre execuções)", async () => {
    await seedGame(); // 2-1
    await seedPlayers();
    await seedPrediction("a", 1, 0); // agora só acerta no resultado
    await awardPoints(db, { uid: "a", gameId: "m1", type: "prediction_exact", points: 3, gameDate: KICKOFF });
    await settleDue(db, NOW);
    expect((await db.doc("pointEvents/a_m1_prediction_outcome").get()).exists).toBe(false);
    expect(await total("a")).toBe(1 + 3);
  });

  it("jogo sem resultado há mais de 24h gera aviso e é saltado", async () => {
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    await seedGame({ scorehome: "", scoreaway: "" }, "old", 25 * 60);
    expect(await settleDue(db, NOW)).toBe(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("250 prognósticos num jogo (lotes de getAll)", async () => {
    await seedGame();
    await seedPlayers();
    const ids = Array.from({ length: 250 }, (_, i) => `u${i}`);
    for (let i = 0; i < ids.length; i += 25) {
      await Promise.all(ids.slice(i, i + 25).map((u, j) => seedPrediction(u, (i + j) % 2 ? 2 : 1, 1)));
    }
    expect(await settleDue(db, NOW)).toBe(1);
    // (2,1) exato = 4; (1,1) empate vs 2-1: sem bónus = 1
    expect(await total("u1")).toBe(4);
    expect(await total("u0")).toBe(1);
    expect(await total("u249")).toBe(4);
  }, 120_000);
});
