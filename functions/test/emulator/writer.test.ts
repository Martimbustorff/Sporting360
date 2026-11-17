import { deleteApp, getApps } from "firebase-admin/app";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { saveMatch, getMatch, legacyCollection, writeDocs } from "../../src/store/writer";
import type { MatchDoc } from "../../src/model/types";
import type { FootballDetails } from "../../src/football/mapFixture";
import type { LegacyDocs } from "../../src/legacy/footballLegacy";
import { clearAll, testDb } from "../helpers/emulatorDb";

let db: Firestore;
beforeAll(() => {
  db = testDb("writer-test");
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});
beforeEach(async () => {
  await clearAll(db);
});

function match(over: Partial<MatchDoc> = {}): MatchDoc {
  return {
    id: "1001",
    sport: "football",
    competition: { key: "football_94_2026", id: "94", name: "Liga Portugal", type: "league", season: "2026", round: "Regular Season - 12", roundLabel: "J12" },
    home: { id: "228", name: "Sporting CP", logo: null },
    away: { id: "211", name: "Benfica", logo: null },
    sportingSide: "home",
    kickoff: new Date("2026-11-15T20:30:00Z"),
    status: "LIVE",
    statusRaw: "2H",
    elapsed: 60,
    elapsedExtra: null,
    score: { home: 1, away: 0, halftime: { home: 0, away: 0 }, extratime: null, penalty: null },
    finishedAt: null,
    finishedAtSource: null,
    venue: { id: "1", name: "Estádio José Alvalade", city: "Lisboa" },
    referee: null,
    source: { provider: "api-football", id: "1001" },
    ...over,
  };
}

const ev = (n: number) => ({ minute: n, extra: null, teamId: "228", playerId: String(n), player: `P${n}`, assistId: null, assist: null, type: "Goal", detail: "Normal Goal", comments: null });
function details(n: number): FootballDetails {
  return {
    events: { items: Array.from({ length: n }, (_, i) => ev(i + 1)) as never },
    statistics: { teams: [], xg: null },
    lineups: { teams: [] },
    players: { teams: [] },
  };
}
function legacy(n: number, channel = ""): Partial<LegacyDocs> {
  const summaries: Record<string, object> = {};
  for (let i = 1; i <= n; i++) summaries[`s${i}`] = { api: `s${i}`, GameId: "1001", time: String(i) };
  return {
    games: { "1001": { api: "1001", scorehome: "1", scoreaway: "0", elapsedTime: "60", channel } },
    summaries,
    stastistics: { "1001_228": { api: "1001_228" } },
    lineups: { "1001_228": { api: "1001_228" } },
    players: { "1001_p1": { api: "1001_p1" } },
  };
}

describe("saveMatch", () => {
  it("jogo novo escreve modelo novo e coleções antigas; kickoff é Timestamp", async () => {
    const r = await saveMatch(db, { match: match(), details: details(3), legacy: legacy(3) });
    expect(r.locked).toBe(false);
    expect((await db.doc("matches/1001").get()).get("kickoff")).toBeInstanceOf(Timestamp);
    expect((await db.doc("matches/1001/details/events").get()).exists).toBe(true);
    expect((await db.doc("games/1001").get()).exists).toBe(true);
    expect((await db.collection("summaries").get()).size).toBe(3);
    expect((await db.doc("stastistics/1001_228").get()).exists).toBe(true);
    expect((await db.doc("lineups/1001_228").get()).exists).toBe(true);
    expect((await db.doc("players/1001_p1").get()).exists).toBe(true);
    expect((await db.doc("matches/1001").get()).get("updatedAt")).toBeInstanceOf(Timestamp);
    expect((await db.doc("games/1001").get()).get("updatedAt")).toBeUndefined();
  });

  it("repetir a mesma chamada não escreve nada", async () => {
    await saveMatch(db, { match: match(), details: details(3), legacy: legacy(3) });
    const r = await saveMatch(db, { match: match(), details: details(3), legacy: legacy(3) });
    expect(r.written).toBe(0);
    expect(r.skipped).toBeGreaterThan(0);
  });

  it("mudar só o minuto escreve só matches/1001 e games/1001", async () => {
    await saveMatch(db, { match: match(), details: details(3), legacy: legacy(3) });
    const l = legacy(3);
    l.games!["1001"].elapsedTime = "61";
    const r = await saveMatch(db, { match: match({ elapsed: 61 }), details: details(3), legacy: l });
    expect(r.written).toBe(2);
  });

  it("jogo bloqueado: não escreve nada e devolve locked", async () => {
    await db.doc("matches/1001").set({ id: "1001", locked: true, score: { home: 3, away: 0 } });
    await db.doc("games/1001").set({ api: "1001", scorehome: "3" });
    const r = await saveMatch(db, { match: match(), details: details(3), legacy: legacy(3) });
    expect(r.locked).toBe(true);
    expect(r.written).toBe(0);
    expect((await db.doc("matches/1001").get()).get("score.home")).toBe(3);
    expect((await db.doc("games/1001").get()).get("scorehome")).toBe("3");
    expect((await db.collection("summaries").get()).size).toBe(0);
  });

  it("resposta vazia não apaga: details.events null e summaries {} mantêm tudo", async () => {
    await saveMatch(db, { match: match(), details: details(3), legacy: legacy(3) });
    const empty = legacy(3);
    empty.summaries = {};
    await saveMatch(db, { match: match(), details: { ...details(3), events: null }, legacy: empty });
    expect(((await db.doc("matches/1001/details/events").get()).get("items") as unknown[]).length).toBe(3);
    expect((await db.collection("summaries").get()).size).toBe(3);
  });

  it("com 2 lances novos só o lance removido pela API é apagado", async () => {
    await saveMatch(db, { match: match(), details: details(3), legacy: legacy(3) });
    await saveMatch(db, { match: match(), details: details(2), legacy: legacy(2) });
    expect(((await db.doc("matches/1001/details/events").get()).get("items") as unknown[]).length).toBe(2);
    const ids = (await db.collection("summaries").get()).docs.map((d) => d.id).sort();
    expect(ids).toEqual(["s1", "s2"]);
    // e não apaga summaries de outros jogos
    await db.doc("summaries/other").set({ GameId: "2002" });
    await saveMatch(db, { match: match(), details: details(1), legacy: legacy(1) });
    expect((await db.doc("summaries/other").get()).exists).toBe(true);
  });

  it("games preserva predictionsSettled e channel existentes", async () => {
    await db.doc("games/1001").set({ api: "1001", predictionsSettled: true, channel: "SPTV" });
    await saveMatch(db, { match: match(), details: details(1), legacy: legacy(1, "") });
    const g = (await db.doc("games/1001").get()).data()!;
    expect(g.predictionsSettled).toBe(true);
    expect(g.channel).toBe("SPTV");
    expect(g.scorehome).toBe("1");
  });

  it("jogo novo sem games existente fica com channel vazio", async () => {
    await saveMatch(db, { match: match(), details: null, legacy: legacy(0, "") });
    expect((await db.doc("games/1001").get()).get("channel")).toBe("");
  });

  it("matches é escrito com merge: preserva venue.capacity e limpa com null explícito", async () => {
    await saveMatch(db, { match: match(), details: null, legacy: null });
    await db.doc("matches/1001").set({ venue: { capacity: 50000 } }, { merge: true });
    await saveMatch(db, { match: match({ elapsed: 70 }), details: null, legacy: null });
    expect((await db.doc("matches/1001").get()).get("venue.capacity")).toBe(50000);
    await saveMatch(db, { match: match({ elapsed: 71, score: { home: 1, away: 0, halftime: null, extratime: null, penalty: null } }), details: null, legacy: null });
    expect((await db.doc("matches/1001").get()).get("score.halftime")).toBeNull();
  });

  it("com prefix escreve _shadow_games e não toca em games", async () => {
    await saveMatch(db, { match: match(), details: details(1), legacy: legacy(1) }, { prefix: "_shadow_" });
    expect((await db.doc("_shadow_games/1001").get()).exists).toBe(true);
    expect((await db.doc("_shadow_summaries/s1").get()).exists).toBe(true);
    expect((await db.doc("games/1001").get()).exists).toBe(false);
    expect((await db.doc("matches/1001").get()).exists).toBe(true);
    expect(legacyCollection("games", "_shadow_")).toBe("_shadow_games");
  });

  it("estado de hashes é por jogo (ingestState/match_1001)", async () => {
    await saveMatch(db, { match: match(), details: null, legacy: null });
    expect((await db.doc("ingestState/match_1001").get()).exists).toBe(true);
  });

  it("getMatch converte Timestamp em Date", async () => {
    await saveMatch(db, { match: match(), details: null, legacy: null });
    const m = await getMatch(db, "1001");
    expect(m?.kickoff).toEqual(new Date("2026-11-15T20:30:00Z"));
    expect(await getMatch(db, "nope")).toBeNull();
  });
});

describe("writeDocs", () => {
  it("só escreve o que mudou", async () => {
    const w = [{ path: "teams/a", data: { n: 1 } }, { path: "teams/b", data: { n: 2 } }];
    expect(await writeDocs(db, w, { stateKey: "k" })).toEqual({ written: 2, skipped: 0 });
    expect(await writeDocs(db, [w[0], { path: "teams/b", data: { n: 3 } }], { stateKey: "k" })).toEqual({ written: 1, skipped: 1 });
  });
});

describe("force", () => {
  it("writeDocs com force ignora os hashes guardados", async () => {
    const w = [{ path: "teams/a", data: { n: 1 } }];
    await writeDocs(db, w, { stateKey: "f" });
    await db.doc("teams/a").delete();
    expect(await writeDocs(db, w, { stateKey: "f" })).toEqual({ written: 0, skipped: 1 });
    expect(await writeDocs(db, w, { stateKey: "f", force: true })).toEqual({ written: 1, skipped: 0 });
    expect((await db.doc("teams/a").get()).exists).toBe(true);
  });

  it("saveMatch com force repõe documentos apagados mesmo sem mudanças", async () => {
    await saveMatch(db, { match: match(), details: details(3), legacy: legacy(3) });
    await db.doc("matches/1001/details/events").delete();
    await db.doc("games/1001").delete();
    expect((await saveMatch(db, { match: match(), details: details(3), legacy: legacy(3) })).written).toBe(0);
    const r = await saveMatch(db, { match: match(), details: details(3), legacy: legacy(3) }, { force: true });
    expect(r.written).toBeGreaterThan(0);
    expect((await db.doc("matches/1001/details/events").get()).exists).toBe(true);
    expect((await db.doc("games/1001").get()).exists).toBe(true);
  });
});
