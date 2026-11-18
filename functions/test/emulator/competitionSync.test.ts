import * as fs from "fs";
import * as path from "path";
import { deleteApp, getApps } from "firebase-admin/app";
import type { Firestore } from "firebase-admin/firestore";
import { SPORTING_CREST_URL } from "../../src/config/brand";
import { logger } from "firebase-functions";
import { currentCompetitions, refreshCompetition, refreshStandings, syncCompetitions, syncStandings } from "../../src/football/competitionSync";
import type { FootballDeps } from "../../src/football/fixturesSync";
import { apiFootball } from "../../src/sources/apiFootball";
import { runJob } from "../../src/store/health";
import { clearAll, testDb } from "../helpers/emulatorDb";
import { fakeFetch } from "../helpers/fakeFetch";
import { seedFootballMatch } from "../helpers/seedMatch";

const FIX = path.join(__dirname, "..", "fixtures", "api-football");
const load = (n: string) => JSON.parse(fs.readFileSync(path.join(FIX, n), "utf8"));
const NOW = new Date("2026-11-17T12:00:00Z");

let db: Firestore;
beforeAll(() => {
  db = testDb("competition-sync-test");
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});
beforeEach(async () => {
  await clearAll(db);
});

const deps = (f: ReturnType<typeof fakeFetch>): FootballDeps => ({ db, api: apiFootball({ key: "k", fetch: f }), now: () => NOW });
const envelope = (response: unknown[]) => ({ get: "x", parameters: {}, errors: [], results: response.length, paging: { current: 1, total: 1 }, response });

describe("currentCompetitions", () => {
  it("ligas distintas da época, sem particulares", async () => {
    const comp = (id: string, type: "league" | "cup" | "friendly", season = "2026") => ({ key: `football_${id}_${season}`, id, name: "x", type, season, round: null, roundLabel: null });
    await seedFootballMatch(db, { id: "1", competition: comp("94", "league") });
    await seedFootballMatch(db, { id: "2", competition: comp("94", "league") });
    await seedFootballMatch(db, { id: "3", competition: comp("96", "cup") });
    await seedFootballMatch(db, { id: "4", competition: comp("10", "friendly") });
    await seedFootballMatch(db, { id: "5", competition: comp("2", "league", "2025") });
    expect(await currentCompetitions(db, "2026")).toEqual([
      { leagueId: 94, season: "2026" },
      { leagueId: 96, season: "2026" },
    ]);
  });
});

describe("refreshStandings", () => {
  it("94: modelo novo e standings antigo com o contrato; o 228 leva o emblema novo", async () => {
    const f = fakeFetch([[/standings\?league=94&season=2026$/, "api-football/standings-94.json"]]);
    const r = await refreshStandings(deps(f), 94, "2026");
    expect(f.calls).toHaveLength(1);
    expect(r.count).toBe(8);
    const std = (await db.doc("competitions/football_94_2026/data/standings").get()).data()!;
    expect(std.groups).toHaveLength(1);
    expect(std.groups[0].rows).toHaveLength(8);
    expect(std.groups[0].rows[0]).toMatchObject({ rank: 1, teamId: "228", name: "Sporting CP", logo: SPORTING_CREST_URL, points: 28, played: 11, goalsFor: 25, goalsAgainst: 11, goalsDiff: 14, form: "WWDWW" });
    expect((await db.doc("competitions/football_94_2026").get()).data()).toMatchObject({ name: "Liga Portugal", type: "league" });
    const legacy = (await db.doc("standings/228_94_2026").get()).data()!;
    expect(legacy).toMatchObject({ api: "228_94_2026", competition: "Primeira Liga", points: "28", rank: "1", team: { api: "228", logo: SPORTING_CREST_URL } });
    expect((await db.collection("standings").get()).size).toBe(8);
  });

  it("liga 550: só o modelo novo, nenhum doc em standings", async () => {
    const f = fakeFetch([[/standings\?league=550/, "api-football/standings-94.json"]]);
    await refreshStandings(deps(f), 550, "2026");
    expect((await db.doc("competitions/football_550_2026/data/standings").get()).exists).toBe(true);
    expect((await db.collection("standings").get()).size).toBe(0);
  });

  it("resposta vazia: o documento existente fica e a execução regista count 0", async () => {
    await refreshStandings(deps(fakeFetch([[/standings/, "api-football/standings-94.json"]])), 94, "2026");
    await seedFootballMatch(db, { id: "1" });
    const before = (await db.doc("competitions/football_94_2026/data/standings").get()).data();
    const f = fakeFetch([[/standings/, envelope([])]]);
    await runJob(db, "football_standings", () => syncStandings(deps(f)));
    expect((await db.doc("competitions/football_94_2026/data/standings").get()).data()).toEqual(before);
    expect((await db.doc("ingestHealth/football_standings").get()).data()).toMatchObject({ lastCount: 0, consecutiveFailures: 0 });
  });
});

describe("syncCompetitions", () => {
  const routes = (): Array<[RegExp, any]> => [
    [/fixtures\/rounds\?league=94/, "api-football/rounds-94.json"],
    [/fixtures\?league=94&season=2026$/, "api-football/fixtures-league.json"],
    [/players\/topscorers\?league=94/, "api-football/topscorers-94.json"],
    [/players\/topassists\?league=94/, "api-football/topscorers-94.json"],
    [/players\/topyellowcards\?league=94/, "api-football/topscorers-94.json"],
    [/players\/topredcards\?league=94/, "api-football/topscorers-94.json"],
  ];
  const seed94 = () => seedFootballMatch(db, { id: "1" });

  it("rondas, calendário e tops; a ronda atual vem do calendário", async () => {
    await seed94();
    const f = fakeFetch(routes());
    const r = await syncCompetitions(deps(f));
    expect(f.calls).toHaveLength(6);
    expect(r.count).toBe(5);
    const rounds = (await db.doc("competitions/football_94_2026/data/rounds").get()).data()!;
    expect(rounds.items).toHaveLength(34);
    expect(rounds.items[10]).toEqual({ raw: "Regular Season - 11", label: "J11" });
    expect(rounds.current).toBe("Regular Season - 12");
    const fx = (await db.doc("competitions/football_94_2026/data/fixtures").get()).data()!;
    expect(fx.items).toHaveLength(5);
    expect(fx.items[0]).toMatchObject({ id: "1500001", round: "Regular Season - 12", roundLabel: "J12", status: "FT", home: { id: "228", logo: SPORTING_CREST_URL }, away: { id: "211" } });
    const top = (await db.doc("competitions/football_94_2026/data/topscorers").get()).data()!;
    expect(top.items[0]).toMatchObject({ teamId: "228", teamLogo: SPORTING_CREST_URL });
    expect(typeof top.items[0].value).toBe("number");
    expect(top.items[0].value).toBe(12);
    expect((await db.doc("competitions/football_94_2026/data/topassists").get()).data()!.items[0].value).toBe(3);
  });

  it("uma taça não pede tops", async () => {
    await seedFootballMatch(db, { id: "9", competition: { key: "football_96_2026", id: "96", name: "Taça de Portugal", type: "cup", season: "2026", round: null, roundLabel: null } });
    const f = fakeFetch([
      [/fixtures\/rounds\?league=96/, "api-football/rounds-94.json"],
      [/fixtures\?league=96&season=2026$/, "api-football/fixtures-league.json"],
    ]);
    await syncCompetitions(deps(f));
    expect(f.calls.some((u) => u.includes("players/top"))).toBe(false);
    expect((await db.doc("competitions/football_96_2026/data/topscorers").get()).exists).toBe(false);
    expect((await db.doc("competitions/football_96_2026/data/fixtures").get()).exists).toBe(true);
  });

  it("respostas vazias não tocam nos documentos existentes", async () => {
    await seed94();
    await syncCompetitions(deps(fakeFetch(routes())));
    const before = (await db.doc("competitions/football_94_2026/data/rounds").get()).data();
    const empty = fakeFetch([[/./, envelope([])]]);
    await syncCompetitions(deps(empty));
    expect((await db.doc("competitions/football_94_2026/data/rounds").get()).data()).toEqual(before);
    expect((await db.doc("competitions/football_94_2026/data/topscorers").get()).exists).toBe(true);
  });

  it("rondas com calendário vazio: mantém a ronda atual guardada (não a apaga com null)", async () => {
    await seed94();
    await syncCompetitions(deps(fakeFetch(routes())));
    expect((await db.doc("competitions/football_94_2026/data/rounds").get()).get("current")).toBe("Regular Season - 12");
    const noFixtures = fakeFetch([
      [/fixtures\/rounds\?league=94/, "api-football/rounds-94.json"],
      [/./, envelope([])],
    ]);
    await syncCompetitions(deps(noFixtures));
    const rounds = (await db.doc("competitions/football_94_2026/data/rounds").get()).data()!;
    expect(rounds.current).toBe("Regular Season - 12");
    expect(rounds.items).toHaveLength(34);
  });
});

describe("eliminatórias e vista", () => {
  const key = (id: number) => `competitions/football_${id}_2026`;
  const cupRoutes = (): Array<[RegExp, any]> => [
    [/fixtures\/rounds\?league=96/, envelope(["3rd Round", "Quarter-finals", "Final"])],
    [/fixtures\?league=96&season=2026$/, "api-football/fixtures-cup-96.json"],
  ];
  const uclRoutes = (): Array<[RegExp, any]> => [
    [/fixtures\/rounds\?league=2&/, envelope(["League Stage - 8", "Knockout Round Play-offs", "Round of 16"])],
    [/fixtures\?league=2&season=2026$/, "api-football/fixtures-ucl-2.json"],
    [/players\/top/, "api-football/topscorers-94.json"],
  ];

  it("96: bracket com as rondas por ordem e vista no quadro", async () => {
    await refreshCompetition(deps(fakeFetch(cupRoutes())), 96, "2026");
    const b = (await db.doc(`${key(96)}/data/bracket`).get()).data()!;
    expect(b.stages.map((s: any) => s.raw)).toEqual(["3rd Round", "Quarter-finals", "Final"]);
    expect(b.stages[0].ties).toHaveLength(3);
    expect(b.stages[0].ties[0]).toMatchObject({ sportingInvolved: true, winnerTeamId: "228", aggregate: { home: 0, away: 2 } });
    expect(b.stages[0].ties[0].legs[0].kickoff).toEqual(expect.any(String));
    expect((await db.doc(key(96)).get()).data()!.view).toEqual({ primary: "bracket", hasTable: false, hasBracket: true, currentStage: "Quartos de final" });
    const fx = (await db.doc(`${key(96)}/data/fixtures`).get()).data()!;
    expect(fx.items[1].score).toEqual({ home: 1, away: 1, extraHome: 0, extraAway: 0, penaltyHome: 4, penaltyAway: 3 });
  });

  it("94: sem bracket e vista na tabela", async () => {
    const f = fakeFetch([
      [/fixtures\/rounds\?league=94/, "api-football/rounds-94.json"],
      [/fixtures\?league=94&season=2026$/, "api-football/fixtures-league.json"],
      [/players\/top/, "api-football/topscorers-94.json"],
    ]);
    await refreshCompetition(deps(f), 94, "2026");
    expect((await db.doc(`${key(94)}/data/bracket`).get()).exists).toBe(false);
    expect((await db.doc(key(94)).get()).data()!.view).toMatchObject({ primary: "table", hasTable: true, hasBracket: false, currentStage: "J12" });
  });

  it("2: competição acabada (tudo final) fica no quadro", async () => {
    const done = load("fixtures-ucl-2.json");
    for (const f of done.response) {
      f.fixture.status = { long: "Match Finished", short: "FT", elapsed: 90, extra: null };
      f.goals = { home: 1, away: 0 };
      f.score.fulltime = { home: 1, away: 0 };
      f.score.penalty = { home: null, away: null };
      f.score.extratime = { home: null, away: null };
    }
    await refreshStandings(deps(fakeFetch([[/standings/, "api-football/standings-2.json"]])), 2, "2026");
    const f = fakeFetch([[/fixtures\/rounds\?league=2&/, envelope(["League Stage - 8", "Knockout Round Play-offs", "Round of 16"])], [/fixtures\?league=2&season=2026$/, done], [/players\/top/, "api-football/topscorers-94.json"]]);
    await refreshCompetition(deps(f), 2, "2026");
    expect((await db.doc(`competitions/football_2_2026`).get()).data()!.view).toMatchObject({ primary: "bracket", currentStage: null });
  });

  it("2: tabela da fase de liga e play-off/oitavos no quadro; a vista passa a quadro", async () => {
    await refreshStandings(deps(fakeFetch([[/standings/, "api-football/standings-2.json"]])), 2, "2026");
    await refreshCompetition(deps(fakeFetch(uclRoutes())), 2, "2026");
    const b = (await db.doc(`${key(2)}/data/bracket`).get()).data()!;
    expect(b.stages.map((s: any) => s.raw)).toEqual(["Knockout Round Play-offs", "Round of 16"]);
    expect((await db.doc(key(2)).get()).data()!.view).toEqual({ primary: "bracket", hasTable: true, hasBracket: true, currentStage: "Oitavos de final" });
    expect((await db.doc(key(2)).get()).data()).toMatchObject({ name: "Liga dos Campeões", type: "europe" });
  });
});

describe("falhas parciais", () => {
  const cup = { key: "football_96_2026", id: "96", name: "Taça de Portugal", type: "cup" as const, season: "2026", round: null, roundLabel: null };
  const seedBoth = async () => {
    await seedFootballMatch(db, { id: "1" });
    await seedFootballMatch(db, { id: "9", competition: cup });
  };
  const okCup: Array<[RegExp, any]> = [
    [/fixtures\/rounds\?league=96/, "api-football/rounds-94.json"],
    [/fixtures\?league=96&season=2026$/, "api-football/fixtures-league.json"],
  ];
  const alerts = () => jest.spyOn(logger, "error").mockImplementation(() => undefined);
  afterEach(() => jest.restoreAllMocks());

  it("uma competição a falhar é saltada, as outras escrevem-se e há alerta e failed na saúde", async () => {
    await seedBoth();
    const spy = alerts();
    const f = fakeFetch([[/league=94/, { status: 500 }], ...okCup]);
    await runJob(db, "football_competitions", () => syncCompetitions(deps(f)));
    expect((await db.doc("competitions/football_96_2026/data/fixtures").get()).exists).toBe(true);
    expect((await db.doc("competitions/football_94_2026/data/fixtures").get()).exists).toBe(false);
    // Um só alerta, do runJob (a função só deixa o detalhe em warn).
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("INGEST_ALERT", expect.objectContaining({ source: "football_competitions" }));
    expect((await db.doc("ingestHealth/football_competitions").get()).data()).toMatchObject({ lastFailed: 1, consecutiveFailures: 0 });
  });

  it("429 pára o ciclo e as restantes contam como falhadas", async () => {
    await seedBoth();
    alerts();
    const f = fakeFetch([[/./, { status: 429 }]]);
    await expect(syncCompetitions(deps(f))).rejects.toThrow(/todas/);
    expect(f.calls.filter((u) => u.includes("fixtures/rounds"))).toHaveLength(1);
  });

  it("todas a falhar: runJob regista consecutiveFailures", async () => {
    await seedBoth();
    alerts();
    const f = fakeFetch([[/./, { status: 500 }]]);
    await runJob(db, "football_competitions", () => syncCompetitions(deps(f)));
    await runJob(db, "football_competitions", () => syncCompetitions(deps(f)));
    expect((await db.doc("ingestHealth/football_competitions").get()).data()).toMatchObject({ consecutiveFailures: 2 });
  });

  it("um tops a falhar não bloqueia rondas e calendário", async () => {
    await seedFootballMatch(db, { id: "1" });
    jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    const f = fakeFetch([
      [/players\/topscorers/, { status: 500 }],
      [/players\/top/, "api-football/topscorers-94.json"],
      [/fixtures\/rounds\?league=94/, "api-football/rounds-94.json"],
      [/fixtures\?league=94&season=2026$/, "api-football/fixtures-league.json"],
    ]);
    const r = await refreshCompetition(deps(f), 94, "2026");
    expect(r.failed).toBe(1);
    expect((await db.doc("competitions/football_94_2026/data/rounds").get()).exists).toBe(true);
    expect((await db.doc("competitions/football_94_2026/data/fixtures").get()).exists).toBe(true);
    expect((await db.doc("competitions/football_94_2026/data/topscorers").get()).exists).toBe(false);
    expect((await db.doc("competitions/football_94_2026/data/topassists").get()).exists).toBe(true);
  });

  it("modo sombra: standings antigos vão para o prefixo e nenhum para standings", async () => {
    const f = fakeFetch([[/standings/, "api-football/standings-94.json"]]);
    await refreshStandings({ ...deps(f), prefix: "_shadow_" }, 94, "2026");
    expect((await db.collection("_shadow_standings").get()).size).toBe(8);
    expect((await db.collection("standings").get()).size).toBe(0);
  });
});
