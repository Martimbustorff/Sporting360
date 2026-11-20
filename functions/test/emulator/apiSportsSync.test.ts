import * as fs from "fs";
import * as path from "path";
import { deleteApp, getApps } from "firebase-admin/app";
import type { Firestore } from "firebase-admin/firestore";
import { SPORTING_CREST_URL } from "../../src/config/brand";
import { logger } from "firebase-functions";
import { runApiSportsJob, syncApiSports, type ApiSportsConfig } from "../../src/modalities/apiSportsSync";
import { API_SPORTS } from "../../src/modalities/sourcesConfig";
import { apiSports } from "../../src/sources/apiSports";
import { clearAll, testDb } from "../helpers/emulatorDb";
import { fakeFetch } from "../helpers/fakeFetch";

const NOW = new Date("2026-11-18T12:00:00Z");
const MIN = 60_000;
const SPORTS = ["handball", "volleyball", "basketball"] as const;

let db: Firestore;
beforeAll(() => {
  db = testDb("api-sports-sync-test");
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});
beforeEach(async () => {
  await clearAll(db);
});

// Ids de liga e do Sporting inventados (a fixture usa a equipa 0): os reais ficam para a gravação (Task 21).
const cfg = (over: Partial<Record<(typeof SPORTS)[number], Partial<ApiSportsConfig["handball"]>>> = {}): ApiSportsConfig => ({
  handball: { ...API_SPORTS.handball, enabled: true, teamId: 0, leagues: [{ id: 11, name: "Andebol 1", covered: true }, { id: 12, name: "EHF European League", covered: false }, { id: null, name: "Por confirmar", covered: null }], ...over.handball },
  volleyball: { ...API_SPORTS.volleyball, enabled: true, teamId: 0, leagues: [{ id: 21, name: "Campeonato Nacional", covered: true }], ...over.volleyball },
  basketball: { ...API_SPORTS.basketball, enabled: true, teamId: 0, leagues: [{ id: 31, name: "Liga Portuguesa de Basquetebol", covered: true }], ...over.basketball },
});

const json = (sport: string, file: string) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "fixtures", "api-sports", sport, file), "utf8"));

function setup(o: { headers?: Record<string, Record<string, string>>; games?: Record<string, object>; standings?: Record<string, object | ((url: string) => object)> } = {}) {
  const fetches = {} as Record<(typeof SPORTS)[number], ReturnType<typeof fakeFetch>>;
  const clients = {} as Record<(typeof SPORTS)[number], ReturnType<typeof apiSports>>;
  for (const s of SPORTS) {
    const h = o.headers?.[s];
    fetches[s] = fakeFetch([
      [/\/games\?/, o.games?.[s] ?? { status: 200, body: json(s, "games.json"), headers: h }],
      [/\/standings\?/, (o.standings?.[s] ?? { status: 200, body: json(s, "standings.json"), headers: h }) as never],
    ]);
    clients[s] = apiSports({ sport: s, key: "k", fetch: fetches[s] });
  }
  const calls = (s: (typeof SPORTS)[number], kind: "games" | "standings") => fetches[s].calls.filter((u) => u.includes(`/${kind}?`));
  const total = () => SPORTS.reduce((n, s) => n + fetches[s].calls.length, 0);
  return { fetches, clients, calls, total };
}

const deps = (s: ReturnType<typeof setup>, now: Date, config: ApiSportsConfig = cfg()) => ({ db, clients: s.clients, now: () => now, config });

describe("syncApiSports", () => {
  it("tudo devido: 3 chamadas de jogos + classificações das ligas cobertas; só modelo novo", async () => {
    const s = setup();
    const r = await syncApiSports(deps(s, NOW));
    expect(r).toMatchObject({ count: 6, failed: 0 });
    for (const sp of SPORTS) expect(s.calls(sp, "games")).toHaveLength(1);
    expect(s.calls("handball", "games")[0]).toMatch(/team=0&season=2026/);
    expect(s.calls("basketball", "games")[0]).toMatch(/season=2026-2027/);
    expect(s.calls("handball", "standings")).toHaveLength(1);
    expect(s.calls("handball", "standings")[0]).toMatch(/league=11&/);
    expect(s.calls("volleyball", "standings")).toHaveLength(1);
    expect(s.calls("basketball", "standings")).toHaveLength(1);

    const hb1 = (await db.doc("matches/hb_1").get()).data()!;
    expect(hb1).toMatchObject({ sport: "handball", status: "FT", score: { home: 30, away: 25 } });
    expect(hb1.home.logo).toBe(SPORTING_CREST_URL);
    expect((await db.doc("matches/hb_2").get()).exists).toBe(true);
    expect((await db.doc("matches/vb_1").get()).exists).toBe(true);
    expect((await db.doc("matches/bb_2").get()).exists).toBe(true);
    expect((await db.collection("games").get()).empty).toBe(true);

    const st = (await db.doc("competitions/handball_11_2026/data/standings").get()).data()!;
    expect(st.groups[0].rows[0]).toMatchObject({ rank: 1, name: "Sporting CP", points: 8, played: 5, win: 4, lose: 1, goalsFor: 150, goalsAgainst: 120, logo: SPORTING_CREST_URL });
    expect((await db.doc("competitions/handball_11_2026").get()).get("name")).toBe("Andebol 1");

    const h = (await db.doc("ingestHealth/apisports_handball").get()).data()!;
    expect(h.lastCount).toBe(2);
    expect(h.lastError).toBeNull();
  });

  it("liga covered:false ou sem id: nenhuma chamada de classificação", async () => {
    const s = setup();
    await syncApiSports(deps(s, NOW));
    const urls = s.calls("handball", "standings");
    expect(urls).toHaveLength(1);
    expect(urls.some((u) => /league=12/.test(u))).toBe(false);
    expect(urls.some((u) => /league=null/.test(u))).toBe(false);
  });

  it("segunda execução 10 min depois, sem jogos: 0 chamadas", async () => {
    const s = setup();
    await syncApiSports(deps(s, NOW));
    const before = s.total();
    const r = await syncApiSports(deps(s, new Date(NOW.getTime() + 10 * MIN)));
    expect(s.total()).toBe(before);
    expect(r).toMatchObject({ count: 0, failed: 0 });
  });

  it("jogo a começar daqui a 10 min: só essa modalidade volta a pedir jogos, sem classificações", async () => {
    const s = setup();
    await syncApiSports(deps(s, NOW));
    const kickoff = new Date(NOW.getTime() + 20 * MIN);
    await db.doc("matches/hb_2").set({ sport: "handball", kickoff }, { merge: true });
    const before = s.total();
    await syncApiSports(deps(s, new Date(NOW.getTime() + 10 * MIN)));
    expect(s.total() - before).toBe(1);
    expect(s.calls("handball", "games")).toHaveLength(2);
  });

  it("passadas 6 h, as classificações voltam a ser pedidas", async () => {
    const s = setup();
    await syncApiSports(deps(s, NOW));
    await syncApiSports(deps(s, new Date(NOW.getTime() + 181 * MIN)));
    expect(s.calls("handball", "standings")).toHaveLength(1);
    await syncApiSports(deps(s, new Date(NOW.getTime() + 362 * MIN)));
    expect(s.calls("handball", "standings")).toHaveLength(2);
    expect(s.calls("handball", "games")).toHaveLength(3);
  });

  it("jogo locked não é reescrito", async () => {
    await db.doc("matches/hb_1").set({ id: "hb_1", sport: "handball", locked: true, score: { home: 99, away: 0 }, status: "FT" });
    const s = setup();
    await syncApiSports(deps(s, NOW));
    const m = (await db.doc("matches/hb_1").get()).data()!;
    expect(m.score).toEqual({ home: 99, away: 0 });
    expect((await db.doc("matches/hb_2").get()).exists).toBe(true);
  });

  it("modalidade desligada ou sem id da equipa: 0 chamadas e saúde sem falha", async () => {
    const s = setup();
    const r = await syncApiSports(deps(s, NOW, cfg({ handball: { enabled: false }, volleyball: { teamId: null } })));
    expect(s.fetches.handball.calls).toHaveLength(0);
    expect(s.fetches.volleyball.calls).toHaveLength(0);
    expect(s.calls("basketball", "games")).toHaveLength(1);
    expect(r.failed).toBe(0);
    expect((await db.doc("ingestHealth/apisports_handball").get()).exists).toBe(false);
    expect((await db.doc("ingestHealth/apisports_volleyball").get()).exists).toBe(false);
  });

  it("configuração real (ligada a 20/11): por modalidade 1 pedido de jogos e 1 de tabela (só a liga; taças sem tabela)", async () => {
    const s = setup();
    await syncApiSports({ db, clients: s.clients, now: () => NOW });
    expect(s.total()).toBe(6);
    for (const sport of ["handball", "volleyball", "basketball"] as const) {
      expect(s.calls(sport, "games")).toHaveLength(1);
      expect(s.calls(sport, "standings")).toHaveLength(1);
    }
  });

  it("429 numa modalidade pára essa modalidade (sem classificações); as outras seguem", async () => {
    const s = setup({ games: { handball: { status: 429, body: {} } } });
    const r = await syncApiSports(deps(s, NOW));
    expect(s.calls("handball", "games")).toHaveLength(1);
    expect(s.calls("handball", "standings")).toHaveLength(0);
    expect((await db.doc("matches/vb_1").get()).exists).toBe(true);
    expect((await db.doc("matches/bb_1").get()).exists).toBe(true);
    expect(r.failed).toBe(1);
    const h = (await db.doc("ingestHealth/apisports_handball").get()).data()!;
    expect(h.consecutiveFailures).toBe(1);
    expect(h.lastError).toMatch(/429/);
  });

  it("restam menos de 10 pedidos: pára a modalidade e devolve remaining", async () => {
    const s = setup({ headers: { handball: { "x-ratelimit-requests-remaining": "5" }, volleyball: { "x-ratelimit-requests-remaining": "80" } } });
    const r = await syncApiSports(deps(s, NOW));
    expect(s.calls("handball", "games")).toHaveLength(1);
    expect(s.calls("handball", "standings")).toHaveLength(0);
    expect(s.calls("volleyball", "standings")).toHaveLength(1);
    expect(r.remainingBySport).toEqual({ handball: 5, volleyball: 80, basketball: null });
    expect(r.remaining).toBe(5);
    expect(r.failed).toBe(0);
  });

  it("quota baixa na execução anterior: não volta a pedir nas 3 h seguintes, mesmo com jogo", async () => {
    const s = setup({ headers: { handball: { "x-ratelimit-requests-remaining": "5" } } });
    await syncApiSports(deps(s, NOW));
    await db.doc("matches/hb_2").set({ sport: "handball", kickoff: new Date(NOW.getTime() + 20 * MIN) }, { merge: true });
    await syncApiSports(deps(s, new Date(NOW.getTime() + 10 * MIN)));
    expect(s.calls("handball", "games")).toHaveLength(1);
    await syncApiSports(deps(s, new Date(NOW.getTime() + 181 * MIN)));
    expect(s.calls("handball", "games")).toHaveLength(2);
  });

  it("todas as modalidades a falhar: lança", async () => {
    const bad = { status: 500, body: {} };
    const s = setup({ games: { handball: bad, volleyball: bad, basketball: bad } });
    await expect(syncApiSports(deps(s, NOW))).rejects.toThrow();
  });

  it("jogos de ligas covered:false não são gravados aqui (Task 17)", async () => {
    const games = json("handball", "games.json");
    games.response = games.response.map((g: { league: object }) => ({ ...g, league: { ...g.league, id: 12 } }));
    const s = setup({ games: { handball: games } });
    await syncApiSports(deps(s, NOW));
    expect((await db.doc("matches/hb_1").get()).exists).toBe(false);
    expect((await db.doc("matches/vb_1").get()).exists).toBe(true);
  });
});

const two = cfg({ handball: { leagues: [{ id: 11, name: "Andebol 1", covered: true }, { id: 13, name: "Taça de Portugal", covered: true }] } });
const fresh = (at: Date) => ({ standingsAt: { "11": at, "13": at }, lastRemaining: null });
const gameBody = (over: object) => {
  const b = json("handball", "games.json");
  b.response = [{ ...b.response[0], id: 9, ...over }];
  return b;
};

describe("runApiSportsJob (o que o scheduler corre)", () => {
  afterEach(() => jest.restoreAllMocks());

  it("1 modalidade a falhar gera um só INGEST_ALERT (o da própria modalidade); a quota fica na saúde", async () => {
    const alert = jest.spyOn(logger, "error").mockImplementation(() => undefined);
    jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    const s = setup({
      headers: { volleyball: { "x-ratelimit-requests-remaining": "80" } },
      games: { handball: { status: 500, body: {} } },
    });
    await runApiSportsJob(db, deps(s, NOW));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith("INGEST_ALERT", expect.objectContaining({ source: "apisports_handball" }));
    const h = (await db.doc("ingestHealth/apisports").get()).data()!;
    expect(h.lastFailed).toBe(0);
    expect(h.remaining).toBe(80);
    expect(h.lastError).toBeNull();
  });
});

describe("syncApiSports: classificações por liga e falhas isoladas", () => {
  const stateSeed = async (sport: string, data: object) => db.doc(`ingestState/apisports_state_${sport}`).set(data);

  it("jogo LIVE -> FT: pede só a classificação dessa liga", async () => {
    await db.doc("matches/hb_9").set({ sport: "handball", status: "LIVE", kickoff: new Date(NOW.getTime() - 2 * 60 * MIN) });
    await stateSeed("handball", fresh(new Date(NOW.getTime() - MIN)));
    const kickoff = new Date(NOW.getTime() - 120 * MIN);
    const s = setup({ games: { handball: gameBody({ timestamp: kickoff.getTime() / 1000, date: kickoff.toISOString(), league: { id: 11, name: "Andebol 1", season: "2026" } }) } });
    await syncApiSports(deps(s, NOW, two));
    expect(s.calls("handball", "standings")).toHaveLength(1);
    expect(s.calls("handball", "standings")[0]).toMatch(/league=11&/);
  });

  it("jogo já final na primeira sincronização: sem classificação extra", async () => {
    await stateSeed("handball", fresh(new Date(NOW.getTime() - MIN)));
    const kickoff = new Date(NOW.getTime() - 120 * MIN);
    const s = setup({ games: { handball: gameBody({ timestamp: kickoff.getTime() / 1000, date: kickoff.toISOString(), league: { id: 11, name: "Andebol 1", season: "2026" } }) } });
    await syncApiSports(deps(s, NOW, two));
    expect(s.calls("handball", "standings")).toHaveLength(0);
  });

  it("uma liga com 500: os jogos contam, a outra é atualizada e o tick seguinte não repete a falhada", async () => {
    const ok = json("handball", "standings.json");
    const s = setup({ standings: { handball: ((url: string) => (/league=11&/.test(url) ? { status: 500, body: {} } : { status: 200, body: ok })) as never } });
    const r = await syncApiSports(deps(s, NOW, two));
    expect(r.count).toBe(6);
    expect(r.failed).toBe(1);
    expect((await db.doc("competitions/handball_13_2026/data/standings").get()).exists).toBe(true);
    expect((await db.doc("matches/hb_1").get()).exists).toBe(true);
    await db.doc("matches/hb_2").set({ sport: "handball", kickoff: new Date(NOW.getTime() + 20 * MIN) }, { merge: true });
    await syncApiSports(deps(s, new Date(NOW.getTime() + 10 * MIN), two));
    expect(s.calls("handball", "games")).toHaveLength(2);
    expect(s.calls("handball", "standings").filter((u) => /league=11&/.test(u))).toHaveLength(1);
  });

  it("falha que não é de quota não avança lastRunAt; 429 avança", async () => {
    const s = setup({ games: { handball: { status: 500, body: {} }, volleyball: { status: 429, body: {} } } });
    await syncApiSports(deps(s, NOW));
    expect((await db.doc("ingestState/apisports_state_handball").get()).get("lastRunAt")).toBeUndefined();
    expect((await db.doc("ingestState/apisports_state_volleyball").get()).get("lastRunAt")).toBeDefined();
    await expect(syncApiSports(deps(s, new Date(NOW.getTime() + 60 * MIN)))).rejects.toThrow();
    expect(s.calls("handball", "games")).toHaveLength(2);
    expect(s.calls("volleyball", "games")).toHaveLength(1);
  });

  it("500 persistente fora de janela: pedidos em t0 e t0+60 min, não a cada tick", async () => {
    const s = setup({ games: { handball: { status: 500, body: {} } } });
    for (const m of [0, 10, 20, 50]) await syncApiSports(deps(s, new Date(NOW.getTime() + m * MIN))).catch(() => undefined);
    expect(s.calls("handball", "games")).toHaveLength(1);
    await syncApiSports(deps(s, new Date(NOW.getTime() + 60 * MIN))).catch(() => undefined);
    expect(s.calls("handball", "games")).toHaveLength(2);
  });

  it("500 dentro de janela de jogo: repete no tick seguinte", async () => {
    await db.doc("matches/hb_2").set({ sport: "handball", kickoff: new Date(NOW.getTime() + 5 * MIN) });
    const s = setup({ games: { handball: { status: 500, body: {} } } });
    await syncApiSports(deps(s, NOW)).catch(() => undefined);
    await syncApiSports(deps(s, new Date(NOW.getTime() + 10 * MIN))).catch(() => undefined);
    expect(s.calls("handball", "games")).toHaveLength(2);
  });

  it("sucesso limpa lastFailureAt", async () => {
    await db.doc("ingestState/apisports_state_handball").set({ lastFailureAt: new Date(NOW.getTime() - 2 * 60 * MIN) });
    const s = setup();
    await syncApiSports(deps(s, NOW));
    expect((await db.doc("ingestState/apisports_state_handball").get()).get("lastFailureAt")).toBeUndefined();
  });

  it("lastRemaining só é substituído por valores conhecidos", async () => {
    await stateSeed("handball", { lastRemaining: 50 });
    const s = setup();
    await syncApiSports(deps(s, NOW));
    expect((await db.doc("ingestState/apisports_state_handball").get()).get("lastRemaining")).toBe(50);
  });

  it("andebol: empates em games.drawn.total", async () => {
    const std = json("handball", "standings.json");
    const row = std.response[0][0];
    row.games = { played: 5, win: { total: 3 }, drawn: { total: 1 }, lost: { total: 1 } };
    const s = setup({ standings: { handball: { status: 200, body: std } } });
    await syncApiSports(deps(s, NOW));
    const st = (await db.doc("competitions/handball_11_2026/data/standings").get()).data()!;
    expect(st.groups[0].rows[0]).toMatchObject({ draw: 1, win: 3, lose: 1 });
  });
});
