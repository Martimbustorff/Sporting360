import { resolveTvChannel, tvForFixture } from "../../src/football/tvChannel";

const m = (homeName: string, awayName: string, over: Partial<{ leagueId: number; season: number }> = {}) => ({
  leagueId: 94,
  season: 2026,
  homeName,
  awayName,
  ...over,
});

describe("resolveTvChannel", () => {
  it("Sporting em casa: SPORT TV", () => expect(resolveTvChannel(m("Sporting CP", "Braga"), {}, "1")).toBe("SPORT TV"));
  it("fora no Benfica: BTV", () => expect(resolveTvChannel(m("Benfica", "Sporting CP"), {}, "1")).toBe("BTV"));
  it("fora no Moreirense: TVI / V+", () => expect(resolveTvChannel(m("Moreirense", "Sporting CP"), {}, "1")).toBe("TVI / V+"));
  it("fora noutro: SPORT TV", () => expect(resolveTvChannel(m("Famalicão", "Sporting CP"), {}, "1")).toBe("SPORT TV"));
  it("nomes sem acentos nem maiúsculas", () => {
    expect(resolveTvChannel(m("SL BENFICA", "Sporting CP"), {}, "1")).toBe("BTV");
    expect(resolveTvChannel(m("Moreirénse FC", "Sporting CP"), {}, "1")).toBe("TVI / V+");
  });
  it("só conta a equipa da casa", () => expect(resolveTvChannel(m("Sporting CP", "Benfica"), {}, "1")).toBe("SPORT TV"));
  it("outra liga ou outra época: null", () => {
    expect(resolveTvChannel(m("Sporting CP", "X", { leagueId: 96 }), {}, "1")).toBeNull();
    expect(resolveTvChannel(m("Sporting CP", "X", { season: 2025 }), {}, "1")).toBeNull();
    expect(resolveTvChannel(m("Sporting CP", "X", { season: 2027 }), {}, "1")).toBeNull();
  });
  it("exceção com texto ganha à regra, mesmo noutra competição", () => {
    expect(resolveTvChannel(m("Benfica", "Sporting CP"), { "1": "Canal 11" }, "1")).toBe("Canal 11");
    expect(resolveTvChannel(m("Sporting CP", "X", { leagueId: 2 }), { "1": "DAZN" }, "1")).toBe("DAZN");
  });
  it("exceção com texto vazio: null", () => {
    expect(resolveTvChannel(m("Sporting CP", "X"), { "1": "" }, "1")).toBeNull();
    expect(resolveTvChannel(m("Sporting CP", "X"), { "1": "  " }, "1")).toBeNull();
  });
  it("exceção de outro jogo não conta", () => expect(resolveTvChannel(m("Benfica", "Sporting CP"), { "2": "X" }, "1")).toBe("BTV"));
});

describe("tvForFixture", () => {
  const fx = (home: [number, string], away: [number, string], id = 7) => ({
    fixture: { id },
    league: { id: 94, season: 2026 },
    teams: { home: { id: home[0], name: home[1] }, away: { id: away[0], name: away[1] } },
  });
  it("sem o Sporting: null, salvo exceção", () => {
    expect(tvForFixture(fx([1, "Benfica"], [2, "Porto"]), {})).toBeNull();
    expect(tvForFixture(fx([1, "Benfica"], [2, "Porto"]), { "7": "Canal 11" })).toBe("Canal 11");
  });
  it("com o Sporting aplica a regra", () => expect(tvForFixture(fx([1, "Benfica"], [228, "Sporting CP"]), {})).toBe("BTV"));
});
