import { REAL_ROUND_TEXTS } from "../../src/modalities/sourcesConfig";
import { competitionKey, competitionLabel, roundLabel } from "../../src/model/labels";
import { apiSportsSeason, footballApiSeason, seasonsToFetch } from "../../src/model/seasons";
import { apiSportsStatus, FINAL_STATUSES, footballStatus, LIVE_STATUSES } from "../../src/model/status";

describe("roundLabel", () => {
  const cases: Array<[string | null, string | null]> = [
    ["Regular Season - 11", "J11"],
    ["League Stage - 5", "Fase de liga, J5"],
    ["Group Stage - 3", "Fase de grupos, J3"],
    ["Group A - 3", "Fase de grupos, J3"],
    ["Round of 32", "16 avos de final"],
    ["Round of 16", "Oitavos de final"],
    ["Quarter-finals", "Quartos de final"],
    ["Semi-finals", "Meias-finais"],
    ["Final", "Final"],
    ["1st Round", "1.ª eliminatória"],
    ["3rd Round", "3.ª eliminatória"],
    ["8th Finals", "Oitavos de final"],
    ["16th Finals", "16 avos de final"],
    ["1/8-finals", "Oitavos de final"],
    ["1/16-finals", "16 avos de final"],
    ["Knockout Round Play-offs", "Play-off"],
    ["Play-offs", "Play-off"],
    [null, null],
    ["Strange Round", "Strange Round"],
  ];
  it.each(cases)("%s -> %s", (raw, expected) => {
    expect(roundLabel(raw, "league")).toBe(expected);
  });

  it("amigáveis não têm ronda", () => {
    expect(roundLabel("Club Friendlies 3", "friendly")).toBeNull();
  });

  it("texto sem número de jornada nunca começa por J", () => {
    expect(roundLabel("Jogo extra", "league")).toBe("Jogo extra");
  });

  it("textos reais pt-PT das fontes gratuitas", () => {
    const expected: Record<string, string> = {
      "1ª Jornada": "J1",
      "26ª Jornada": "J26",
      "22ª Jornada": "J22",
      "Jornada 1": "J1",
      "0001-Jornada 1": "J1",
      Final: "Final",
      "0100-FINAL": "Final",
      "1/4 Final": "Quartos de final",
      "1/2 Final": "Meias-finais",
      "Meias Finais": "Meias-finais",
      "Meias-Finais": "Meias-finais",
      "0300-Quartos de Final": "Quartos de final",
      "Quartos-De-Final": "Quartos de final",
      "0400-Oitavos de Final": "Oitavos de final",
      "Oitavos-De-Final": "Oitavos de final",
      "8 Avos de Final": "Oitavos de final",
      "Taça de Portugal Masculina | 4 Avos de Final": "Quartos de final",
      "1ª Eliminatória": "1.ª eliminatória",
      "2.ª Eliminatória": "2.ª eliminatória",
      "3.ª Eliminatória": "3.ª eliminatória",
      "Pré Eliminatória Norte": "Pré Eliminatória Norte",
      "Pré Eliminatória Sul": "Pré Eliminatória Sul",
    };
    const all = new Set<string>([
      ...REAL_ROUND_TEXTS.hp_fpp,
      ...REAL_ROUND_TEXTS.hoqueipatins,
      ...REAL_ROUND_TEXTS.futsalportugal,
    ]);
    for (const raw of all) {
      expect(expected[raw]).toBeDefined();
      expect(roundLabel(raw, "league")).toBe(expected[raw]);
    }
  });
});

describe("roundLabel (API-Sports, textos das fixtures)", () => {
  // Textos de ronda das fixtures sintéticas: SUBSTITUIR pelos reais recolhidos na gravação (Task 21).
  it("rondas das outras modalidades", () => {
    expect(roundLabel("Regular Season - 7", "league")).toBe("J7");
    expect(roundLabel("Quarter-finals", "cup")).toBe("Quartos de final");
    expect(roundLabel("Semi-finals", "cup")).toBe("Meias-finais");
    expect(roundLabel("Final", "cup")).toBe("Final");
  });
});

describe("competitionLabel", () => {
  it("futebol por id", () => {
    expect(competitionLabel("football", 94, "Primeira Liga")).toEqual({ name: "Liga Portugal", type: "league" });
    expect(competitionLabel("football", 96, "x")).toEqual({ name: "Taça de Portugal", type: "cup" });
    expect(competitionLabel("football", 97, "x")).toEqual({ name: "Taça da Liga", type: "cup" });
    expect(competitionLabel("football", 550, "x")).toEqual({ name: "Supertaça", type: "supercup" });
    expect(competitionLabel("football", 2, "x")).toEqual({ name: "Liga dos Campeões", type: "europe" });
    expect(competitionLabel("football", 3, "x")).toEqual({ name: "Liga Europa", type: "europe" });
    expect(competitionLabel("football", 848, "x")).toEqual({ name: "Liga Conferência", type: "europe" });
    expect(competitionLabel("football", 531, "x")).toEqual({ name: "Supertaça Europeia", type: "europe" });
    expect(competitionLabel("football", 10, "x")).toEqual({ name: "Particular", type: "friendly" });
    expect(competitionLabel("football", 667, "Club Friendlies")).toEqual({ name: "Particular", type: "friendly" });
  });
  it("desconhecido devolve o nome original", () => {
    expect(competitionLabel("football", 9999, "Liga X")).toEqual({ name: "Liga X", type: "league" });
    expect(competitionLabel("football", null, "Liga X")).toEqual({ name: "Liga X", type: "league" });
  });
  it("outras modalidades por nome, com nomes pt-PT", () => {
    expect(competitionLabel("volleyball", null, "CEV Champions League")).toEqual({
      name: "Liga dos Campeões CEV",
      type: "europe",
    });
    expect(competitionLabel("handball", null, "EHF European League")).toEqual({
      name: "Liga Europa EHF",
      type: "europe",
    });
    expect(competitionLabel("basketball", null, "Taça de Portugal")).toEqual({ name: "Taça de Portugal", type: "cup" });
    expect(competitionLabel("futsal", null, "Supertaça")).toEqual({ name: "Supertaça", type: "supercup" });
    expect(competitionLabel("roller_hockey", null, "Competição Nova")).toEqual({
      name: "Competição Nova",
      type: "league",
    });
  });
  it("não usa o mapa de futebol por id noutras modalidades", () => {
    expect(competitionLabel("handball", 94, "Andebol 1")).toEqual({ name: "Andebol 1", type: "league" });
  });
});

describe("competitionKey", () => {
  it("formata sport_liga_época", () => {
    expect(competitionKey("football", 94, "2026")).toBe("football_94_2026");
    expect(competitionKey("basketball", null, "2026-2027")).toBe("basketball_null_2026-2027");
  });
});

describe("épocas", () => {
  it("footballApiSeason: agosto é o primeiro mês (hora de Lisboa)", () => {
    expect(footballApiSeason(new Date("2026-11-17T12:00:00Z"))).toBe("2026");
    expect(footballApiSeason(new Date("2027-07-31T22:00:00Z"))).toBe("2026");
    expect(footballApiSeason(new Date("2027-08-01T00:00:00+01:00"))).toBe("2027");
    expect(footballApiSeason(new Date("2027-01-15T12:00:00Z"))).toBe("2026");
  });
  it("seasonsToFetch", () => {
    expect(seasonsToFetch(new Date("2026-11-17T12:00:00Z"))).toEqual(["2026"]);
    expect(seasonsToFetch(new Date("2027-03-10T12:00:00Z"))).toEqual(["2026", "2027"]);
    expect(seasonsToFetch(new Date("2027-06-10T12:00:00Z"))).toEqual(["2026", "2027"]);
    expect(seasonsToFetch(new Date("2027-09-10T12:00:00Z"))).toEqual(["2027"]);
  });
  it("apiSportsSeason por formato", () => {
    expect(apiSportsSeason("year", new Date("2026-11-17T12:00:00Z"))).toBe("2026");
    expect(apiSportsSeason("span", new Date("2026-11-17T12:00:00Z"))).toBe("2026-2027");
    expect(apiSportsSeason("span", new Date("2027-03-10T12:00:00Z"))).toBe("2026-2027");
    expect(apiSportsSeason("span", new Date("2027-08-01T00:00:00+01:00"))).toBe("2027-2028");
  });
});

describe("estados", () => {
  it("conjuntos", () => {
    expect([...FINAL_STATUSES].sort()).toEqual(["AET", "FT", "PEN"]);
    expect([...LIVE_STATUSES].sort()).toEqual(["HT", "LIVE"]);
  });
  it("footballStatus", () => {
    expect(footballStatus("2H")).toBe("LIVE");
    expect(footballStatus("P")).toBe("LIVE");
    expect(footballStatus("INT")).toBe("LIVE");
    expect(footballStatus("AET")).toBe("AET");
    expect(footballStatus("PEN")).toBe("PEN");
    expect(footballStatus("SUSP")).toBe("PST");
    expect(footballStatus("ABD")).toBe("CANC");
    expect(footballStatus("AWD")).toBe("CANC");
    expect(footballStatus("WO")).toBe("CANC");
    expect(footballStatus("TBD")).toBe("NS");
    expect(footballStatus("XYZ")).toBe("NS");
  });
  it("apiSportsStatus", () => {
    expect(apiSportsStatus("volleyball", "S3")).toBe("LIVE");
    expect(apiSportsStatus("volleyball", "AW")).toBe("CANC");
    expect(apiSportsStatus("basketball", "AOT")).toBe("AET");
    expect(apiSportsStatus("basketball", "Q2")).toBe("LIVE");
    expect(apiSportsStatus("basketball", "OT")).toBe("LIVE");
    expect(apiSportsStatus("handball", "POST")).toBe("PST");
    expect(apiSportsStatus("handball", "1H")).toBe("LIVE");
    expect(apiSportsStatus("handball", "HT")).toBe("HT");
    expect(apiSportsStatus("handball", "AP")).toBe("PEN");
    expect(apiSportsStatus("handball", "AET")).toBe("AET");
    expect(apiSportsStatus("handball", "INTR")).toBe("PST");
    expect(apiSportsStatus("handball", "ABD")).toBe("CANC");
    expect(apiSportsStatus("handball", "CANC")).toBe("CANC");
    expect(apiSportsStatus("handball", "NS")).toBe("NS");
    expect(apiSportsStatus("handball", "???")).toBe("NS");
  });
});
