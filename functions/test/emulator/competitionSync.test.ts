import * as fs from "fs";
import * as path from "path";
import { deleteApp, getApps } from "firebase-admin/app";
import type { Firestore } from "firebase-admin/firestore";
import { SPORTING_CREST_URL } from "../../src/config/brand";
import { currentCompetitions, refreshStandings, syncCompetitions, syncStandings } from "../../src/football/competitionSync";
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
});
