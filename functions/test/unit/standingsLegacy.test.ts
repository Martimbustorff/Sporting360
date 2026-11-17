import * as fs from "fs";
import * as path from "path";
import { SPORTING_CREST_URL } from "../../src/config/brand";
import { legacyStandings } from "../../src/legacy/standingsLegacy";

const FIX = path.join(__dirname, "..", "fixtures", "api-football");
const load = (n: string) => JSON.parse(fs.readFileSync(path.join(FIX, n), "utf8")).response;

describe("legacyStandings", () => {
  it("liga 94: id, competição antiga, números em string, só o grupo do 228", () => {
    const docs = legacyStandings(load("standings-94.json"), 94, "2026");
    expect(Object.keys(docs)).toHaveLength(8);
    expect(docs["228_94_2026"]).toMatchObject({
      api: "228_94_2026",
      season: "2026",
      competition: "Primeira Liga",
      rank: "1",
      points: "28",
      played: expect.any(String),
      win: expect.any(String),
      draw: expect.any(String),
      lose: expect.any(String),
      goalsfor: expect.any(String),
      goalsagainst: expect.any(String),
      team: { name: "Sporting CP", api: "228" },
    });
    for (const d of Object.values(docs)) {
      for (const k of ["points", "rank", "goalsfor", "goalsagainst", "played", "win", "draw", "lose"]) expect(typeof d[k]).toBe("string");
    }
  });

  it("liga 2 com fase de liga: UEFA Champions League", () => {
    const docs = legacyStandings(load("standings-2.json"), 2, "2026");
    expect(docs["228_2_2026"].competition).toBe("UEFA Champions League");
  });

  it("nomes antigos das taças", () => {
    const r = load("standings-94.json");
    expect(Object.values(legacyStandings(r, 97, "2026"))[0].competition).toBe("Taça da Liga");
    expect(Object.values(legacyStandings(r, 96, "2026"))[0].competition).toBe("Taça de Portugal");
  });

  it("o logótipo do 228 é o emblema novo; os outros mantêm o da API", () => {
    const docs = legacyStandings(load("standings-94.json"), 94, "2026");
    expect(docs["228_94_2026"].team.logo).toBe(SPORTING_CREST_URL);
    const other = Object.values(docs).find((d) => d.team.api !== "228")!;
    expect(other.team.logo).not.toBe(SPORTING_CREST_URL);
  });

  it("só o grupo do 228; sem o 228 em nenhum grupo, nada", () => {
    const r = load("standings-94.json");
    const rows = r[0].league.standings[0];
    const multi = [{ league: { ...r[0].league, standings: [rows.slice(0, 3).map((x: any) => ({ ...x, team: { ...x.team, id: x.team.id + 1000 } })), rows] } }];
    expect(Object.keys(legacyStandings(multi as any, 94, "2026"))).toHaveLength(8);
    const none = [{ league: { ...r[0].league, standings: [rows.filter((x: any) => x.team.id !== 228)] } }];
    expect(legacyStandings(none as any, 94, "2026")).toEqual({});
    expect(legacyStandings([], 94, "2026")).toEqual({});
  });
});
