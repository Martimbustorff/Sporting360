import { liveFixtureItems } from "../../src/football/liveFixtures";
import type { AfFixtureCore } from "../../src/sources/apiFootball.types";

const fx = (short: string, home = 228, away = 212, goals: [number | null, number | null] = [1, 0]) =>
  ({
    fixture: { id: 1, status: { short, long: short, elapsed: 55, extra: null } },
    teams: { home: { id: home }, away: { id: away } },
    goals: { home: goals[0], away: goals[1] },
  }) as unknown as AfFixtureCore;

describe("liveFixtureItems", () => {
  it.each(["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"])("%s conta como a decorrer", (s) => {
    expect(liveFixtureItems([fx(s)])).toEqual([{ homeId: "228", awayId: "212", homeGoals: 1, awayGoals: 0, elapsed: 55, status: s }]);
  });

  it.each(["NS", "TBD", "FT", "AET", "PEN", "PST", "CANC", "ABD", "AWD", "WO"])("%s fica de fora", (s) => {
    expect(liveFixtureItems([fx(s)])).toEqual([]);
  });

  it("golos nulos contam como 0", () => {
    expect(liveFixtureItems([fx("1H", 1, 2, [null, null])])[0]).toMatchObject({ homeGoals: 0, awayGoals: 0 });
  });
});

import { KEEP_FINISHED_MAX_MS, PREVIOUS_STALE_MS, keepFinished, refreshLiveFixtures, type LiveFixtureItem } from "../../src/football/liveFixtures";
import type { FootballDeps } from "../../src/football/fixturesSync";

describe("keepFinished", () => {
  const NOW = new Date("2026-11-22T21:30:00Z");
  const item = (homeId: string, awayId: string, o: Partial<LiveFixtureItem> = {}): LiveFixtureItem => ({
    homeId, awayId, homeGoals: 2, awayGoals: 1, elapsed: 88, status: "2H", ...o,
  });

  const SEEN = new Date(NOW.getTime() - 60_000);

  it("jogo que saiu do live=all fica como FT com o último resultado e finishedAt = última vez visto em direto", () => {
    const kept = keepFinished([item("212", "217"), item("228", "211")], [item("228", "211")], NOW, null, SEEN);
    expect(kept).toEqual([{ homeId: "212", awayId: "217", homeGoals: 2, awayGoals: 1, elapsed: null, status: "FT", finishedAt: SEEN }]);
  });

  it("documento anterior velho (5 min ou mais) ou sem data: os jogos em curso não se aproveitam", () => {
    const old = new Date(NOW.getTime() - PREVIOUS_STALE_MS);
    expect(keepFinished([item("212", "217")], [], NOW, null, old)).toEqual([]);
    expect(keepFinished([item("212", "217")], [], NOW, null, null)).toEqual([]);
    expect(keepFinished([item("212", "217")], [], NOW, null, new Date(old.getTime() + 1))).toHaveLength(1);
    // Os já FT mantêm-se pelo finishedAt, mesmo com o documento velho.
    const fin = new Date(NOW.getTime() - 20 * 60_000);
    expect(keepFinished([item("212", "217", { status: "FT", finishedAt: fin })], [], NOW, null, fin)).toHaveLength(1);
  });

  it("um jogo já mantido conserva o finishedAt original", () => {
    const fin = new Date(NOW.getTime() - 5 * 60_000);
    const kept = keepFinished([item("212", "217", { status: "FT", elapsed: null, finishedAt: fin })], [], NOW, null, SEEN);
    expect(kept[0]?.finishedAt).toEqual(fin);
  });

  it("deixa de ser mantido quando a classificação oficial é posterior ao finishedAt", () => {
    const fin = new Date(NOW.getTime() - 5 * 60_000);
    const prev = [item("212", "217", { status: "FT", finishedAt: fin })];
    expect(keepFinished(prev, [], NOW, new Date(fin.getTime() - 1), fin)).toHaveLength(1);
    expect(keepFinished(prev, [], NOW, new Date(fin.getTime() + 1), fin)).toHaveLength(0);
  });

  it("jogo que volta a estar em direto não é duplicado", () => {
    expect(keepFinished([item("212", "217")], [item("212", "217", { homeGoals: 3 })], NOW, null, SEEN)).toEqual([]);
  });

  it("rede de segurança: largado passadas 3 h sem a oficial", () => {
    const fin = new Date(NOW.getTime() - KEEP_FINISHED_MAX_MS - 1);
    expect(keepFinished([item("212", "217", { status: "FT", finishedAt: fin })], [], NOW, null, fin)).toEqual([]);
  });
});

describe("refreshLiveFixtures", () => {
  const NOW = new Date("2026-11-22T21:30:00Z");
  const ts = (d: Date) => ({ toDate: () => d });
  function deps(docs: Record<string, Record<string, unknown>>, liveNow: AfFixtureCore[] = []) {
    const writes: Record<string, { fixtures: LiveFixtureItem[] }> = {};
    const d = {
      now: () => NOW,
      api: { liveFixtures: async () => liveNow },
      db: {
        doc: (path: string) => ({
          get: async () => ({ get: (f: string) => docs[path]?.[f] }),
          set: async (data: { fixtures: LiveFixtureItem[] }) => void (writes[path] = data),
        }),
      },
    } as unknown as FootballDeps;
    return { d, writes };
  }
  const LIVE = "competitions/football_94_2026/data/liveFixtures";
  const STAND = "competitions/football_94_2026/data/standings";
  const entry = (o: Record<string, unknown> = {}) => ({ homeId: "212", awayId: "217", homeGoals: 2, awayGoals: 1, elapsed: 88, status: "2H", ...o });

  it("a classificação oficial refrescada no mesmo minuto em que o jogo acaba não o conta duas vezes", async () => {
    // Visto em direto há 30 s; a oficial atualizou agora (já conta o jogo): não se mantém como FT.
    const { d, writes } = deps({
      [LIVE]: { updatedAt: ts(new Date(NOW.getTime() - 30_000)), fixtures: [entry()] },
      [STAND]: { updatedAt: ts(NOW) },
    });
    await refreshLiveFixtures(d, 94, "football_94_2026");
    expect(writes[LIVE]?.fixtures).toEqual([]);
  });

  it("sem refresco da oficial o jogo fica como FT com finishedAt = última vez visto em direto", async () => {
    const seen = new Date(NOW.getTime() - 30_000);
    const { d, writes } = deps({ [LIVE]: { updatedAt: ts(seen), fixtures: [entry()] } });
    await refreshLiveFixtures(d, 94, "football_94_2026");
    expect(writes[LIVE]?.fixtures).toEqual([expect.objectContaining({ status: "FT", elapsed: null, finishedAt: seen })]);
  });

  it("documento de há uma semana com jogos em curso não os ressuscita", async () => {
    const week = new Date(NOW.getTime() - 7 * 24 * 60 * 60_000);
    const { d, writes } = deps({ [LIVE]: { updatedAt: ts(week), fixtures: [entry()] } });
    await refreshLiveFixtures(d, 94, "football_94_2026");
    expect(writes[LIVE]?.fixtures).toEqual([]);
  });
});
