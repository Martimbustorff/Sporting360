import { activityProps, activitySignature, phaseOf, roundText } from "../../src/liveActivity/props";
import type { EventItem } from "../../src/football/mapFixture";
import type { MatchDoc } from "../../src/model/types";

const NOW = new Date("2026-12-21T21:40:00Z");
const m = (over: Partial<MatchDoc> = {}): MatchDoc =>
  ({
    id: "g1",
    sport: "football",
    competition: { key: "football_94_2026", id: "94", name: "Liga Portugal", type: "league", season: "2026", round: "Regular Season - 12", roundLabel: null },
    home: { id: "228", name: "Sporting CP", logo: null },
    away: { id: "212", name: "FC Porto", logo: null },
    sportingSide: "home",
    kickoff: new Date("2026-12-21T20:30:00Z"),
    status: "LIVE",
    statusRaw: "2H",
    elapsed: 67,
    elapsedExtra: null,
    score: { home: 2, away: 1, halftime: null, extratime: null, penalty: null },
    finishedAt: null,
    finishedAtSource: null,
    referee: null,
    ...over,
  }) as MatchDoc;
const goal = (minute: number, teamId: string, playerName: string, detail = "Normal Goal"): EventItem =>
  ({ minute, extra: null, teamId, playerId: "1", playerName, assistId: null, assistName: null, type: "goal", detail, comments: null });

describe("phaseOf", () => {
  it.each([
    ["1H", "LIVE", "1.ª PARTE", true],
    ["2H", "LIVE", "2.ª PARTE", true],
    ["HT", "HT", "INTERVALO", false],
    ["ET", "LIVE", "PROLONGAMENTO", true],
    ["P", "LIVE", "PENÁLTIS", false],
    ["FT", "FT", "FINAL", false],
  ] as const)("%s -> %s", (raw, status, label, running) => {
    expect(phaseOf(m({ statusRaw: raw, status }))).toEqual({ label, running });
  });
});

describe("roundText", () => {
  it("jornada", () => expect(roundText(m())).toBe("JORNADA 12"));
  it("sem número: o rótulo, em maiúsculas", () =>
    expect(roundText(m({ competition: { ...m().competition, round: "Final", roundLabel: "Final" } }))).toBe("FINAL"));
  it("sem nada: null", () => expect(roundText(m({ competition: { ...m().competition, round: null, roundLabel: null } }))).toBeNull());
});

describe("activityProps", () => {
  it("resultado, fase, relógio a partir do minuto atual e último golo", () => {
    const p = activityProps(m(), [goal(23, "228", "L. Suárez"), goal(38, "212", "Samu"), goal(54, "228", "Trincão")], NOW, "/grp/w");
    expect(p).toEqual({
      matchId: "g1",
      competition: "LIGA PORTUGAL",
      round: "JORNADA 12",
      homeName: "SPORTING",
      awayName: "FC PORTO",
      homeCrest: "/grp/w/crest_228.png",
      awayCrest: "/grp/w/crest_212.png",
      homeScore: 2,
      awayScore: 1,
      phase: "2.ª PARTE",
      clockFrom: NOW.getTime() - 67 * 60_000,
      minute: "67'",
      lastGoal: "Trincão 54'",
    });
  });
  it("sem pasta do dispositivo: sem emblemas", () => {
    const p = activityProps(m(), [], NOW, null);
    expect(p.homeCrest).toBeNull();
    expect(p.lastGoal).toBeNull();
  });
  it("intervalo e fim: sem relógio", () => {
    expect(activityProps(m({ status: "HT", statusRaw: "HT", elapsed: 45 }), [], NOW, null).clockFrom).toBeNull();
    expect(activityProps(m({ status: "FT", statusRaw: "FT", elapsed: 90 }), [], NOW, null).phase).toBe("FINAL");
  });
  it("penálti falhado não conta; descontos em 90+2'", () => {
    const ev = [goal(80, "228", "Gyökeres", "Missed Penalty"), { ...goal(90, "212", "Samu"), extra: 2 }];
    expect(activityProps(m(), ev, NOW, null).lastGoal).toBe("Samu 90+2'");
  });
});

describe("activitySignature", () => {
  it("o relógio não muda a assinatura; o resultado muda", () => {
    const a = activityProps(m(), [], NOW, "/d");
    const b = activityProps(m({ elapsed: 70 }), [], new Date(NOW.getTime() + 3 * 60_000), "/x");
    expect(activitySignature(a)).toBe(activitySignature(b));
    expect(activitySignature(activityProps(m({ score: { ...m().score, home: 3 } }), [], NOW, "/d"))).not.toBe(activitySignature(a));
  });
});
