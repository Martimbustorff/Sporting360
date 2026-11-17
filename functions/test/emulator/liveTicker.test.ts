import * as fs from "fs";
import * as path from "path";
import { deleteApp, getApps } from "firebase-admin/app";
import type { Firestore } from "firebase-admin/firestore";
import { liveTickerJob, tick, type TickDeps } from "../../src/football/liveTicker";
import { mapFixture } from "../../src/football/mapFixture";
import { legacyFromFixture } from "../../src/legacy/footballLegacy";
import { apiFootball } from "../../src/sources/apiFootball";
import { saveMatch } from "../../src/store/writer";
import { clearAll, testDb } from "../helpers/emulatorDb";
import { fakeFetch } from "../helpers/fakeFetch";
import { seedFootballMatch } from "../helpers/seedMatch";

const FIX = path.join(__dirname, "..", "fixtures", "api-football");
const load = (n: string) => JSON.parse(fs.readFileSync(path.join(FIX, n), "utf8"));
const MIN = 60_000;
const KO = new Date("2026-11-22T20:00:00Z").getTime();
const ID = "1500003";

let db: Firestore;
beforeAll(() => {
  db = testDb("live-ticker-test");
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});

// Relógio falso: só avança com `sleep` e (opcionalmente) com cada pedido à API.
let clock = KO;
let fetchMs = 0;
let sleeps: number[] = [];
beforeEach(async () => {
  await clearAll(db);
  clock = KO;
  fetchMs = 0;
  sleeps = [];
});

type Fake = ReturnType<typeof fakeFetch>;
function deps(f: Fake): TickDeps {
  const timed = (async (input: string | URL | Request, init?: RequestInit) => {
    clock += fetchMs;
    return f(input, init);
  }) as typeof fetch;
  return {
    db,
    api: apiFootball({ key: "k", fetch: timed }),
    now: () => new Date(clock),
    sleep: async (ms: number) => {
      sleeps.push(ms);
      clock += ms;
    },
  };
}

/** Fixture da pasta com alterações (status, elapsed, liga). */
function fx(name: string, o: { elapsed?: number; league?: number } = {}) {
  const f = load(name).response[0];
  if (o.elapsed !== undefined) f.fixture.status.elapsed = o.elapsed;
  if (o.league !== undefined) {
    f.league.id = o.league;
    f.league.name = o.league === 96 ? "Taça de Portugal" : o.league === 667 ? "Friendlies Clubs" : f.league.name;
  }
  return f;
}
const envelope = (response: unknown) => ({ get: "x", parameters: {}, errors: [], results: 1, paging: { current: 1, total: 1 }, response });
const byIds = /fixtures\?ids=/;
const only = (f: Fake, re: RegExp) => f.calls.filter((u) => re.test(u));

/** Guarda o jogo tal como o ticker/calendário o deixariam a partir de um fixture. */
async function seedFrom(f: ReturnType<typeof fx>, now: number) {
  const { match, details } = mapFixture(f, { now: new Date(now), previous: null, observedLive: true });
  await saveMatch(db, { match, details, legacy: legacyFromFixture(f, match, null) }, { prefix: "" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const competitionRoutes = (league: number): Array<[RegExp, any]> => [
  [new RegExp(`standings\\?league=${league}&`), league === 94 ? "api-football/standings-94.json" : envelope([])],
  [new RegExp(`fixtures/rounds\\?league=${league}&`), "api-football/rounds-94.json"],
  [new RegExp(`fixtures\\?league=${league}&season=2026$`), league === 94 ? "api-football/fixtures-league.json" : "api-football/fixtures-cup-96.json"],
  [new RegExp(`players/top(scorers|assists|yellowcards|redcards)\\?league=${league}&`), "api-football/topscorers-94.json"],
];

describe("tick: sem nada a fazer", () => {
  it("sem jogos na janela → calls 0 e nenhum pedido", async () => {
    const f = fakeFetch([]);
    const r = await tick(deps(f));
    expect(r).toMatchObject({ calls: 0, ids: [] });
    expect(f.calls).toHaveLength(0);
    expect(sleeps).toEqual([]);
  });

  it("jogo NS daqui a 3 h (fora do prematch) → calls 0", async () => {
    await seedFrom(fx("fixture-ns.json"), KO - 4 * 60 * MIN);
    clock = KO - 3 * 60 * MIN;
    const f = fakeFetch([]);
    expect((await tick(deps(f))).calls).toBe(0);
    expect(f.calls).toHaveLength(0);
  });

  it("jogo PST com kickoff há 10 min → 0 chamadas", async () => {
    await seedFrom(fx("fixture-pst.json"), KO - 60 * MIN);
    clock = KO + 10 * MIN;
    const f = fakeFetch([]);
    expect((await tick(deps(f))).calls).toBe(0);
    expect(f.calls).toHaveLength(0);
  });
});

describe("tick: jogo a decorrer", () => {
  it("LIVE → 4 chamadas alinhadas a 0/15/30/45 s; fica o valor da 4.ª resposta", async () => {
    clock = KO + 67 * MIN; // 21:07, minuto que não é múltiplo de 15
    await seedFrom(fx("fixture-live-2h.json"), clock);
    const f = fakeFetch([[byIds, (_u, n) => envelope([fx("fixture-live-2h.json", { elapsed: 67 + n })])]]);
    const r = await tick(deps(f));
    expect(r.calls).toBe(4);
    expect(r.ids).toEqual([ID]);
    expect(only(f, byIds)).toHaveLength(4);
    expect(f.calls.every((u) => u.includes(`ids=${ID}`))).toBe(true);
    expect(sleeps).toEqual([15_000, 15_000, 15_000]);
    expect((await db.doc(`games/${ID}`).get()).get("elapsedTime")).toBe("70");
    expect((await db.doc(`matches/${ID}`).get()).get("elapsed")).toBe(70);
  });

  it("com pedidos de 1 s, as esperas descontam o tempo gasto (14 s)", async () => {
    clock = KO + 67 * MIN;
    fetchMs = 1_000;
    await seedFrom(fx("fixture-live-2h.json"), clock);
    const f = fakeFetch([[byIds, envelope([fx("fixture-live-2h.json")])]]);
    const r = await tick(deps(f));
    expect(r.calls).toBe(4);
    expect(sleeps).toEqual([14_000, 14_000, 14_000]);
  });

  it("pedidos lentos (20 s): sem esperas e pára aos 50 s (3 chamadas)", async () => {
    clock = KO + 67 * MIN;
    fetchMs = 20_000;
    await seedFrom(fx("fixture-live-2h.json"), clock);
    const f = fakeFetch([[byIds, envelope([fx("fixture-live-2h.json")])]]);
    const r = await tick(deps(f));
    expect(r.calls).toBe(3);
    expect(sleeps).toEqual([]);
  });

  it("duas respostas iguais seguidas: a segunda iteração escreve 0 documentos", async () => {
    clock = KO + 47 * MIN;
    await seedFrom(fx("fixture-ht.json"), clock);
    const f = fakeFetch([[byIds, envelope([fx("fixture-live-2h.json", { elapsed: 47 })])]]);
    const r = await tick(deps(f));
    expect(r.writes[0]).toBeGreaterThan(0);
    expect(r.writes.slice(1)).toEqual([0, 0, 0]);
  });

  it("Review Focus 3: 2H 90' → ET 105' → P → PEN mantém 4 chamadas por minuto; PEN fixa finishedAt observado", async () => {
    clock = KO + 112 * MIN; // 21:52
    await seedFrom(fx("fixture-live-2h.json", { elapsed: 90 }), clock);
    const seq = (_u: string, n: number) => {
      if (n === 0) return envelope([fx("fixture-live-2h.json", { elapsed: 90 })]);
      if (n < 8) return envelope([fx("fixture-et.json")]);
      if (n < 12) return envelope([fx("fixture-p.json")]);
      return envelope([fx("fixture-pen.json")]);
    };
    const f = fakeFetch([[byIds, seq], ...competitionRoutes(94)]);
    const d = deps(f);

    // minuto 1: 2H → ET; minuto 2: ET
    expect((await tick(d)).calls).toBe(4);
    clock = KO + 113 * MIN;
    expect((await tick(d)).calls).toBe(4);
    expect((await db.doc(`matches/${ID}`).get()).get("statusRaw")).toBe("ET");
    // minuto 3: P (continua a contar como LIVE)
    clock = KO + 114 * MIN;
    expect((await tick(d)).calls).toBe(4);
    expect((await db.doc(`matches/${ID}`).get()).get("statusRaw")).toBe("P");
    expect((await db.doc(`matches/${ID}`).get()).get("finishedAt")).toBeNull();

    // minuto 4: PEN na 1.ª iteração
    clock = KO + 116 * MIN + 1_000;
    const penNow = clock;
    const r = await tick(d);
    expect(only(f, byIds)).toHaveLength(13);
    expect(r.calls).toBe(1 + 7); // 1 fixture + fim de jogo (standings, rondas, calendário, 4 tops)
    const m = (await db.doc(`matches/${ID}`).get()).data()!;
    expect(m.status).toBe("PEN");
    expect(m.finishedAt.toMillis()).toBe(penNow);
    expect(m.finishedAtSource).toBe("observed");
    expect(m.score).toMatchObject({ home: 2, away: 2, penalty: { home: 4, away: 3 }, extratime: { home: 0, away: 0 } });
    const g = (await db.doc(`games/${ID}`).get()).data()!;
    expect(g.scorehome).toBe("2");
    expect(g.scoreaway).toBe("2");
    expect(g.isActive).toBe(false);
  });

  it("Review Focus 2: rate limit a meio → detalhes ficam, consecutiveFailures 1, a iteração seguinte continua", async () => {
    clock = KO + 67 * MIN;
    await seedFrom(fx("fixture-live-2h.json"), clock);
    const f = fakeFetch([
      [byIds, [envelope([fx("fixture-live-2h.json", { elapsed: 67 })]), "api-football/errors-ratelimit.json", envelope([fx("fixture-live-2h.json", { elapsed: 69 })])]],
    ]);
    await liveTickerJob(deps(f));
    expect(only(f, byIds)).toHaveLength(4);
    const h = (await db.doc("ingestHealth/football_live").get()).data()!;
    expect(h.consecutiveFailures).toBe(1);
    expect(h.lastError).toMatch(/1 de 4|rate|limit|request/i);
    expect((await db.doc(`matches/${ID}/details/events`).get()).get("items")).toHaveLength(6);
    expect((await db.doc(`matches/${ID}/details/lineups`).get()).exists).toBe(true);
    expect((await db.doc(`matches/${ID}`).get()).get("elapsed")).toBe(69);

    // minuto seguinte sem erros: volta a 0 e regista remaining
    clock += MIN;
    await liveTickerJob(deps(fakeFetch([[byIds, envelope([fx("fixture-live-2h.json", { elapsed: 70 })])]])));
    const h2 = (await db.doc("ingestHealth/football_live").get()).data()!;
    expect(h2.consecutiveFailures).toBe(0);
    expect(h2.lastCount).toBe(4);
  });

  it("minuto :15 com jogo live da liga 94 → 1 chamada extra de standings; minuto :16 não", async () => {
    clock = KO + 75 * MIN; // 21:15
    await seedFrom(fx("fixture-live-2h.json"), clock);
    const f = fakeFetch([[byIds, envelope([fx("fixture-live-2h.json")])], ...competitionRoutes(94)]);
    const r = await tick(deps(f));
    expect(r.calls).toBe(5);
    expect(only(f, /standings\?league=94&season=2026/)).toHaveLength(1);
    expect((await db.doc("competitions/football_94_2026/data/standings").get()).exists).toBe(true);

    clock = KO + 76 * MIN;
    const f2 = fakeFetch([[byIds, envelope([fx("fixture-live-2h.json")])]]);
    expect((await tick(deps(f2))).calls).toBe(4);
  });

  it("particular ao minuto :15 → sem standings", async () => {
    clock = KO + 75 * MIN;
    await seedFrom(fx("fixture-live-2h.json", { league: 667 }), clock);
    const f = fakeFetch([[byIds, envelope([fx("fixture-live-2h.json", { league: 667 })])]]);
    expect((await tick(deps(f))).calls).toBe(4);
  });
});

describe("tick: antes do jogo", () => {
  it("NS a 60 min → 1 chamada; com lineups escreve details/lineups e lineups/*", async () => {
    clock = KO - 60 * MIN;
    await seedFrom(fx("fixture-ns.json"), clock);
    const f = fakeFetch([[byIds, "api-football/fixture-ns-lineups.json"]]);
    const r = await tick(deps(f));
    expect(r.calls).toBe(1);
    expect(r.ids).toEqual([ID]);
    expect(sleeps).toEqual([]);
    expect((await db.doc(`matches/${ID}/details/lineups`).get()).get("teams")).toHaveLength(2);
    const legacy = await db.collection("lineups").where("GameId", "==", ID).get();
    expect(legacy.size).toBe(2);
  });

  it("NS 5 min depois do kickoff (atraso) conta como live: 4 chamadas", async () => {
    clock = KO + 5 * MIN + 7 * 1000;
    await seedFrom(fx("fixture-ns.json"), KO - 60 * MIN);
    const f = fakeFetch([[byIds, envelope([fx("fixture-ns.json")])]]);
    expect((await tick(deps(f))).calls).toBe(4);
  });
});

describe("tick: fim de jogo", () => {
  it("liga 94 passa de 2H a FT: standings + rondas + calendário + 4 tops; 25 min depois repete uma vez, aos 26 não", async () => {
    clock = KO + 112 * MIN; // 21:52
    await seedFrom(fx("fixture-live-2h.json", { elapsed: 90 }), clock);
    const f = fakeFetch([[byIds, envelope([fx("fixture-ft.json")])], ...competitionRoutes(94)]);
    const d = deps(f);
    const ftAt = clock;
    const r = await tick(d);
    expect(r.calls).toBe(1 + 7);
    expect(only(f, byIds)).toHaveLength(1); // ninguém continua live
    expect(only(f, /standings\?league=94/)).toHaveLength(1);
    expect(only(f, /fixtures\/rounds\?league=94/)).toHaveLength(1);
    expect(only(f, /fixtures\?league=94&season=2026$/)).toHaveLength(1);
    expect(only(f, /players\/top/)).toHaveLength(4);
    const std = (await db.doc("competitions/football_94_2026/data/standings").get()).data()!;
    expect(std.groups[0].rows).toHaveLength(8);
    expect((await db.doc("competitions/football_94_2026/data/topscorers").get()).exists).toBe(true);
    expect((await db.doc(`matches/${ID}`).get()).get("finishedAt").toMillis()).toBe(ftAt);

    // outro tick no mesmo minuto (postmatch): só o fixture, sem repetir o fim de jogo
    clock = ftAt + 20_000;
    expect((await tick(d)).calls).toBe(1);
    expect(only(f, /standings/)).toHaveLength(1);

    // finishedAt + 25 min: repete uma vez (sem pedir o fixture: fase idle)
    clock = ftAt + 25 * MIN;
    const r25 = await tick(d);
    expect(r25.calls).toBe(7);
    expect(only(f, byIds)).toHaveLength(2);
    expect(only(f, /standings/)).toHaveLength(2);
    // repetido no mesmo minuto e no seguinte: nada
    clock = ftAt + 25 * MIN + 30_000;
    expect((await tick(d)).calls).toBe(0);
    clock = ftAt + 26 * MIN;
    expect((await tick(d)).calls).toBe(0);
    expect(only(f, /standings/)).toHaveLength(2);
  });

  it("taça (96) a terminar: standings e calendário, sem tops", async () => {
    clock = KO + 112 * MIN;
    await seedFrom(fx("fixture-live-2h.json", { elapsed: 90, league: 96 }), clock);
    const f = fakeFetch([[byIds, envelope([fx("fixture-ft.json", { league: 96 })])], ...competitionRoutes(96)]);
    const r = await tick(deps(f));
    expect(r.calls).toBe(1 + 3);
    expect(only(f, /standings\?league=96/)).toHaveLength(1);
    expect(only(f, /fixtures\?league=96&season=2026$/)).toHaveLength(1);
    expect(only(f, /players\/top/)).toHaveLength(0);
    expect((await db.doc("competitions/football_96_2026/data/fixtures").get()).exists).toBe(true);
  });

  it("particular a terminar: sem refrescos de competição", async () => {
    clock = KO + 112 * MIN;
    await seedFrom(fx("fixture-live-2h.json", { elapsed: 90, league: 667 }), clock);
    const f = fakeFetch([[byIds, envelope([fx("fixture-ft.json", { league: 667 })])]]);
    expect((await tick(deps(f))).calls).toBe(1);
    clock += 25 * MIN;
    expect((await tick(deps(f))).calls).toBe(0);
  });

  it("refresco de fim de jogo que falha repete no minuto seguinte (a marca só fica com sucesso)", async () => {
    clock = KO + 112 * MIN;
    await seedFrom(fx("fixture-live-2h.json", { elapsed: 90 }), clock);
    const routes = competitionRoutes(94);
    const f = fakeFetch([[byIds, envelope([fx("fixture-ft.json")])], [/standings/, [{ status: 500 }, "api-football/standings-94.json"]], ...routes.slice(1)]);
    const r1 = await tick(deps(f));
    expect(r1.failed).toBe(1);
    clock += MIN;
    const r2 = await tick(deps(f));
    expect(r2.failed).toBe(0);
    expect(only(f, /standings/)).toHaveLength(2);
    clock += MIN;
    await tick(deps(f));
    expect(only(f, /standings/)).toHaveLength(2);
  });

  it("FT há 30 min (ratings) → 1 chamada", async () => {
    clock = KO + 110 * MIN;
    await seedFrom(fx("fixture-ft.json"), clock);
    await db.doc(`ingestState/match_${ID}`).set({ ticker: { endRefresh: true, postRefresh: true } }, { merge: true });
    clock += 30 * MIN;
    const f = fakeFetch([[byIds, "api-football/fixture-ft.json"]]);
    expect((await tick(deps(f))).calls).toBe(1);
  });

  it("jogo terminado só pelo calendário (sem ticker): o refresco de fim de jogo corre no postmatch", async () => {
    await seedFootballMatch(db, { id: "1500009", kickoff: new Date(KO), finishedAt: new Date(KO + 110 * MIN), finishedAtSource: "estimated" });
    clock = KO + 115 * MIN;
    const f = fakeFetch([[byIds, envelope([{ ...fx("fixture-ft.json"), fixture: { ...fx("fixture-ft.json").fixture, id: 1500009 } }])], ...competitionRoutes(94)]);
    const r = await tick(deps(f));
    expect(r.calls).toBe(1 + 7);
  });
});
