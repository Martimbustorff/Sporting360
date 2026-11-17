import { GameState } from "../../src/game/types";
import {
  MVP_CLOSE_AFTER_MS,
  MVP_SETTLE_AFTER_MS,
  mvpWindow,
  predictionOpen,
} from "../../src/game/windows";

function game(over: Partial<GameState> = {}): GameState {
  return {
    gameId: "g1",
    kickoff: new Date("2026-11-21T20:00:00Z"),
    status: "NS",
    elapsed: null,
    goalsHome: null,
    goalsAway: null,
    finishedAt: null,
    sportingSide: "home",
    ...over,
  };
}

describe("constants", () => {
  it("MVP close is 20 minutes after the final whistle", () => {
    expect(MVP_CLOSE_AFTER_MS).toBe(20 * 60_000);
  });
  it("MVP settle delay is two hours", () => {
    expect(MVP_SETTLE_AFTER_MS).toBe(2 * 60 * 60_000);
  });
});

describe("predictionOpen", () => {
  const kickoff = new Date("2026-11-21T20:00:00Z");

  it("is open one minute before kickoff and closed at kickoff", () => {
    const g = game({ kickoff });
    expect(predictionOpen(g, new Date("2026-11-21T19:59:00Z"))).toBe(true);
    expect(predictionOpen(g, new Date("2026-11-21T20:00:00Z"))).toBe(false);
  });

  it("is closed after kickoff even while not started", () => {
    expect(predictionOpen(game({ kickoff }), new Date("2026-11-21T20:05:00Z"))).toBe(false);
  });

  it("is closed for any status other than NS", () => {
    const now = new Date("2026-11-21T10:00:00Z");
    for (const status of ["LIVE", "HT", "FT", "AET", "PEN", "PST", "CANC"] as const) {
      expect(predictionOpen(game({ kickoff, status }), now)).toBe(false);
    }
  });

  // Review Focus 1: a postponed match whose kickoff moves to the next day.
  it("stays closed while postponed and reopens when NS with the new kickoff", () => {
    const original = new Date("2026-11-21T20:00:00Z");
    const moved = new Date("2026-11-22T20:00:00Z");
    const now = new Date("2026-11-21T19:00:00Z");

    expect(predictionOpen(game({ kickoff: original, status: "PST" }), now)).toBe(false);
    expect(predictionOpen(game({ kickoff: moved, status: "NS" }), now)).toBe(true);
    expect(predictionOpen(game({ kickoff: moved, status: "NS" }), new Date("2026-11-22T19:59:00Z"))).toBe(true);
    expect(predictionOpen(game({ kickoff: moved, status: "NS" }), moved)).toBe(false);
  });
});

describe("mvpWindow", () => {
  it("LIVE with elapsed 79 is before", () => {
    const r = mvpWindow(game({ status: "LIVE", elapsed: 79 }), new Date("2026-11-21T21:19:00Z"));
    expect(r).toEqual({ state: "before", closesAt: null });
  });

  it("LIVE with elapsed 80 is open with no close time", () => {
    const r = mvpWindow(game({ status: "LIVE", elapsed: 80 }), new Date("2026-11-21T21:20:00Z"));
    expect(r).toEqual({ state: "open", closesAt: null });
  });

  it("LIVE with null elapsed is before", () => {
    const r = mvpWindow(game({ status: "LIVE", elapsed: null }), new Date("2026-11-21T21:30:00Z"));
    expect(r).toEqual({ state: "before", closesAt: null });
  });

  it("HT is before", () => {
    const r = mvpWindow(game({ status: "HT", elapsed: 45 }), new Date("2026-11-21T20:45:00Z"));
    expect(r).toEqual({ state: "before", closesAt: null });
  });

  it("FT 21:52 is open until 22:12 and closed from 22:12", () => {
    const finishedAt = new Date("2026-11-21T21:52:00Z");
    const closesAt = new Date("2026-11-21T22:12:00Z");
    const g = game({ status: "FT", finishedAt });

    expect(mvpWindow(g, new Date("2026-11-21T22:11:00Z"))).toEqual({ state: "open", closesAt });
    expect(mvpWindow(g, new Date("2026-11-21T22:12:00Z"))).toEqual({ state: "closed", closesAt });
  });

  it("AET and PEN use the same post-match window", () => {
    const finishedAt = new Date("2026-11-21T21:52:00Z");
    const closesAt = new Date("2026-11-21T22:12:00Z");
    for (const status of ["AET", "PEN"] as const) {
      const g = game({ status, finishedAt });
      expect(mvpWindow(g, new Date("2026-11-21T22:11:00Z"))).toEqual({ state: "open", closesAt });
      expect(mvpWindow(g, new Date("2026-11-21T22:12:00Z"))).toEqual({ state: "closed", closesAt });
    }
  });

  it("finished match with null finishedAt is before with no close time", () => {
    const r = mvpWindow(game({ status: "FT", finishedAt: null }), new Date("2026-11-21T23:00:00Z"));
    expect(r).toEqual({ state: "before", closesAt: null });
  });

  it("PST, CANC and NS are before", () => {
    const now = new Date("2026-11-21T23:00:00Z");
    for (const status of ["PST", "CANC", "NS"] as const) {
      expect(mvpWindow(game({ status }), now)).toEqual({ state: "before", closesAt: null });
    }
  });
});
