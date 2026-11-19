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

import { KEEP_FINISHED_MAX_MS, keepFinished, type LiveFixtureItem } from "../../src/football/liveFixtures";

describe("keepFinished", () => {
  const NOW = new Date("2026-11-22T21:30:00Z");
  const item = (homeId: string, awayId: string, o: Partial<LiveFixtureItem> = {}): LiveFixtureItem => ({
    homeId, awayId, homeGoals: 2, awayGoals: 1, elapsed: 88, status: "2H", ...o,
  });

  it("jogo que saiu do live=all fica como FT com o último resultado e finishedAt = agora", () => {
    const kept = keepFinished([item("212", "217"), item("228", "211")], [item("228", "211")], NOW, null);
    expect(kept).toEqual([{ homeId: "212", awayId: "217", homeGoals: 2, awayGoals: 1, elapsed: null, status: "FT", finishedAt: NOW }]);
  });

  it("um jogo já mantido conserva o finishedAt original", () => {
    const fin = new Date(NOW.getTime() - 5 * 60_000);
    const kept = keepFinished([item("212", "217", { status: "FT", elapsed: null, finishedAt: fin })], [], NOW, null);
    expect(kept[0]?.finishedAt).toEqual(fin);
  });

  it("deixa de ser mantido quando a classificação oficial é posterior ao finishedAt", () => {
    const fin = new Date(NOW.getTime() - 5 * 60_000);
    const prev = [item("212", "217", { status: "FT", finishedAt: fin })];
    expect(keepFinished(prev, [], NOW, new Date(fin.getTime() - 1))).toHaveLength(1);
    expect(keepFinished(prev, [], NOW, new Date(fin.getTime() + 1))).toHaveLength(0);
  });

  it("jogo que volta a estar em direto não é duplicado", () => {
    expect(keepFinished([item("212", "217")], [item("212", "217", { homeGoals: 3 })], NOW, null)).toEqual([]);
  });

  it("rede de segurança: largado passadas 3 h sem a oficial", () => {
    const fin = new Date(NOW.getTime() - KEEP_FINISHED_MAX_MS - 1);
    expect(keepFinished([item("212", "217", { status: "FT", finishedAt: fin })], [], NOW, null)).toEqual([]);
  });
});
