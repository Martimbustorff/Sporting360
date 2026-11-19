import type { EventItem } from "../../src/football/mapFixture";
import type { MatchDoc } from "../../src/model/types";
import { GOAL_FINAL_GRACE_MS, GOAL_MAX_AGE_MIN, MATCH_START_MAX_ELAPSED, goalKey, sportingGoals } from "../../src/push/matchPush";

function match(over: Partial<MatchDoc> = {}): MatchDoc {
  return {
    id: "9002",
    sport: "football",
    competition: { key: "liga", id: "94", name: "Liga", type: "league", season: "2026", round: null, roundLabel: null },
    home: { id: "228", name: "Sporting CP", logo: null },
    away: { id: "211", name: "Benfica", logo: null },
    sportingSide: "home",
    kickoff: new Date("2026-11-15T20:30:00Z"),
    status: "LIVE",
    statusRaw: "2H",
    elapsed: 60,
    elapsedExtra: null,
    score: { home: 2, away: 1, halftime: null, extratime: null, penalty: null },
    finishedAt: null,
    finishedAtSource: null,
    referee: null,
    source: { provider: "api-football", id: "9002" },
    ...over,
  };
}

function goal(over: Partial<EventItem> = {}): EventItem {
  return {
    minute: 10, extra: null, teamId: "228", playerId: null, playerName: null,
    assistId: null, assistName: null, type: "goal", detail: "Normal Goal", comments: null,
    ...over,
  };
}

describe("constantes", () => {
  it("valores do plano", () => {
    expect(MATCH_START_MAX_ELAPSED).toBe(15);
    expect(GOAL_MAX_AGE_MIN).toBe(15);
    expect(GOAL_FINAL_GRACE_MS).toBe(10 * 60_000);
  });
});

describe("sportingGoals", () => {
  it("conta golos do Sporting e autogolos do adversário, por ordem", () => {
    const a = goal({ minute: 30, teamId: "211", detail: "Own Goal", playerName: "Otamendi" });
    const b = goal({ minute: 10, playerName: "Gyökeres" });
    const c = goal({ minute: 10, extra: null, teamId: "228", detail: "Penalty" });
    expect(sportingGoals(match(), [a, b, c])).toEqual([b, c, a]);
  });

  it("descontos ordenados depois do minuto", () => {
    const a = goal({ minute: 45, extra: 2 });
    const b = goal({ minute: 45, extra: null });
    const c = goal({ minute: 46 });
    expect(sportingGoals(match(), [c, a, b])).toEqual([b, a, c]);
  });

  it("nunca golos do adversário nem autogolos de jogadores do Sporting", () => {
    expect(sportingGoals(match(), [goal({ teamId: "211" }), goal({ teamId: "228", detail: "Own Goal" })])).toEqual([]);
  });

  it("ignora Missed Penalty, o desempate por penáltis e lances que não são golo", () => {
    expect(
      sportingGoals(match(), [
        goal({ detail: "Missed Penalty" }),
        goal({ detail: "Penalty", comments: "Penalty Shootout" }),
        goal({ type: "card", detail: "Yellow Card" }),
        goal({ type: "var", detail: "Goal cancelled" }),
      ]),
    ).toEqual([]);
  });

  it("Sporting fora: o lado conta pelo teamId", () => {
    const m = match({ home: { id: "211", name: "Benfica", logo: null }, away: { id: "228", name: "Sporting CP", logo: null }, sportingSide: "away" });
    const ours = goal({ teamId: "228", minute: 5 });
    const ownByThem = goal({ teamId: "211", detail: "Own Goal", minute: 7 });
    const theirs = goal({ teamId: "211", minute: 9 });
    expect(sportingGoals(m, [ours, ownByThem, theirs])).toEqual([ours, ownByThem]);
  });
});

describe("goalKey", () => {
  it("minuto, descontos e jogador", () => {
    expect(goalKey("9002", goal({ minute: 90, extra: 3, playerId: "1" }))).toBe("9002_90+3_1");
    expect(goalKey("9002", goal({ minute: 23, playerId: null }))).toBe("9002_23_x");
  });
});
