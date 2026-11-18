import { initializeApp, getApps, deleteApp } from "firebase-admin/app";
import { getFirestore, Firestore, Timestamp } from "firebase-admin/firestore";
import { clearAll } from "../helpers/emulatorDb";
import { seedFootballMatch } from "../helpers/seedMatch";
import { settleLegacyPredictions, settleLegacyPredictionsIfProduction } from "../../src/legacy/predictionSettlement";

let db: Firestore;
const MIN = 60_000;
const NOW = new Date("2026-11-17T23:00:00Z");
const SEASON = "2026-2027";

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  db = getFirestore(initializeApp({ projectId: "demo-scp360" }, "legacy-settlement-test"));
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});
beforeEach(async () => {
  await clearAll(db);
});

async function seedGame(api: string, matchOver: Record<string, unknown>, gameOver: Record<string, unknown> = {}) {
  await seedFootballMatch(db, { id: api, ...matchOver });
  await db.doc(`games/g${api}`).set({
    api, scorehome: "2", scoreaway: "1", isActive: false,
    timestamp: Timestamp.fromDate(new Date(NOW.getTime() - 3 * 60 * MIN)),
    endTime: new Date(NOW.getTime() - 10 * MIN).toISOString(),
    ...gameOver,
  });
}
async function seedPred(id: string, userId: string, home: number, away: number, gameId = "1001", extra: Record<string, unknown> = {}) {
  await db.doc(`predictions/${id}`).set({
    gameId, userId, userName: userId.toUpperCase(), scorehome: home, scoreaway: away, season: SEASON, scored: false, ...extra,
  });
}
const ft = (minAgo: number) => ({ status: "FT" as const, finishedAt: new Date(NOW.getTime() - minAgo * MIN) });

describe("settleLegacyPredictions", () => {
  it("liquida palpites exatos (+3, point_event) e marca o jogo", async () => {
    await seedGame("1001", ft(31));
    await seedPred("1001_alice", "alice", 2, 1);
    await seedPred("1001_bob", "bob", 1, 1);

    const out = await settleLegacyPredictions(db, NOW);
    expect(out).toEqual({ games: 1, predictions: 2 });

    const a = (await db.doc("predictions/1001_alice").get()).data()!;
    expect(a).toMatchObject({ scored: true, correct: true });
    const b = (await db.doc("predictions/1001_bob").get()).data()!;
    expect(b).toMatchObject({ scored: true, correct: false });
    expect((await db.doc(`rankings/alice_${SEASON}`).get()).data()).toMatchObject({ userId: "alice", userName: "ALICE", season: SEASON, points: 3 });
    expect((await db.doc(`rankings/bob_${SEASON}`).get()).exists).toBe(false);
    expect((await db.doc("point_events/exact_score_1001_alice").get()).data()).toMatchObject({
      userId: "alice", userName: "ALICE", fixtureId: "1001", season: SEASON, type: "exact_score", points: 3,
    });
    expect((await db.doc("point_events/exact_score_1001_bob").get()).exists).toBe(false);
    expect((await db.doc("games/g1001").get()).get("predictionsSettled")).toBe(true);
  });

  it("FT terminado há 10 min ainda não é liquidado; há 31 min sim", async () => {
    await seedGame("1001", ft(10));
    await seedPred("1001_alice", "alice", 2, 1);
    expect(await settleLegacyPredictions(db, NOW)).toEqual({ games: 0, predictions: 0 });
    await db.doc("matches/1001").set({ finishedAt: new Date(NOW.getTime() - 31 * MIN) }, { merge: true });
    expect(await settleLegacyPredictions(db, NOW)).toEqual({ games: 1, predictions: 1 });
  });

  it("duas execuções concorrentes: +3 uma vez, um point_event", async () => {
    await seedGame("1001", ft(31));
    await seedPred("1001_alice", "alice", 2, 1);
    await Promise.all([settleLegacyPredictions(db, NOW), settleLegacyPredictions(db, NOW)]);
    expect((await db.doc(`rankings/alice_${SEASON}`).get()).get("points")).toBe(3);
    expect((await db.collection("point_events").get()).size).toBe(1);
  });

  it("segunda execução não muda nada", async () => {
    await seedGame("1001", ft(31));
    await seedPred("1001_alice", "alice", 2, 1);
    await settleLegacyPredictions(db, NOW);
    await settleLegacyPredictions(db, NOW);
    expect((await db.doc(`rankings/alice_${SEASON}`).get()).get("points")).toBe(3);
  });

  it("Review Focus 1: jogo PST nunca é liquidado, mesmo com endTime passado e isActive false", async () => {
    await seedGame("1002", { status: "PST", finishedAt: null }, { api: "1002" });
    await seedPred("1002_alice", "alice", 0, 0, "1002");
    await db.doc("games/g1002").set({ scorehome: "0", scoreaway: "0" }, { merge: true });

    const out = await settleLegacyPredictions(db, NOW);
    expect(out).toEqual({ games: 0, predictions: 0 });
    expect((await db.doc("predictions/1002_alice").get()).get("scored")).toBe(false);
    expect((await db.doc("games/g1002").get()).data()).not.toHaveProperty("predictionsSettled");
  });

  it("jogo LIVE não é liquidado", async () => {
    await seedGame("1003", { status: "LIVE", finishedAt: null }, { isActive: true });
    await seedPred("1003_alice", "alice", 2, 1, "1003");
    expect(await settleLegacyPredictions(db, NOW)).toEqual({ games: 0, predictions: 0 });
    expect((await db.doc("predictions/1003_alice").get()).get("scored")).toBe(false);
  });

  it("FT com finishedAt no futuro, ou sem documento em matches, não é liquidado", async () => {
    await seedGame("1004", { status: "FT", finishedAt: new Date(NOW.getTime() + 5 * MIN) });
    await db.doc("games/g1005").set({ api: "1005", scorehome: "1", scoreaway: "0", timestamp: Timestamp.fromDate(new Date(NOW.getTime() - 60 * MIN)) });
    await seedPred("1004_alice", "alice", 2, 1, "1004");
    expect(await settleLegacyPredictions(db, NOW)).toEqual({ games: 0, predictions: 0 });
  });

  it("não toca em palpites com `source` (v2027) nem em jogos já liquidados ou fora da janela de 3 dias", async () => {
    await seedGame("1001", ft(31));
    await seedPred("1001_carol", "carol", 2, 1, "1001", { source: "v2027" });
    await seedGame("1006", ft(31), { predictionsSettled: true });
    await seedPred("1006_alice", "alice", 2, 1, "1006");
    await seedGame("1007", ft(31), { timestamp: Timestamp.fromDate(new Date(NOW.getTime() - 4 * 24 * 60 * MIN)) });
    await seedPred("1007_alice", "alice", 2, 1, "1007");

    await settleLegacyPredictions(db, NOW);
    expect((await db.doc("predictions/1001_carol").get()).get("scored")).toBe(false);
    expect((await db.doc("predictions/1006_alice").get()).get("scored")).toBe(false);
    expect((await db.doc("predictions/1007_alice").get()).get("scored")).toBe(false);
    expect((await db.doc(`rankings/carol_${SEASON}`).get()).exists).toBe(false);
  });

  it("reexecução após falha parcial: não duplica nem perde pontos", async () => {
    await seedGame("1001", ft(31));
    await seedPred("1001_alice", "alice", 2, 1);
    await seedPred("1001_dave", "dave", 2, 1);

    // Falha simulada: o evento da alice e o ranking foram escritos atomicamente com o scored, o da dave não chegou a correr.
    const real = db.runTransaction.bind(db);
    let calls = 0;
    const spy = jest.spyOn(db, "runTransaction").mockImplementation(((fn: never, opts: never) => {
      calls += 1;
      if (calls === 2) return Promise.reject(new Error("crash"));
      return real(fn, opts);
    }) as never);
    await expect(settleLegacyPredictions(db, NOW)).rejects.toThrow("crash");
    spy.mockRestore();

    expect((await db.doc("games/g1001").get()).data()).not.toHaveProperty("predictionsSettled");
    const scoredNow = (await db.collection("predictions").where("scored", "==", true).get()).size;
    expect(scoredNow).toBe(1);

    await settleLegacyPredictions(db, NOW);
    expect((await db.doc(`rankings/alice_${SEASON}`).get()).get("points")).toBe(3);
    expect((await db.doc(`rankings/dave_${SEASON}`).get()).get("points")).toBe(3);
    expect((await db.doc("games/g1001").get()).get("predictionsSettled")).toBe(true);
  });

  it("palpite não marcado mas com point_event já existente: marca scored sem repetir os pontos", async () => {
    await seedGame("1001", ft(31));
    await seedPred("1001_alice", "alice", 2, 1);
    await db.doc("point_events/exact_score_1001_alice").set({ userId: "alice", type: "exact_score", points: 3 });
    await db.doc(`rankings/alice_${SEASON}`).set({ userId: "alice", season: SEASON, points: 3 });
    await settleLegacyPredictions(db, NOW);
    expect((await db.doc(`rankings/alice_${SEASON}`).get()).get("points")).toBe(3);
    expect((await db.doc("predictions/1001_alice").get()).get("scored")).toBe(true);
  });
});

describe("guarda do modo sombra", () => {
  it("com prefixo não vazio não escreve nada", async () => {
    await seedGame("1001", ft(31));
    await seedPred("1001_alice", "alice", 2, 1);
    expect(await settleLegacyPredictionsIfProduction(db, NOW, "_shadow_")).toBeNull();
    expect((await db.doc("predictions/1001_alice").get()).get("scored")).toBe(false);
  });
  it("com prefixo vazio corre", async () => {
    await seedGame("1001", ft(31));
    await seedPred("1001_alice", "alice", 2, 1);
    expect(await settleLegacyPredictionsIfProduction(db, NOW, "")).toEqual({ games: 1, predictions: 1 });
  });
});
