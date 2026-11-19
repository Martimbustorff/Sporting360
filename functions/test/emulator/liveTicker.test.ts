import * as fs from "fs";
import * as path from "path";
import { deleteApp, getApps } from "firebase-admin/app";
import { logger } from "firebase-functions";
import type { Firestore } from "firebase-admin/firestore";
import { LIVE_REQUEST_TIMEOUT_MS, TICK_DEADLINE_MS, liveTickerJob, tick, type TickDeps } from "../../src/football/liveTicker";
import { mapFixture } from "../../src/football/mapFixture";
import { legacyFromFixture } from "../../src/legacy/footballLegacy";
import { apiFootball } from "../../src/sources/apiFootball";
import { saveMatch } from "../../src/store/writer";
import { fakeSender } from "../helpers/fakeSender";
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
  liveCalls = [];
});

type Fake = ReturnType<typeof fakeFetch>;
const liveUrl = /fixtures\?live=all&league=/;
/** Pedidos `liveFixtures` do ticker (1 por minuto com um jogo do Sporting em liga em direto), à parte de `f.calls`. */
let liveCalls: string[] = [];
function deps(f: Fake, o: { liveResponse?: unknown } = {}): TickDeps {
  const timed = (async (input: string | URL | Request, init?: RequestInit) => {
    clock += fetchMs;
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (liveUrl.test(url)) {
      liveCalls.push(url);
      return new Response(JSON.stringify(o.liveResponse ?? envelope([])), { status: 200 });
    }
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
/** Golos no prolongamento: `extratime` e `goals` = 90' + prolongamento. */
function withEt(f: ReturnType<typeof fx>, home: number, away: number) {
  f.score.extratime = { home, away };
  f.goals = { home: f.score.fulltime.home + home, away: f.score.fulltime.away + away };
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
    expect(r.calls).toBe(4 + 1); // 4 fixtures + 1 liveFixtures (jogo do Sporting em liga)
    expect(liveCalls).toHaveLength(1);
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
    expect(r.calls).toBe(4 + 1);
    expect(sleeps).toEqual([14_000, 14_000, 14_000]);
  });

  it("pedidos lentos (20 s): nenhuma iteração começa se puder acabar depois dos 60 s (3 chamadas, sem esperas)", async () => {
    clock = KO + 67 * MIN;
    fetchMs = 20_000;
    await seedFrom(fx("fixture-live-2h.json"), clock);
    const begins: number[] = [];
    const start = clock;
    const f = fakeFetch([[byIds, () => (begins.push(clock - fetchMs - start), envelope([fx("fixture-live-2h.json")]))]]);
    const r = await tick(deps(f));
    expect(r.calls).toBe(3);
    expect(sleeps).toEqual([]);
    expect(begins).toEqual([0, 20_000, 40_000]);
    for (const b of begins) expect(b + LIVE_REQUEST_TIMEOUT_MS).toBeLessThanOrEqual(TICK_DEADLINE_MS);
  });

  it("pedidos de 12 s: a 4.ª iteração (começaria aos 56 s) não arranca", async () => {
    clock = KO + 67 * MIN;
    fetchMs = 12_000;
    await seedFrom(fx("fixture-live-2h.json"), clock);
    const f = fakeFetch([[byIds, envelope([fx("fixture-live-2h.json")])]]);
    const r = await tick(deps(f));
    // 0-12, 15-27, 30-42; a seguinte seria aos 45 s: 45 + 5 <= 60, arranca (45-57); depois não há mais
    expect(r.calls).toBe(4);
    expect(sleeps).toEqual([3_000, 3_000, 3_000]);
    fetchMs = 16_000;
    clock = KO + 70 * MIN;
    const f2 = fakeFetch([[byIds, envelope([fx("fixture-live-2h.json")])]]);
    // 0-16, 16-32, 32-48; a 4.ª começaria aos 48 s (48 + 5 <= 60): arranca e acaba aos 64; a regra é pelo timeout de 5 s
    expect((await tick(deps(f2))).calls).toBe(4);
    fetchMs = 19_000;
    clock = KO + 71 * MIN;
    const f3 = fakeFetch([[byIds, envelope([fx("fixture-live-2h.json")])]]);
    // 0-19, 19-38, 38-57; a 4.ª começaria aos 57 s: 57 + 5 > 60, não arranca
    expect((await tick(deps(f3))).calls).toBe(3);
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
      if (n < 4) return envelope([withEt(fx("fixture-et.json"), 1, 0)]);
      if (n < 8) return envelope([withEt(fx("fixture-et.json"), 1, 1)]);
      if (n < 12) return envelope([withEt(fx("fixture-p.json"), 1, 1)]);
      return envelope([withEt(fx("fixture-pen.json"), 1, 1)]);
    };
    const f = fakeFetch([[byIds, seq], ...competitionRoutes(94)]);
    const d = deps(f);

    // minuto 1: 2H → ET; minuto 2: ET
    expect((await tick(d)).calls).toBe(4);
    expect((await db.doc(`matches/${ID}`).get()).get("score")).toMatchObject({ home: 3, away: 2 });
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
    // resultado que conta = 90' (2-2) + prolongamento (1-1), sem os penáltis
    expect(m.score).toMatchObject({ home: 3, away: 3, penalty: { home: 4, away: 3 }, extratime: { home: 1, away: 1 } });
    const g = (await db.doc(`games/${ID}`).get()).data()!;
    expect(g.scorehome).toBe("3");
    expect(g.scoreaway).toBe("3");
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
    expect(h2.lastCount).toBe(4 + 1);
  });

  it("minuto :15 com jogo live da liga 94 → 1 chamada extra de standings; minuto :16 não", async () => {
    clock = KO + 75 * MIN; // 21:15
    await seedFrom(fx("fixture-live-2h.json"), clock);
    const f = fakeFetch([[byIds, envelope([fx("fixture-live-2h.json")])], ...competitionRoutes(94)]);
    const r = await tick(deps(f));
    expect(r.calls).toBe(5 + 1);
    expect(only(f, /standings\?league=94&season=2026/)).toHaveLength(1);
    expect((await db.doc("competitions/football_94_2026/data/standings").get()).exists).toBe(true);

    clock = KO + 76 * MIN;
    const f2 = fakeFetch([[byIds, envelope([fx("fixture-live-2h.json")])]]);
    expect((await tick(deps(f2))).calls).toBe(4 + 1);
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

  it("NS 25 min depois do kickoff: 1 chamada por minuto (ritmo lento)", async () => {
    clock = KO + 25 * MIN;
    await seedFrom(fx("fixture-ns.json"), KO - 60 * MIN);
    const f = fakeFetch([[byIds, envelope([fx("fixture-ns.json")])]]);
    expect((await tick(deps(f))).calls).toBe(1);
    expect(sleeps).toEqual([]);
    clock = KO + 239 * MIN;
    expect((await tick(deps(f))).calls).toBe(1);
    clock = KO + 240 * MIN;
    expect((await tick(deps(f))).calls).toBe(0);
  });

  it("LIVE (INT) com kickoff há mais de 4 h: 1 chamada por minuto, sem standings", async () => {
    clock = KO + 4 * 60 * MIN + 15 * MIN; // minuto :15
    const int = fx("fixture-live-2h.json");
    int.fixture.status.short = "INT";
    await seedFrom(int, KO + 60 * MIN);
    const f = fakeFetch([[byIds, envelope([int])]]);
    expect((await tick(deps(f))).calls).toBe(1 + 1); // 1 fixture + 1 liveFixtures
    expect(sleeps).toEqual([]);
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

  it("ratings: ticks em X+0:40 e X+1:20 → 1 só pedido; X+10 já fora da janela", async () => {
    clock = KO + 110 * MIN;
    await seedFrom(fx("fixture-ft.json"), clock);
    const fin = clock;
    await db.doc(`ingestState/match_${ID}`).set({ ticker: { endRefresh: true, postRefresh: true } }, { merge: true });
    const f = fakeFetch([[byIds, "api-football/fixture-ft.json"]]);
    clock = fin + 30 * MIN + 40_000;
    expect((await tick(deps(f))).calls).toBe(1);
    clock = fin + 31 * MIN + 20_000;
    expect((await tick(deps(f))).calls).toBe(0);
    expect((await db.doc(`ingestState/match_${ID}`).get()).get("ticker.ratings30")).toBe(true);
    // 60: tick perdido em X, o de X+1 faz o refresco
    clock = fin + 61 * MIN;
    expect((await tick(deps(f))).calls).toBe(1);
    clock = fin + 62 * MIN;
    expect((await tick(deps(f))).calls).toBe(0);
    // 110: perdido até X+10 → já não se faz
    clock = fin + 120 * MIN;
    expect((await tick(deps(f))).calls).toBe(0);
    expect(only(f, byIds)).toHaveLength(2);
  });

  it("ratings que falham repetem no minuto seguinte (a marca só fica com o jogo guardado)", async () => {
    clock = KO + 110 * MIN;
    await seedFrom(fx("fixture-ft.json"), clock);
    const fin = clock;
    await db.doc(`ingestState/match_${ID}`).set({ ticker: { endRefresh: true, postRefresh: true } }, { merge: true });
    const f = fakeFetch([[byIds, [{ status: 500 }, "api-football/fixture-ft.json"]]]);
    clock = fin + 30 * MIN;
    expect((await tick(deps(f))).failed).toBe(1);
    clock = fin + 31 * MIN;
    expect((await tick(deps(f))).calls).toBe(1);
    clock = fin + 32 * MIN;
    expect((await tick(deps(f))).calls).toBe(0);
  });

  it("FT na 4.ª iteração (aos 45 s): o refresco de fim de jogo fica para o minuto seguinte", async () => {
    clock = KO + 112 * MIN;
    await seedFrom(fx("fixture-live-2h.json", { elapsed: 90 }), clock);
    const live = envelope([fx("fixture-live-2h.json", { elapsed: 90 })]);
    const f = fakeFetch([[byIds, [live, live, live, envelope([fx("fixture-ft.json")])]], ...competitionRoutes(94)]);
    const r = await tick(deps(f));
    expect(r.calls).toBe(4);
    expect(r.deferred).toEqual([ID]);
    expect(only(f, /standings/)).toHaveLength(0);
    expect((await db.doc(`matches/${ID}`).get()).get("status")).toBe("FT");

    clock = KO + 113 * MIN;
    const r2 = await tick(deps(f));
    expect(r2.calls).toBe(1 + 7);
    expect(r2.deferred).toEqual([]);
    clock = KO + 114 * MIN;
    expect((await tick(deps(f))).calls).toBe(1);
  });

  it("FT na 2.ª iteração (15 s) refresca no tick; na 3.ª (30 s, depois de INLINE_REFRESH_MS) fica adiado", async () => {
    clock = KO + 112 * MIN;
    await seedFrom(fx("fixture-live-2h.json", { elapsed: 90 }), clock);
    const live = envelope([fx("fixture-live-2h.json", { elapsed: 90 })]);
    const ft = envelope([fx("fixture-ft.json")]);
    const f = fakeFetch([[byIds, [live, live, ft]], ...competitionRoutes(94)]);
    const r = await tick(deps(f));
    expect(r.calls).toBe(3);
    expect(r.deferred).toEqual([ID]);
    expect(only(f, /standings/)).toHaveLength(0);

    await db.doc(`matches/${ID}`).delete();
    await db.doc(`ingestState/match_${ID}`).delete();
    // minuto que não é múltiplo de 15 (sem a classificação de 15 em 15 min)
    clock = KO + 121 * MIN;
    await seedFrom(fx("fixture-live-2h.json", { elapsed: 90 }), clock);
    const f2 = fakeFetch([[byIds, [live, ft]], ...competitionRoutes(94)]);
    const r2 = await tick(deps(f2));
    expect(r2.deferred).toEqual([]);
    expect(r2.calls).toBe(2 + 7);
  });

  it("refresco pendente de um jogo idle não atrasa a iteração 1 do jogo ao vivo (corre depois, ou fica adiado)", async () => {
    // jogo anterior terminado há 25 min (postRefresh pendente) e o jogo atual a decorrer
    clock = KO + 67 * MIN;
    await seedFootballMatch(db, { id: "1500009", kickoff: new Date(clock - 140 * MIN), finishedAt: new Date(clock - 25 * MIN), finishedAtSource: "observed" });
    await db.doc("ingestState/match_1500009").set({ ticker: { endRefresh: true } }, { merge: true });
    await seedFrom(fx("fixture-live-2h.json"), clock);
    const f = fakeFetch([[byIds, envelope([fx("fixture-live-2h.json")])], ...competitionRoutes(94)]);
    const r = await tick(deps(f));
    expect(f.calls[0]).toMatch(byIds);
    expect(sleeps).toEqual([15_000, 15_000, 15_000]);
    expect(r.calls).toBe(4 + 1);
    expect(r.deferred).toEqual(["1500009"]);

    // sem jogo ao vivo, o refresco corre (depois da única iteração)
    await db.doc(`matches/${ID}`).delete();
    clock += MIN;
    const r2 = await tick(deps(f));
    expect(r2.calls).toBe(7);
    clock += MIN;
    expect((await tick(deps(f))).calls).toBe(0);
  });

  it("jogo terminado só pelo calendário (sem ticker): o refresco de fim de jogo corre no postmatch", async () => {
    await seedFootballMatch(db, { id: "1500009", kickoff: new Date(KO), finishedAt: new Date(KO + 110 * MIN), finishedAtSource: "estimated" });
    clock = KO + 115 * MIN;
    const f = fakeFetch([[byIds, envelope([{ ...fx("fixture-ft.json"), fixture: { ...fx("fixture-ft.json").fixture, id: 1500009 } }])], ...competitionRoutes(94)]);
    const r = await tick(deps(f));
    expect(r.calls).toBe(1 + 7);
  });
});

describe("tick: push", () => {
  it("sem deps.push não envia nem grava marcas", async () => {
    await seedFrom(fx("fixture-ns.json"), KO - 60 * MIN);
    clock = KO + 2 * MIN;
    const f = fakeFetch([[byIds, envelope([fx("fixture-live-1h.json", { elapsed: 1 })])]]);
    await tick(deps(f));
    expect((await db.doc(`ingestState/match_${ID}`).get()).get("push")).toBeUndefined();
  });

  it("NS → LIVE com fixture-live-1h (elapsed 1) e um golo: nada para push_matchStart nem push_goals", async () => {
    await seedFrom(fx("fixture-ns.json"), KO - 60 * MIN);
    clock = KO + 2 * MIN;
    const s = fakeSender();
    const f = fakeFetch([[byIds, envelope([fx("fixture-live-1h.json", { elapsed: 1 })])]]);
    await tick({ ...deps(f), push: s.sender });
    clock = KO + 3 * MIN;
    await tick({ ...deps(f), push: s.sender });
    // Os tópicos antigos já nem existem no tipo; compara como texto.
    expect(s.topics.map((t) => t.topic as string).filter((t) => t === "push_matchStart" || t === "push_goals")).toEqual([]);
  });

  it("com a janela do MVP aberta (80'): um push_mvpOpen em dois ticks seguidos", async () => {
    clock = KO + 100 * MIN;
    await seedFrom(fx("fixture-live-2h.json", { elapsed: 80 }), clock);
    const s = fakeSender();
    const f = fakeFetch([[byIds, envelope([fx("fixture-live-2h.json", { elapsed: 80 })])]]);
    await tick({ ...deps(f), push: s.sender });
    clock += MIN;
    await tick({ ...deps(f), push: s.sender });
    expect(s.topics.map((t) => t.topic)).toEqual(["push_mvpOpen"]);
    expect(s.topics[0].msg.route).toBe(`/jogo/${ID}?tab=mvp`);
  });

  it("o push a falhar não conta como falha do tick", async () => {
    clock = KO + 100 * MIN;
    await seedFrom(fx("fixture-live-2h.json", { elapsed: 80 }), clock);
    const s = fakeSender();
    s.failNext(100);
    const f = fakeFetch([[byIds, envelope([fx("fixture-live-2h.json", { elapsed: 80 })])]]);
    const r = await tick({ ...deps(f), push: s.sender });
    expect(r.failed).toBe(0);
    expect(s.topics).toEqual([]);
  });
});

describe("tick: classificação ao vivo (competitions/{key}/data/liveFixtures)", () => {
  const LIVE_DOC = "competitions/football_94_2026/data/liveFixtures";
  const liveResponse = () => {
    const a = fx("fixture-live-2h.json", { elapsed: 67 });
    const b = fx("fixture-live-2h.json", { elapsed: 66 });
    b.fixture.id = 1500100;
    b.teams.home = { ...b.teams.home, id: 212, name: "FC Porto" };
    b.teams.away = { ...b.teams.away, id: 217, name: "Benfica" };
    b.goals = { home: 0, away: null as unknown as number };
    return envelope([a, b]);
  };

  it("jogo do Sporting em liga em direto: 1 pedido fixtures?live=all&league=94 por minuto, conta na quota e escreve o formato exato", async () => {
    clock = KO + 67 * MIN;
    await seedFrom(fx("fixture-live-2h.json"), clock);
    const f = fakeFetch([[byIds, envelope([fx("fixture-live-2h.json")])]]);
    const r = await tick(deps(f, { liveResponse: liveResponse() }));
    expect(liveCalls).toEqual([expect.stringMatching(/\/fixtures\?live=all&league=94$/)]);
    expect(r.calls).toBe(4 + 1);
    expect(r.failed).toBe(0);
    const doc = (await db.doc(LIVE_DOC).get()).data()!;
    expect(Object.keys(doc).sort()).toEqual(["fixtures", "updatedAt"]);
    expect(doc.updatedAt.toMillis()).toBeGreaterThan(0);
    expect(doc.fixtures).toEqual([
      { homeId: "228", awayId: "211", homeGoals: 2, awayGoals: 1, elapsed: 67, status: "2H" },
      { homeId: "212", awayId: "217", homeGoals: 0, awayGoals: 0, elapsed: 66, status: "2H" },
    ]);
  });

  it("o updatedAt avança em cada minuto, mesmo com o conteúdo igual", async () => {
    clock = KO + 67 * MIN;
    await seedFrom(fx("fixture-live-2h.json"), clock);
    const f = fakeFetch([[byIds, envelope([fx("fixture-live-2h.json")])]]);
    await tick(deps(f, { liveResponse: liveResponse() }));
    const t1 = (await db.doc(LIVE_DOC).get()).get("updatedAt").toMillis();
    await new Promise((r) => setTimeout(r, 15));
    clock += MIN;
    await tick(deps(f, { liveResponse: liveResponse() }));
    expect((await db.doc(LIVE_DOC).get()).get("updatedAt").toMillis()).toBeGreaterThan(t1);
    expect(liveCalls).toHaveLength(2);
  });

  it("particular, taça ou eliminatória em direto: não pede nem escreve", async () => {
    clock = KO + 67 * MIN;
    await seedFrom(fx("fixture-live-2h.json", { league: 667 }), clock);
    let f = fakeFetch([[byIds, envelope([fx("fixture-live-2h.json", { league: 667 })])]]);
    expect((await tick(deps(f))).calls).toBe(4);
    await clearAll(db);
    await seedFrom(fx("fixture-live-2h.json", { league: 96 }), clock);
    f = fakeFetch([[byIds, envelope([fx("fixture-live-2h.json", { league: 96 })])]]);
    expect((await tick(deps(f))).calls).toBe(4);
    await clearAll(db);
    const ko = fx("fixture-live-2h.json");
    ko.league.round = "Round of 16";
    await seedFrom(ko, clock);
    f = fakeFetch([[byIds, envelope([ko])]]);
    expect((await tick(deps(f))).calls).toBe(4);
    expect(liveCalls).toHaveLength(0);
  });

  it("liga em direto sem o Sporting: não pede", async () => {
    clock = KO + 67 * MIN;
    const other = fx("fixture-live-2h.json");
    other.teams.home = { ...other.teams.home, id: 212, name: "FC Porto" };
    await seedFrom(other, clock);
    const f = fakeFetch([[byIds, envelope([other])]]);
    expect((await tick(deps(f))).calls).toBe(4);
    expect(liveCalls).toHaveLength(0);
  });

  it("jogo do Sporting ainda por começar: não pede", async () => {
    clock = KO - 60 * MIN;
    await seedFrom(fx("fixture-ns.json"), clock);
    const f = fakeFetch([[byIds, "api-football/fixture-ns-lineups.json"]]);
    expect((await tick(deps(f))).calls).toBe(1);
    expect(liveCalls).toHaveLength(0);
  });

  it("jogo do Sporting em liga já terminado (fora do postmatch): nem fixtures nem liveFixtures", async () => {
    // Jogo FT da liga 94 com o Sporting, terminado há 40 min (depois do postmatch de 25 min e do postRefresh feito).
    const ft = fx("fixture-ft.json");
    expect(ft.league.id).toBe(94);
    expect([ft.teams.home.id, ft.teams.away.id]).toContain(228);
    const finishedAt = KO + 110 * MIN;
    await seedFrom(ft, finishedAt);
    await db.doc(`matches/${ft.fixture.id}`).set({ finishedAt: new Date(finishedAt), finishedAtSource: "observed" }, { merge: true });
    await db.doc(`ingestState/match_${ft.fixture.id}`).set({ ticker: { endRefresh: true, postRefresh: true } }, { merge: true });
    expect((await db.doc(`matches/${ft.fixture.id}`).get()).get("status")).toBe("FT");
    clock = finishedAt + 40 * MIN;
    const f = fakeFetch([]);
    const r = await tick(deps(f));
    expect(r.calls).toBe(0);
    expect(f.calls).toHaveLength(0);
    expect(liveCalls).toHaveLength(0);
  });

  it("o pedido a falhar: o ticker continua saudável (e regista remaining) e a falha vai para football_live_standings", async () => {
    clock = KO + 67 * MIN;
    await seedFrom(fx("fixture-live-2h.json"), clock);
    const f = fakeFetch([[byIds, envelope([fx("fixture-live-2h.json")])]]);
    const bad = { errors: { rateLimit: "Too many requests" }, response: [] };
    const r = await tick(deps(f, { liveResponse: bad }));
    expect(r.failed).toBe(0);
    expect(r.liveStandings.errors[0]).toMatch(/liveFixtures 94/);
    expect((await db.doc(`matches/${ID}`).get()).get("elapsed")).toBe(67);
    expect((await db.doc(LIVE_DOC).get()).exists).toBe(false);

    const alerts = jest.spyOn(logger, "error").mockImplementation(() => undefined);
    await liveTickerJob(deps(f, { liveResponse: bad }));
    const live = (await db.doc("ingestHealth/football_live").get()).data()!;
    expect(live.consecutiveFailures).toBe(0);
    expect(live.lastError).toBeNull();
    expect(live.lastCount).toBe(4 + 1);
    const st = (await db.doc("ingestHealth/football_live_standings").get()).data()!;
    expect(st.consecutiveFailures).toBe(1);
    expect(st.lastError).toMatch(/liveFixtures 94/);

    // segunda falha seguida: conta, mas no total só houve 1 INGEST_ALERT da classificação ao vivo (o da primeira)
    clock += MIN;
    await liveTickerJob(deps(f, { liveResponse: bad }));
    expect((await db.doc("ingestHealth/football_live_standings").get()).get("consecutiveFailures")).toBe(2);
    expect(alerts.mock.calls.filter((c) => c[0] === "INGEST_ALERT" && (c[1] as { source: string }).source === "football_live_standings")).toHaveLength(1);
    alerts.mockRestore();

    // minuto seguinte sem erro: a saúde da classificação recupera
    clock += MIN;
    await liveTickerJob(deps(f, { liveResponse: liveResponse() }));
    expect((await db.doc("ingestHealth/football_live_standings").get()).get("consecutiveFailures")).toBe(0);
    expect((await db.doc("ingestHealth/football_live").get()).get("consecutiveFailures")).toBe(0);
  });

  it("um jogo de outra equipa acaba antes do do Sporting: fica como FT com finishedAt até a classificação oficial ser mais recente", async () => {
    clock = KO + 67 * MIN;
    await seedFrom(fx("fixture-live-2h.json"), clock);
    // o Porto-Benfica estava no documento e já não vem em direto (liveResponse só tem o jogo do Sporting)
    const seenAt = clock - MIN;
    await db.doc(LIVE_DOC).set({
      updatedAt: new Date(seenAt),
      fixtures: [
        { homeId: "228", awayId: "211", homeGoals: 2, awayGoals: 1, elapsed: 66, status: "2H" },
        { homeId: "212", awayId: "217", homeGoals: 1, awayGoals: 0, elapsed: 89, status: "2H" },
      ],
    });
    await db.doc("competitions/football_94_2026/data/standings").set({ groups: [], updatedAt: new Date(KO - 60 * MIN) });
    const f = fakeFetch([[byIds, envelope([fx("fixture-live-2h.json")])]]);
    const only = envelope([fx("fixture-live-2h.json", { elapsed: 67 })]);
    await tick(deps(f, { liveResponse: only }));
    let fixtures = (await db.doc(LIVE_DOC).get()).get("fixtures") as Record<string, unknown>[];
    expect(fixtures).toHaveLength(2);
    expect(fixtures[0]).toMatchObject({ homeId: "228", status: "2H" });
    expect(fixtures[0]).not.toHaveProperty("finishedAt");
    expect(fixtures[1]).toMatchObject({ homeId: "212", awayId: "217", homeGoals: 1, awayGoals: 0, status: "FT", elapsed: null });
    const fin = (fixtures[1]!.finishedAt as { toMillis: () => number }).toMillis();
    // finishedAt = última vez visto em direto (`updatedAt` do documento anterior), não o minuto em que se reparou
    expect(fin).toBe(seenAt);

    // minuto seguinte: continua, com o mesmo finishedAt
    clock += MIN;
    await tick(deps(f, { liveResponse: only }));
    fixtures = (await db.doc(LIVE_DOC).get()).get("fixtures") as Record<string, unknown>[];
    expect(fixtures).toHaveLength(2);
    expect((fixtures[1]!.finishedAt as { toMillis: () => number }).toMillis()).toBe(fin);

    // a classificação oficial é refrescada depois do apito desse jogo: deixa de ser mantido
    await db.doc("competitions/football_94_2026/data/standings").set({ groups: [], updatedAt: new Date(fin + 1000) });
    clock += MIN;
    await tick(deps(f, { liveResponse: only }));
    fixtures = (await db.doc(LIVE_DOC).get()).get("fixtures") as Record<string, unknown>[];
    expect(fixtures).toHaveLength(1);
    expect(fixtures[0]).toMatchObject({ homeId: "228" });
  });

  it("depois do apito do Sporting: FT mantido enquanto a oficial for mais antiga, descartado quando for mais recente", async () => {
    clock = KO + 67 * MIN;
    const ft = fx("fixture-live-2h.json");
    ft.fixture.status = { long: "Match Finished", short: "FT", elapsed: 90, extra: null };
    const finishedAt = KO + 112 * MIN;
    await seedFrom(ft, finishedAt);
    await db.doc(`matches/${ID}`).set({ finishedAt: new Date(finishedAt), finishedAtSource: "observed" }, { merge: true });
    await db.doc(`ingestState/match_${ID}`).set({ ticker: { endRefresh: true, postRefresh: true } }, { merge: true });
    const rivalFin = new Date(finishedAt - 3 * MIN);
    await db.doc(LIVE_DOC).set({
      updatedAt: new Date(finishedAt - MIN),
      fixtures: [
        { homeId: "228", awayId: "211", homeGoals: 2, awayGoals: 1, elapsed: 90, status: "2H" },
        { homeId: "212", awayId: "217", homeGoals: 1, awayGoals: 0, elapsed: null, status: "FT", finishedAt: rivalFin },
      ],
    });
    await db.doc("competitions/football_94_2026/data/standings").set({ groups: [], updatedAt: new Date(rivalFin.getTime() - MIN) });
    clock = finishedAt + 2 * MIN;
    const f = fakeFetch([[byIds, envelope([ft])]]);
    await tick(deps(f));
    expect(liveCalls).toHaveLength(0);
    let fixtures = (await db.doc(LIVE_DOC).get()).get("fixtures") as Record<string, unknown>[];
    // o jogo do Sporting (ainda "2H" no documento) cai; o FT do rival continua porque a oficial é anterior
    expect(fixtures).toHaveLength(1);
    expect(fixtures[0]).toMatchObject({ homeId: "212", status: "FT" });

    await db.doc("competitions/football_94_2026/data/standings").set({ groups: [], updatedAt: new Date(finishedAt + MIN) });
    clock += MIN;
    await tick(deps(f));
    fixtures = (await db.doc(LIVE_DOC).get()).get("fixtures") as Record<string, unknown>[];
    expect(fixtures).toEqual([]);
  });

  it("o jogo acaba: o documento fica com fixtures vazio (sem pedido à API) para a app não somar o resultado duas vezes", async () => {
    clock = KO + 67 * MIN;
    await seedFrom(fx("fixture-live-2h.json"), clock);
    await db.doc(LIVE_DOC).set({ updatedAt: new Date(clock), fixtures: [{ homeId: "228", awayId: "211", homeGoals: 2, awayGoals: 1, elapsed: 90, status: "2H" }] });
    // jogo terminado há 2 min
    const ft = fx("fixture-live-2h.json");
    ft.fixture.status = { long: "Match Finished", short: "FT", elapsed: 90, extra: null };
    const finishedAt = KO + 112 * MIN;
    await seedFrom(ft, finishedAt);
    await db.doc(`matches/${ID}`).set({ finishedAt: new Date(finishedAt), finishedAtSource: "observed" }, { merge: true });
    await db.doc(`ingestState/match_${ID}`).set({ ticker: { endRefresh: true, postRefresh: true } }, { merge: true });
    clock = finishedAt + 2 * MIN;
    const f = fakeFetch([[byIds, envelope([ft])]]);
    const r = await tick(deps(f));
    expect(r.failed).toBe(0);
    expect(r.calls).toBe(1); // só o fixture do jogo (postmatch); nenhum liveFixtures
    expect(liveCalls).toHaveLength(0);
    const doc = (await db.doc(LIVE_DOC).get()).data()!;
    expect(doc.fixtures).toEqual([]);
  });
});
