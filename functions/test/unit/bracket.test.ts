import * as fs from "fs";
import * as path from "path";
import { SPORTING_CREST_URL } from "../../src/config/brand";
import { buildBracket, competitionView, stageOf, toFixtureItems } from "../../src/football/bracket";
import type { AfFixtureCore } from "../../src/sources/apiFootball.types";

const FIX = path.join(__dirname, "..", "fixtures", "api-football");
const load = (n: string): AfFixtureCore[] => JSON.parse(fs.readFileSync(path.join(FIX, n), "utf8")).response;

describe("stageOf", () => {
  it.each([
    ["Regular Season - 11", "table"],
    ["League Stage - 8", "table"],
    ["Group Stage - 3", "table"],
    ["Group A - 2", "table"],
    ["Round of 16", "knockout"],
    ["3rd Round", "knockout"],
    ["Play-offs", "knockout"],
    ["Knockout Round Play-offs", "knockout"],
    ["Quarter-finals", "knockout"],
    ["Semi-finals", "knockout"],
    ["Final", "knockout"],
    ["Preliminary Round", null],
    ["Qualificação", null],
    [null, null],
  ])("%s -> %s", (raw, expected) => {
    expect(stageOf(raw)).toBe(expected);
  });
});

describe("buildBracket, Liga dos Campeões", () => {
  const items = toFixtureItems(load("fixtures-ucl-2.json"), "europe");
  const bracket = buildBracket(items, ["League Stage - 8", "Knockout Round Play-offs", "Round of 16"]);

  it("ignora a fase de liga e ordena as etapas pelas rondas da API", () => {
    expect(bracket.stages.map((s) => s.raw)).toEqual(["Knockout Round Play-offs", "Round of 16"]);
    expect(bracket.stages.map((s) => s.label)).toEqual(["Play-off", "Oitavos de final"]);
  });

  it("play-off a duas mãos numa só eliminatória, agregado com prolongamento", () => {
    const tie = bracket.stages[0].ties.find((t) => t.sportingInvolved)!;
    expect(bracket.stages[0].ties).toHaveLength(2);
    expect(tie.home.id).toBe("569");
    expect(tie.away.id).toBe("228");
    expect(tie.legs.map((l) => l.matchId)).toEqual(["2500002", "2500004"]);
    expect(tie.legs[1]).toMatchObject({ status: "AET", score: { home: 2, away: 0, penaltyHome: null, penaltyAway: null } });
    expect(tie.aggregate).toEqual({ home: 2, away: 3 });
    expect(tie.winnerTeamId).toBe("228");
    expect(tie.away.logo).toBe(SPORTING_CREST_URL);
  });

  it("eliminatória sem o Sporting", () => {
    const tie = bracket.stages[0].ties.find((t) => !t.sportingInvolved)!;
    expect(tie.aggregate).toEqual({ home: 2, away: 1 });
    expect(tie.winnerTeamId).toBe("645");
  });

  it("mãos por jogar: sem agregado nem vencedor", () => {
    const ties = bracket.stages[1].ties;
    expect(ties).toHaveLength(2);
    for (const t of ties) {
      expect(t.aggregate).toBeNull();
      expect(t.winnerTeamId).toBeNull();
      expect(t.sportingInvolved).toBe(false);
    }
    // 1.ª mão jogada, 2.ª por jogar
    expect(ties.find((t) => t.home.id === "42")!.legs).toHaveLength(2);
  });

  it("sem rondas da API ordena pelo primeiro jogo", () => {
    expect(buildBracket(items).stages.map((s) => s.raw)).toEqual(["Knockout Round Play-offs", "Round of 16"]);
  });
});

describe("buildBracket, Taça de Portugal", () => {
  const bracket = buildBracket(toFixtureItems(load("fixtures-cup-96.json"), "cup"), ["3rd Round", "Quarter-finals", "Final"]);

  it("uma eliminatória por jogo único", () => {
    expect(bracket.stages.map((s) => [s.raw, s.ties.length])).toEqual([["3rd Round", 3], ["Quarter-finals", 1], ["Final", 1]]);
    expect(bracket.stages[0].label).toBe("3.ª eliminatória");
  });

  it("vencedor pelo resultado, pelos penáltis e por decidir", () => {
    const [a, b, c] = bracket.stages[0].ties;
    expect(a.sportingInvolved).toBe(true);
    expect(a.aggregate).toEqual({ home: 0, away: 2 });
    expect(a.winnerTeamId).toBe("228");
    expect(b.aggregate).toEqual({ home: 1, away: 1 });
    expect(b.legs[0].score).toEqual({ home: 1, away: 1, penaltyHome: 4, penaltyAway: 3 });
    expect(b.winnerTeamId).toBe("762");
    expect(c.winnerTeamId).toBe("224");
    expect(bracket.stages[1].ties[0]).toMatchObject({ aggregate: null, winnerTeamId: null, sportingInvolved: true });
  });
});

describe("competitionView", () => {
  it("Taça de Portugal, sem tabela: quadro", () => {
    expect(competitionView("cup", "3rd Round", false, true)).toEqual({ primary: "bracket", hasTable: false, hasBracket: true, currentStage: "3.ª eliminatória" });
  });
  it("Liga dos Campeões na fase de liga: tabela", () => {
    expect(competitionView("europe", "League Stage - 6", true, false)).toEqual({ primary: "table", hasTable: true, hasBracket: false, currentStage: "Fase de liga, J6" });
  });
  it("Liga dos Campeões no play-off: quadro, com tabela disponível", () => {
    expect(competitionView("europe", "Knockout Round Play-offs", true, true)).toEqual({ primary: "bracket", hasTable: true, hasBracket: true, currentStage: "Play-off" });
  });
  it("Liga Portugal: tabela", () => {
    expect(competitionView("league", "Regular Season - 12", true, false)).toMatchObject({ primary: "table", currentStage: "J12" });
  });
  it("sem ronda atual e com tabela: tabela", () => {
    expect(competitionView("league", null, true, false)).toMatchObject({ primary: "table", currentStage: null });
  });
});
