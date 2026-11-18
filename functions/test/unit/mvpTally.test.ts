import { HttpsError } from "firebase-functions/v2/https";
import { NUM_SHARDS, contentionToUnavailable, randomShard, sameTally, sumShards, tallyActive } from "../../src/game/mvpTally";
import type { GameState } from "../../src/game/types";

const MIN = 60_000;
const KICKOFF = new Date("2026-11-17T20:00:00Z");
const game = (over: Partial<GameState>): GameState => ({
  gameId: "m1",
  kickoff: KICKOFF,
  status: "LIVE",
  elapsed: 85,
  goalsHome: 1,
  goalsAway: 0,
  finishedAt: null,
  sportingSide: "home",
  ...over,
} as GameState);

describe("sumShards", () => {
  it("soma counts e total de vários shards", () => {
    expect(
      sumShards([
        { gameId: "m1", counts: { p10: 2, p7: 1 }, total: 3 },
        { gameId: "m1", counts: { p10: 1 }, total: 1 },
        { gameId: "m1", counts: { p8: 4 }, total: 4 },
      ]),
    ).toEqual({ counts: { p10: 3, p7: 1, p8: 4 }, total: 8 });
  });
  it("shards em falta ou com campos em falta contam 0", () => {
    expect(sumShards([undefined, {}, { counts: { p10: 1 } }, { total: 2 }, { counts: { p7: 1 }, total: 1 }])).toEqual({
      counts: { p10: 1, p7: 1 },
      total: 3,
    });
  });
  it("jogo sem shards dá contagem vazia", () => {
    expect(sumShards([])).toEqual({ counts: {}, total: 0 });
  });
  it("ignora valores não numéricos", () => {
    expect(sumShards([{ counts: { p10: "3", p7: 2 }, total: "x" }])).toEqual({ counts: { p7: 2 }, total: 0 });
  });
});

describe("sameTally", () => {
  it("compara total e counts", () => {
    expect(sameTally({ counts: { a: 1, b: 2 }, total: 3 }, { counts: { b: 2, a: 1 }, total: 3 })).toBe(true);
    expect(sameTally({ counts: { a: 1 }, total: 1 }, { counts: { a: 1 }, total: 2 })).toBe(false);
    expect(sameTally({ counts: { a: 1 }, total: 1 }, { counts: { b: 1 }, total: 1 })).toBe(false);
    expect(sameTally({ counts: { a: 1 }, total: 1 }, { counts: { a: 1, b: 0 }, total: 1 })).toBe(false);
  });
});

describe("randomShard", () => {
  it("fica em 0..NUM_SHARDS-1", () => {
    expect(NUM_SHARDS).toBe(20);
    for (let i = 0; i < 500; i++) {
      const n = randomShard();
      expect(Number.isInteger(n) && n >= 0 && n < NUM_SHARDS).toBe(true);
    }
  });
});

describe("tallyActive", () => {
  const fin = new Date(KICKOFF.getTime() + 110 * MIN);
  const ft = game({ status: "FT", elapsed: 90, finishedAt: fin });
  it("aberta -> sim; antes do minuto 80 -> não", () => {
    expect(tallyActive(game({ elapsed: 80 }), fin)).toBe(true);
    expect(tallyActive(game({ elapsed: 79 }), fin)).toBe(false);
    expect(tallyActive(game({ status: "NS", elapsed: null }), fin)).toBe(false);
  });
  it("fechada há até 10 min -> sim; depois -> não", () => {
    const closes = fin.getTime() + 20 * MIN;
    expect(tallyActive(ft, new Date(closes - MIN))).toBe(true);
    expect(tallyActive(ft, new Date(closes + 10 * MIN))).toBe(true);
    expect(tallyActive(ft, new Date(closes + 10 * MIN + 1))).toBe(false);
  });
});

describe("contentionToUnavailable", () => {
  it.each([10, "ABORTED", "aborted"])("código %p -> HttpsError unavailable", (code) => {
    const out = contentionToUnavailable(Object.assign(new Error("10 ABORTED: Too much contention"), { code }));
    expect(out).toBeInstanceOf(HttpsError);
    expect(out).toMatchObject({ code: "unavailable", message: "TRY_AGAIN" });
  });
  it("outros erros ficam iguais", () => {
    const e = Object.assign(new Error("x"), { code: 14 });
    expect(contentionToUnavailable(e)).toBe(e);
    const h = new HttpsError("invalid-argument", "y");
    expect(contentionToUnavailable(h)).toBe(h);
    expect(contentionToUnavailable(null)).toBe(null);
  });
});
