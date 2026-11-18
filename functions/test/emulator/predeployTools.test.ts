import { deleteApp, getApps } from "firebase-admin/app";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { checkFirestore, firestoreFailures } from "../../scripts/check-predeploy";
import { compareAll, hasProblems } from "../../scripts/compare-legacy";
import { clearAll, testDb } from "../helpers/emulatorDb";

let db: Firestore;
beforeAll(() => {
  db = testDb("predeploy-tools-test");
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});
beforeEach(async () => {
  await clearAll(db);
});

describe("check-predeploy (Firestore, só leitura)", () => {
  it("dados corretos: sem falhas, e conta o motor v2027", async () => {
    await db.doc("rankings/u1_2026-2027").set({ userId: "u1", season: "2026-2027", points: 4 });
    await db.doc("predictions/1001_u1").set({ userId: "u1", scored: false });
    await db.doc("manofmatch/1001_u1").set({ userId: "u1" });
    await db.doc("matchPredictions/1001_u1").set({ userId: "u1" });
    const r = await checkFirestore(db);
    expect(r).toMatchObject({ rankings: 1, predictions: 1, manofmatch: 1, badRankings: [], withSource: { predictions: [], manofmatch: [] } });
    expect(r.engine.matchPredictions).toBe(1);
    expect(firestoreFailures(r)).toEqual([]);
  });

  it("ranking fora do formato e source nos palpites antigos falham", async () => {
    await db.doc("rankings/u1").set({ userId: "u1", points: 4 });
    await db.doc("predictions/1001_u1").set({ userId: "u1", source: "v2027" });
    await db.doc("manofmatch/1001_u2").set({ userId: "u2", source: null });
    const r = await checkFirestore(db);
    expect(firestoreFailures(r)).toEqual(["1 rankings fora do formato", "1 predictions com source", "1 manofmatch com source"]);
  });
});

describe("compare-legacy (Firestore, só leitura)", () => {
  const game = (id: string, over: Record<string, unknown> = {}) => ({
    api: id,
    timestamp: Timestamp.fromMillis(1_790_000_000_000),
    scorehome: "1",
    scoreaway: "0",
    competition: "Primeira Liga",
    isActive: false,
    endTime: "2026-12-01T22:30:00.000Z",
    ...over,
  });

  it("documentos iguais nos dois lados: sem problemas; só o que mudou desde --since conta", async () => {
    await db.doc("games/900").set(game("900", { scorehome: "3" })); // antigo, não está em sombra
    const since = new Date();
    await new Promise((r) => setTimeout(r, 5));
    await db.doc("games/1001").set(game("1001", { channel: "Sport TV" }));
    await db.doc("_shadow_games/1001").set(game("1001", { _ingest: "v2027", isActive: true, endTime: "2026-12-01T21:55:00.000Z", channel: "" }));
    await db.doc("summaries/a").set({ GameId: "1001", playerSub: { name: "null" } });
    await db.doc("_shadow_summaries/a").set({ GameId: "1001", playerSub: { name: "" }, _ingest: "v2027" });
    const reports = await compareAll(db, ["summaries", "games"], since);
    expect(reports.map((r) => r.col)).toEqual(["games", "summaries"]);
    expect(reports[0]).toMatchObject({ compared: 1, missing: [], extra: [], unexpected: [] });
    expect(reports[1]).toMatchObject({ compared: 1, unexpected: [] });
    expect(reports[1].expected).toHaveLength(1);
    expect(hasProblems(reports)).toBe(false);
  });

  it("diferença de tipo, jogo em falta e jogo de competição nova (esperado) com os seus detalhes", async () => {
    const since = new Date(Date.now() - 1000);
    await db.doc("games/1001").set(game("1001"));
    await db.doc("_shadow_games/1001").set(game("1001", { scoreaway: 0 }));
    await db.doc("games/1002").set(game("1002"));
    await db.doc("_shadow_games/2001").set(game("2001", { competition: "Super Cup" }));
    await db.doc("_shadow_summaries/x").set({ GameId: "2001" });
    const [games, summaries] = await compareAll(db, ["games", "summaries"], since);
    expect(games.unexpected).toEqual([{ id: "1001", field: "scoreaway", a: "0", b: 0 }]);
    expect(games.missing).toEqual(["1002"]);
    expect(games.extra).toEqual([]);
    expect(games.expectedExtra).toEqual(["2001"]);
    expect(summaries).toMatchObject({ extra: [], expectedExtra: ["x"] });
    expect(hasProblems([games, summaries])).toBe(true);
  });
});
