import { POINTS, mvpBonus, predictionBonus } from "../../src/game/scoring";

describe("predictionBonus", () => {
  it("exact", () => expect(predictionBonus({ home: 2, away: 1 }, { home: 2, away: 1 })).toBe(3));
  it("outcome", () => expect(predictionBonus({ home: 1, away: 0 }, { home: 2, away: 1 })).toBe(1));
  it("draw outcome", () => expect(predictionBonus({ home: 1, away: 1 }, { home: 0, away: 0 })).toBe(1));
  it("wrong", () => expect(predictionBonus({ home: 0, away: 1 }, { home: 2, away: 1 })).toBe(0));
});
describe("mvpBonus", () => {
  it("correct", () => expect(mvpBonus("p7", ["p7", "p9"])).toBe(2));
  it("none", () => expect(mvpBonus("p7", [])).toBe(0));
});
describe("POINTS", () => {
  it("values", () => expect(POINTS).toEqual({ participation: 1, exact: 3, outcome: 1, mvpCorrect: 2 }));
});
