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
