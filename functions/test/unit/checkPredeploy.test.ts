import { checkFunctions, checkRankings, checkNoSource, emailUserNames, parseFunctionsList, shadowFailures } from "../../scripts/check-predeploy";

describe("checkRankings", () => {
  it("aceita season aaaa-aaaa e id userId_season", () => {
    expect(checkRankings([{ id: "u1_2026-2027", data: { userId: "u1", season: "2026-2027", points: 3 } }])).toEqual([]);
  });

  it("rejeita season em falta, com outro formato ou que não é string, e id diferente", () => {
    const bad = checkRankings([
      { id: "u1", data: { userId: "u1", points: 1 } },
      { id: "u2_2026", data: { userId: "u2", season: "2026" } },
      { id: "u3_2026-2027", data: { userId: "u3", season: 2026 } },
      { id: "u4_2025-2026", data: { userId: "u4", season: "2026-2027" } },
      { id: "x_2026-2027", data: { season: "2026-2027" } },
    ]);
    expect(bad.map((b) => b.id)).toEqual(["u1", "u2_2026", "u3_2026-2027", "u4_2025-2026", "x_2026-2027"]);
  });
});

describe("checkNoSource", () => {
  it("lista os documentos com o campo source, mesmo a null", () => {
    expect(checkNoSource([{ id: "a", data: { userId: "u" } }, { id: "b", data: { source: "v2027" } }, { id: "c", data: { source: null } }])).toEqual(["b", "c"]);
  });
});

describe("checkFunctions", () => {
  const legacy = (id: string) => ({ id, region: "us-central1", codebase: "default" });
  it("as 13 antigas em us-central1 e as v2027 em europe-west1 passam", () => {
    const r = checkFunctions([legacy("gamesSheduler"), legacy("games"), { id: "footballLiveTicker", region: "europe-west1", codebase: "v2027" }]);
    expect(r.unknown).toEqual([]);
    expect(r.legacy).toEqual(["gamesSheduler", "games"]);
    expect(r.v2027).toEqual(["footballLiveTicker"]);
    expect(r.legacyMissing).toHaveLength(11);
  });

  it("uma function fora das listas (ex. cleanup antigo) ou na região errada falha", () => {
    const r = checkFunctions([
      legacy("cleanup"),
      { id: "gamesSheduler", region: "europe-west1", codebase: "default" },
      { id: "footballLiveTicker", region: "us-central1", codebase: "default" },
    ]);
    expect(r.unknown).toEqual(["cleanup (us-central1)", "gamesSheduler (europe-west1)", "footballLiveTicker (us-central1)"]);
  });

  it("lê o JSON do firebase functions:list --json", () => {
    const out = JSON.stringify({ status: "success", result: [{ id: "games", region: "us-central1", platform: "gcfv2" }] });
    expect(parseFunctionsList(out)).toEqual([{ id: "games", region: "us-central1", codebase: undefined }]);
    expect(() => parseFunctionsList(JSON.stringify({ status: "error", error: "sem permissão" }))).toThrow(/sem permissão/);
  });
});

describe("emailUserNames (informativo)", () => {
  it("conta os userName com @", () => {
    expect(emailUserNames([{ id: "a", data: { userName: "x@y.pt" } }, { id: "b", data: { userName: "Ana S." } }, { id: "c", data: {} }])).toEqual(["a"]);
  });
});

describe("shadowFailures", () => {
  it("sombra com jogos e nada marcado nas reais: passa", () => {
    expect(shadowFailures({ shadowGames: 40, leaked: { games: 0, standings: 0 } })).toEqual([]);
  });
  it("sombra vazia ou documentos reais com _ingest v2027: falha", () => {
    expect(shadowFailures({ shadowGames: 0, leaked: { games: 3, standings: 0 } })).toHaveLength(2);
  });
});
