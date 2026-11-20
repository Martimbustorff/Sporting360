import { formFromFixtures } from "../../src/football/prematchSync";
import type { AfFixtureCore } from "../../src/sources/apiFootball.types";

const fx = (ts: number, home: number, away: number, homeWin: boolean | null, status = "FT") =>
  ({
    fixture: { id: ts, timestamp: ts, status: { short: status } },
    teams: { home: { id: home, winner: homeWin }, away: { id: away, winner: homeWin === null ? null : !homeWin } },
  }) as unknown as AfFixtureCore;

describe("formFromFixtures (20/11: últimos 5 em qualquer competição)", () => {
  it("do mais antigo para o mais recente, do ponto de vista da equipa", () => {
    const list = [fx(3, 228, 9, true), fx(1, 9, 228, true), fx(2, 228, 8, null)];
    expect(formFromFixtures(list, "228")).toBe("LDW");
  });
  it("só jogos acabados (FT, AET, PEN) e no máximo 5", () => {
    const list = [1, 2, 3, 4, 5, 6].map((t) => fx(t, 228, 9, true)).concat(fx(7, 228, 9, null, "NS"));
    expect(formFromFixtures(list, "228")).toBe("WWWWW");
  });
  it("penáltis: conta o vencedor da API", () => {
    expect(formFromFixtures([fx(1, 228, 9, false, "PEN")], "228")).toBe("L");
  });
});
