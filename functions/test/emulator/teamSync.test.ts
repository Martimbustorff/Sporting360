import * as fs from "fs";
import * as path from "path";
import { deleteApp, getApps } from "firebase-admin/app";
import type { Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { SPORTING_CREST_URL } from "../../src/config/brand";
import type { FootballDeps } from "../../src/football/fixturesSync";
import { syncTeamDaily, syncTeamWeekly } from "../../src/football/teamSync";
import { apiFootball } from "../../src/sources/apiFootball";
import { runJob } from "../../src/store/health";
import { clearAll, testDb } from "../helpers/emulatorDb";
import { fakeFetch } from "../helpers/fakeFetch";
import { seedFootballMatch } from "../helpers/seedMatch";

const FIX = path.join(__dirname, "..", "fixtures", "api-football");
const load = (n: string) => JSON.parse(fs.readFileSync(path.join(FIX, n), "utf8"));
const NOW = new Date("2026-11-17T12:00:00Z");
const TEAM = "teams/football_228";

let db: Firestore;
beforeAll(() => {
  db = testDb("team-sync-test");
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});
beforeEach(async () => {
  await clearAll(db);
  jest.restoreAllMocks();
});

const deps = (f: ReturnType<typeof fakeFetch>): FootballDeps => ({ db, api: apiFootball({ key: "k", fetch: f }), now: () => NOW });
const envelope = (response: unknown, extra: Record<string, unknown> = {}) => ({ get: "x", parameters: {}, errors: [], results: 0, paging: { current: 1, total: 1 }, response, ...extra });
const get = async (p: string) => (await db.doc(`${TEAM}/data/${p}`).get()).data();

const dailyRoutes = () =>
  [
    [/players\/squads/, "api-football/squad-228.json"],
    [/coachs/, "api-football/coachs-228.json"],
    [/players\?team=228&season=2026&page=1/, "api-football/players-228-p1.json"],
    [/players\?team=228&season=2026&page=2/, "api-football/players-228-p2.json"],
    [/teams\/statistics\?league=94/, "api-football/team-stats-94.json"],
    [/injuries/, "api-football/injuries-team.json"],
  ] as Array<[RegExp, string | object]>;

async function seedLeague() {
  await seedFootballMatch(db, { id: "1" });
}

describe("syncTeamDaily", () => {
  it("plantel, treinador, estatísticas, equipa e lesões", async () => {
    await seedLeague();
    const f = fakeFetch(dailyRoutes());
    const r = await syncTeamDaily(deps(f));
    expect(r.failed).toBe(0);

    const team = (await db.doc(TEAM).get()).data()!;
    expect(team).toMatchObject({ sport: "football", id: "228", name: "Sporting CP", logo: SPORTING_CREST_URL });

    const squad = (await get("squad"))!;
    expect(squad.players).toHaveLength(30);
    expect(squad.players[0]).toMatchObject({ id: "5000", name: "Israel", number: 1, photo: expect.stringContaining("5000.png") });

    expect(await get("coach")).toMatchObject({ id: "4001", name: "R. Borges" });

    const stats = (await get("playerStats_2026"))!;
    expect(stats.players).toHaveLength(30);
    expect(stats.players[0]).toMatchObject({ id: "5000", appearances: 10, minutes: 800, rating: 6.9 });

    const ts = (await get("teamStats_94_2026"))!;
    expect(typeof ts.form).toBe("string");
    expect(ts.goals.for.total).toEqual({ home: 14, away: 11, total: 25 });
    expect(ts.goals.for.minute["0-15"]).toEqual({ total: 3, percentage: "12.00%" });
    expect(ts.cleanSheet.total).toBe(5);

    expect(f.calls.filter((u) => /\/players\?/.test(u))).toHaveLength(2);
  });

  it("soma duas competições do mesmo jogador, ponderando o rating pelos minutos", async () => {
    await seedLeague();
    const p1 = load("players-228-p1.json");
    const s0 = p1.response[0].statistics[0];
    const second = JSON.parse(JSON.stringify(s0));
    second.league = { ...second.league, id: 96, name: "Taça de Portugal" };
    second.games = { ...second.games, appearences: 2, minutes: 200, rating: "7.5" };
    second.goals = { ...second.goals, total: 3, assists: 1 };
    second.cards = { yellow: 1, yellowred: 0, red: 0 };
    s0.goals.total = 2;
    p1.response[0].statistics.push(second);
    const f = fakeFetch([[/players\?team=228&season=2026&page=1/, p1], [/players\?team=228&season=2026&page=2/, "api-football/players-228-p2.json"], ...dailyRoutes().slice(0, 3).filter((x) => !/players\?/.test(String(x[0]))), [/teams\/statistics/, "api-football/team-stats-94.json"], [/injuries/, "api-football/injuries-team.json"]] as Array<[RegExp, string | object]>);
    await syncTeamDaily(deps(f));
    const first = (await get("playerStats_2026"))!.players[0];
    expect(first).toMatchObject({ goals: 5, appearances: 12, minutes: 1000, assists: 1, yellow: 1 });
    expect(first.rating).toBe(7.02);
  });

  it("byLeague: soma por liga (duas competições da mesma liga somadas), nulos a 0, totais inalterados", async () => {
    await seedLeague();
    const p1 = load("players-228-p1.json");
    const s0 = p1.response[0].statistics[0];
    const mk = (id: number, games: object, goals: object) => {
      const x = JSON.parse(JSON.stringify(s0));
      x.league = { ...x.league, id };
      x.games = { ...x.games, ...games };
      x.goals = { ...x.goals, ...goals };
      return x;
    };
    s0.games = { ...s0.games, appearences: 10, minutes: 800 };
    s0.goals = { ...s0.goals, total: 4, assists: 2 };
    // duas linhas da mesma liga (94) e uma da Taça (96) com nulos
    p1.response[0].statistics.push(mk(94, { appearences: 1, minutes: 30 }, { total: 1, assists: 0 }));
    p1.response[0].statistics.push(mk(96, { appearences: null, minutes: 90 }, { total: null, assists: 3 }));
    const f = fakeFetch([[/players\?team=228&season=2026&page=1/, p1], [/players\?team=228&season=2026&page=2/, "api-football/players-228-p2.json"], ...dailyRoutes().slice(0, 3).filter((x) => !/players\?/.test(String(x[0]))), [/teams\/statistics/, "api-football/team-stats-94.json"], [/injuries/, "api-football/injuries-team.json"]] as Array<[RegExp, string | object]>);
    await syncTeamDaily(deps(f));
    const first = (await get("playerStats_2026"))!.players[0];
    expect(first.byLeague).toEqual({
      "94": { appearances: 11, minutes: 830, goals: 5, assists: 2 },
      "96": { appearances: 0, minutes: 90, goals: 0, assists: 3 },
    });
    expect(first).toMatchObject({ appearances: 11, minutes: 920, goals: 5, assists: 5 });
    expect((await get("playerStats_2026"))!.players[1].byLeague).toEqual({ "94": expect.objectContaining({ appearances: expect.any(Number) }) });
  });

  it("treinador: com duas entradas abertas no 228 vence o start mais recente", async () => {
    await seedLeague();
    const co = load("coachs-228.json");
    const old = JSON.parse(JSON.stringify(co.response[0]));
    old.id = 4002;
    old.name = "Interino";
    old.career[0].start = "2025-01-01";
    co.response.unshift(old);
    const routes = dailyRoutes().map((x) => (/coachs/.test(String(x[0])) ? ([x[0], co] as [RegExp, object]) : x));
    await syncTeamDaily(deps(fakeFetch(routes)));
    expect(await get("coach")).toMatchObject({ id: "4001", since: "2026-01-01" });
  });

  it("lesões: só os próximos 14 dias e os últimos 3", async () => {
    await seedLeague();
    const inj = load("injuries-team.json");
    const mk = (id: number, date: string) => {
      const x = JSON.parse(JSON.stringify(inj.response[0]));
      x.player.id = id;
      x.fixture = { id: id * 10, timezone: "UTC", date, timestamp: Date.parse(date) / 1000 };
      return x;
    };
    inj.response = [mk(1, "2026-11-14T12:00:00+00:00"), mk(2, "2026-11-13T11:00:00+00:00"), mk(3, "2026-12-01T12:00:00+00:00"), mk(4, "2026-12-02T12:00:00+00:00"), mk(5, "2026-11-17T12:00:00+00:00")];
    const routes = dailyRoutes().map((x) => (/injuries/.test(String(x[0])) ? ([x[0], inj] as [RegExp, object]) : x));
    await syncTeamDaily(deps(fakeFetch(routes)));
    const items = (await get("injuries"))!.items as { playerId: string; fixtureId: string }[];
    expect(items.map((i) => i.playerId).sort()).toEqual(["1", "3", "5"]);
    expect(items.find((i) => i.playerId === "1")).toMatchObject({ fixtureId: "10", type: "Missing Fixture", reason: "Muscle Injury" });
  });

  it("uma falha não descarta as outras; o erro de quota pára os restantes", async () => {
    await seedLeague();
    const alert = jest.spyOn(logger, "error").mockImplementation(() => undefined);
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    const routes = dailyRoutes().map((x) => (/coachs/.test(String(x[0])) ? ([x[0], { status: 500 }] as [RegExp, object]) : x));
    const r = await syncTeamDaily(deps(fakeFetch(routes)));
    expect(r.failed).toBe(1);
    expect((await get("squad"))!.players).toHaveLength(30);
    expect(await get("coach")).toBeUndefined();
    // A função não alerta: o detalhe fica em warn e o alerta sai uma vez, do runJob.
    expect(alert).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("syncTeamDaily"));
    await runJob(db, "football_team_daily", () => syncTeamDaily(deps(fakeFetch(routes))));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith("INGEST_ALERT", expect.objectContaining({ source: "football_team_daily" }));

    const f = fakeFetch([[/.*/, { status: 429 }]]);
    await expect(syncTeamDaily(deps(f))).rejects.toThrow(/falharam/);
    expect(f.calls).toHaveLength(1);
  });

  it("plantel vazio: o documento existente fica e o alerta expectNonZero dispara", async () => {
    await db.doc(`${TEAM}/data/squad`).set({ players: [{ id: "1", name: "Velho", age: 1, number: 1, position: "x", photo: null }] });
    const alert = jest.spyOn(logger, "error").mockImplementation(() => undefined);
    const f = fakeFetch([[/.*/, envelope([])]]);
    await runJob(db, "football_team_daily", () => syncTeamDaily(deps(f)), { expectNonZero: true });
    expect(((await get("squad"))!.players as unknown[]).length).toBe(1);
    expect(alert).toHaveBeenCalledWith("INGEST_ALERT", expect.objectContaining({ reason: expect.stringContaining("0 registos") }));
  });
});

describe("syncTeamWeekly", () => {
  const trophiesFor = (url: string) => {
    const ids = new URL(url).searchParams.get("players")!.split("-");
    return envelope(ids.map((id) => ({ player: Number(id), league: "Primeira Liga", country: "Portugal", season: "2024/2025", place: "Winner" })));
  };
  const weeklyRoutes = () =>
    [
      [/transfers/, "api-football/transfers-228.json"],
      [/trophies\?coach=4001/, "api-football/trophies.json"],
      [/trophies\?players=/, (url: string) => trophiesFor(url)],
      [/sidelined/, "api-football/sidelined.json"],
    ] as Array<[RegExp, never]>;

  async function seedSquadAndCoach() {
    await syncTeamDaily(deps(fakeFetch(dailyRoutes())));
  }

  it("transferências: só as do 228 das últimas 2 épocas, com o emblema novo", async () => {
    await seedLeague();
    await seedSquadAndCoach();
    const tr = load("transfers-228.json");
    const mk = (id: number, date: string, inId: number, outId: number) => ({
      player: { id, name: `P${id}` },
      update: date,
      transfers: [{ date, type: "Free", teams: { in: { id: inId, name: "A", logo: "x" }, out: { id: outId, name: "B", logo: "x" } } }],
    });
    tr.response.push(mk(9003, "2024-01-10", 228, 500), mk(9004, "2026-09-01", 600, 700));
    const f = fakeFetch([[/transfers/, tr], ...weeklyRoutes().slice(1)] as Array<[RegExp, never]>);
    await syncTeamWeekly(deps(f));
    const t = (await get("transfers"))!.items;
    expect(t).toHaveLength(2);
    expect(t.map((x: { playerId: string }) => x.playerId)).toEqual(["9001", "9002"]);
    expect(t[0]).toMatchObject({ playerId: "9001", direction: "in", date: "2026-08-29" });
    expect(t[0].in.logo).toBe(SPORTING_CREST_URL);
    expect(t[1].out.logo).toBe(SPORTING_CREST_URL);
  });

  it("30 jogadores: 2 chamadas de troféus, 1 do treinador e 2 de sidelined", async () => {
    await seedLeague();
    await seedSquadAndCoach();
    const f = fakeFetch(weeklyRoutes());
    const r = await syncTeamWeekly(deps(f));
    expect(f.calls.filter((u) => /trophies\?players=/.test(u))).toHaveLength(2);
    expect(f.calls.filter((u) => /trophies\?coach=/.test(u))).toHaveLength(1);
    expect(f.calls.filter((u) => /sidelined/.test(u))).toHaveLength(2);
    expect(r.failed).toBe(0);
    const tr = (await get("trophies"))!;
    expect(Object.keys(tr.byPlayer)).toHaveLength(30);
    expect(tr.byPlayer["5000"][0]).toMatchObject({ league: "Primeira Liga", place: "Winner" });
    expect(tr.coach).toHaveLength(2);
    const sd = (await get("sidelined"))!;
    expect(sd.byPlayer["5007"]).toEqual([{ type: "Knee Injury", start: "2026-10-01", end: "2026-12-01" }]);
  });

  it("errors.players na primeira resposta: uma chamada por jogador", async () => {
    await seedLeague();
    await seedSquadAndCoach();
    const reject = envelope([], { errors: { players: "The Players field must contain between 1 and 1 characters." } });
    const f = fakeFetch([
      [/transfers/, "api-football/transfers-228.json"],
      [/trophies\?coach=4001/, "api-football/trophies.json"],
      [/trophies\?players=\d+-/, reject],
      [/trophies\?players=\d+$/, "api-football/trophies.json"],
      [/sidelined\?players=\d+-/, reject],
      [/sidelined\?players=\d+$/, envelope([{ sidelined: [{ type: "Flu", start: "2026-11-01", end: null }] }])],
    ]);
    const info = jest.spyOn(logger, "info").mockImplementation(() => undefined);
    await syncTeamWeekly(deps(f));
    expect(f.calls.filter((u) => /trophies\?players=\d+$/.test(u))).toHaveLength(30);
    expect(f.calls.filter((u) => /sidelined\?players=\d+$/.test(u))).toHaveLength(30);
    expect(info).toHaveBeenCalledWith(expect.stringMatching(/troféus, 32 chamadas/));
    expect((await get("trophies"))!.byPlayer["5029"]).toHaveLength(2);
    expect((await get("sidelined"))!.byPlayer["5029"]).toEqual([{ type: "Flu", start: "2026-11-01", end: null }]);
  });

  it("troféus sem `player` num lote múltiplo: cai para uma chamada por jogador, com atribuição certa", async () => {
    await seedLeague();
    await seedSquadAndCoach();
    const f = fakeFetch([
      [/transfers/, "api-football/transfers-228.json"],
      [/trophies\?coach=4001/, "api-football/trophies.json"],
      [/trophies\?players=\d+-/, "api-football/trophies.json"],
      [/trophies\?players=5003$/, "api-football/trophies.json"],
      [/trophies\?players=\d+$/, envelope([])],
      [/sidelined/, "api-football/sidelined.json"],
    ]);
    await syncTeamWeekly(deps(f));
    expect(f.calls.filter((u) => /trophies\?players=\d+-/.test(u))).toHaveLength(2);
    expect(f.calls.filter((u) => /trophies\?players=\d+$/.test(u))).toHaveLength(30);
    const by = (await get("trophies"))!.byPlayer;
    expect(by["5003"]).toHaveLength(2);
    expect(by["5004"]).toEqual([]);
  });

  it("sidelined: ignora linhas com id fora do lote", async () => {
    await seedLeague();
    await seedSquadAndCoach();
    const sd = load("sidelined.json");
    sd.response.push({ id: 99999, sidelined: [{ type: "X", start: "2026-01-01", end: null }] });
    const f = fakeFetch([...weeklyRoutes().filter((x) => !/sidelined/.test(String(x[0]))), [/sidelined/, sd]] as Array<[RegExp, never]>);
    await syncTeamWeekly(deps(f));
    const by = (await get("sidelined"))!.byPlayer;
    expect(by["99999"]).toBeUndefined();
    expect(by["5007"]).toHaveLength(1);
  });
});
