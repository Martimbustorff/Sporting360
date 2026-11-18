import {
  INLINE_REFRESH_MS,
  LIVE_REQUEST_TIMEOUT_MS,
  TICK_DEADLINE_MS,
  LIVE_INTERVAL_MS,
  LIVE_ITERATIONS,
  POSTMATCH_TAIL_MS,
  PREMATCH_LEAD_MS,
  RATINGS_REFRESH_MIN,
  liveRate,
  phaseFor,
  ratingsSlot,
} from "../../src/football/liveTicker";
import type { MatchDoc } from "../../src/model/types";

const KICKOFF = new Date("2026-11-22T20:00:00Z");
const MIN = 60_000;
const at = (min: number) => new Date(KICKOFF.getTime() + min * MIN);

function match(over: Partial<MatchDoc> = {}): MatchDoc {
  return {
    id: "1500003",
    sport: "football",
    competition: { key: "football_94_2026", id: "94", name: "Liga Portugal", type: "league", season: "2026", round: null, roundLabel: null },
    home: { id: "228", name: "Sporting CP", logo: null },
    away: { id: "211", name: "Benfica", logo: null },
    sportingSide: "home",
    kickoff: KICKOFF,
    status: "NS",
    statusRaw: "NS",
    elapsed: null,
    elapsedExtra: null,
    score: { home: null, away: null, halftime: null, extratime: null, penalty: null },
    finishedAt: null,
    finishedAtSource: null,
    referee: null,
    source: { provider: "api-football", id: "1500003" },
    ...over,
  };
}

const finished = (finishedMin: number, status: MatchDoc["status"] = "FT") =>
  match({ status, statusRaw: status, finishedAt: at(finishedMin), finishedAtSource: "observed" });

describe("constantes", () => {
  it("valores do plano", () => {
    expect(LIVE_INTERVAL_MS).toBe(15_000);
    expect(LIVE_ITERATIONS).toBe(4);
    expect(PREMATCH_LEAD_MS).toBe(75 * MIN);
    expect(POSTMATCH_TAIL_MS).toBe(25 * MIN);
    expect(RATINGS_REFRESH_MIN).toEqual([30, 60, 110]);
  });

  it("INLINE_REFRESH_MS deixa 7 pedidos no timeout acabarem com 5 s de folga antes do prazo do tick", () => {
    expect(INLINE_REFRESH_MS).toBe(TICK_DEADLINE_MS - 7 * LIVE_REQUEST_TIMEOUT_MS - 5_000);
    expect(INLINE_REFRESH_MS).toBe(20_000);
    expect(INLINE_REFRESH_MS + 7 * LIVE_REQUEST_TIMEOUT_MS).toBeLessThan(TICK_DEADLINE_MS);
  });
});

describe("phaseFor", () => {
  it("NS a 80 min do início → idle", () => {
    expect(phaseFor(match(), at(-80))).toBe("idle");
  });
  it("NS a 70 min → prematch", () => {
    expect(phaseFor(match(), at(-70))).toBe("prematch");
  });
  it("NS exatamente a 75 min → prematch; 1 ms antes do kickoff → prematch", () => {
    expect(phaseFor(match(), at(-75))).toBe("prematch");
    expect(phaseFor(match(), new Date(KICKOFF.getTime() - 1))).toBe("prematch");
  });
  it("NS 5 min depois do kickoff (atraso no início) → live", () => {
    expect(phaseFor(match(), at(5))).toBe("live");
    expect(phaseFor(match(), KICKOFF)).toBe("live");
  });
  it("NS 4 h depois do kickoff → idle", () => {
    expect(phaseFor(match(), at(240))).toBe("idle");
    expect(phaseFor(match(), at(239))).toBe("live");
  });
  it("HT e LIVE → live", () => {
    expect(phaseFor(match({ status: "HT", statusRaw: "HT" }), at(50))).toBe("live");
    expect(phaseFor(match({ status: "LIVE", statusRaw: "2H" }), at(70))).toBe("live");
  });
  it("FT com finishedAt há 10 min → postmatch", () => {
    expect(phaseFor(finished(110), at(120))).toBe("postmatch");
  });
  it("AET e PEN contam como final", () => {
    expect(phaseFor(finished(150, "AET"), at(160))).toBe("postmatch");
    expect(phaseFor(finished(150, "PEN"), at(160))).toBe("postmatch");
  });
  it("FT há 25 min → idle (fim do postmatch)", () => {
    expect(phaseFor(finished(110), at(135))).toBe("idle");
  });
  it("FT há 30 min → ratings, e continua ratings até aos 40 (janela de 10 min; o tick usa a marca)", () => {
    expect(phaseFor(finished(110), at(140))).toBe("ratings");
    expect(phaseFor(finished(110), at(141))).toBe("ratings");
    expect(phaseFor(finished(110), new Date(at(150).getTime() - 1))).toBe("ratings");
    expect(phaseFor(finished(110), at(150))).toBe("idle");
    expect(phaseFor(finished(110), at(139))).toBe("idle");
  });
  it("FT há 60 e 110 min → ratings; há 70 e 120 → idle", () => {
    expect(phaseFor(finished(110), at(170))).toBe("ratings");
    expect(phaseFor(finished(110), at(180))).toBe("idle");
    expect(phaseFor(finished(110), at(220))).toBe("ratings");
    expect(phaseFor(finished(110), at(229))).toBe("ratings");
    expect(phaseFor(finished(110), at(230))).toBe("idle");
  });
  it("ratingsSlot devolve o minuto da janela", () => {
    expect(ratingsSlot(finished(110), at(141))).toBe(30);
    expect(ratingsSlot(finished(110), at(175))).toBe(60);
    expect(ratingsSlot(finished(110), at(221))).toBe(110);
    expect(ratingsSlot(finished(110), at(200))).toBeNull();
    expect(ratingsSlot(match(), at(141))).toBeNull();
  });
  it("final sem finishedAt → idle", () => {
    expect(phaseFor(match({ status: "FT", statusRaw: "FT" }), at(120))).toBe("idle");
  });
  it("PST com kickoff há 10 min → idle; CANC → idle", () => {
    expect(phaseFor(match({ status: "PST", statusRaw: "PST" }), at(10))).toBe("idle");
    expect(phaseFor(match({ status: "CANC", statusRaw: "CANC" }), at(10))).toBe("idle");
    expect(phaseFor(match({ status: "PST", statusRaw: "PST" }), at(-30))).toBe("idle");
  });
});

describe("liveRate", () => {
  it("NS atrasado: rápido nos primeiros 20 min, depois lento", () => {
    expect(liveRate(match(), at(5))).toBe("fast");
    expect(liveRate(match(), new Date(at(20).getTime() - 1))).toBe("fast");
    expect(liveRate(match(), at(20))).toBe("slow");
    expect(liveRate(match(), at(200))).toBe("slow");
  });
  it("LIVE/HT: rápido até kickoff + 4 h, depois lento", () => {
    const live = match({ status: "LIVE", statusRaw: "INT" });
    expect(liveRate(live, at(239))).toBe("fast");
    expect(liveRate(live, at(240))).toBe("slow");
    expect(liveRate(match({ status: "HT", statusRaw: "HT" }), at(250))).toBe("slow");
  });
});
