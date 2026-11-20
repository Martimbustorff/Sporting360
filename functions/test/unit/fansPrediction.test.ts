import { outcomeOf, revealed, splitFor } from "../../src/game/fansPrediction";
import type { GameState } from "../../src/game/types";

const game = (over: Partial<GameState> = {}): GameState => ({
  gameId: "m1",
  kickoff: new Date("2026-11-17T20:00:00Z"),
  status: "NS",
  elapsed: null,
  goalsHome: null,
  goalsAway: null,
  finishedAt: null,
  sportingSide: "home",
  ...over,
});

describe("outcomeOf", () => {
  it.each([
    [2, 1, "home"],
    [0, 0, "draw"],
    [1, 3, "away"],
  ] as const)("%i-%i -> %s", (h, a, o) => expect(outcomeOf(h, a)).toBe(o));
});

describe("splitFor", () => {
  it("Sporting em casa: vitória = palpites na equipa da casa", () => {
    expect(splitFor("home", { home: 7, draw: 2, away: 1 })).toEqual({ win: 7, draw: 2, loss: 1 });
  });
  it("Sporting fora: vitória = palpites na equipa de fora", () => {
    expect(splitFor("away", { home: 1, draw: 2, away: 7 })).toEqual({ win: 7, draw: 2, loss: 1 });
  });
  it("campos em falta ou inválidos contam 0", () => {
    expect(splitFor("home", { home: "x", away: 3 })).toEqual({ win: 0, draw: 0, loss: 3 });
  });
});

describe("revealed: as percentagens só a partir do apito inicial", () => {
  it.each(["LIVE", "HT", "FT", "AET", "PEN"] as const)("%s -> sim", (status) => expect(revealed(game({ status }))).toBe(true));
  it.each(["NS", "PST", "CANC"] as const)("%s -> não", (status) => expect(revealed(game({ status }))).toBe(false));
});
