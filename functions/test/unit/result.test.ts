import { countedScore, outcome } from "../../src/game/result";
import { GameState, GameStatus } from "../../src/game/types";

const g = (status: GameStatus, h: number | null, a: number | null): GameState => ({
  gameId: "g1", kickoff: new Date("2026-11-20T20:00:00Z"), status, elapsed: null,
  goalsHome: h, goalsAway: a, finishedAt: null, sportingSide: "home",
});

describe("countedScore", () => {
  it("FT", () => expect(countedScore(g("FT", 2, 1))).toEqual({ home: 2, away: 1 }));
  it("AET", () => expect(countedScore(g("AET", 2, 2))).toEqual({ home: 2, away: 2 }));
  it("PEN counts goals before shootout (draw)", () =>
    expect(countedScore(g("PEN", 1, 1))).toEqual({ home: 1, away: 1 }));
  it("LIVE null", () => expect(countedScore(g("LIVE", 1, 0))).toBeNull());
  it("PST null", () => expect(countedScore(g("PST", null, null))).toBeNull());
  it("null goals null", () => expect(countedScore(g("FT", null, null))).toBeNull());
});

describe("outcome", () => {
  it("H/D/A", () => {
    expect(outcome(2, 1)).toBe("H");
    expect(outcome(1, 1)).toBe("D");
    expect(outcome(0, 3)).toBe("A");
  });
});
