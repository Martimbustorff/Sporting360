// Respostas reais gravadas a 20/11 (Sporting 1-0 Moreirense, jogo 1575543; Liga 2026/27; VSports Liga).
// Prendem a forma real da API: o que os testes com fixtures sintéticas não podiam provar.
import * as fs from "fs";
import * as path from "path";
import { mapFixture } from "../../src/football/mapFixture";
import { legacyFromFixture } from "../../src/legacy/footballLegacy";
import { legacyStandings } from "../../src/legacy/standingsLegacy";
import type { AfFixture } from "../../src/sources/apiFootball.types";
import type { VsportsRoundsResponse } from "../../src/sources/vsports";
import { lisbonDayKey, VSPORTS_SPORTING_ID } from "../../src/videos/videosSync";

const REAL = path.join(__dirname, "../fixtures/api-football/real");
const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const ctx = { now: new Date("2026-11-08T12:00:00Z"), previous: null, observedLive: false };

function undefinedPaths(v: unknown, at = ""): string[] {
  if (v === undefined) return [at];
  if (Array.isArray(v)) return v.flatMap((x, i) => undefinedPaths(x, `${at}[${i}]`));
  if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) {
    return Object.entries(v).flatMap(([k, x]) => undefinedPaths(x, at ? `${at}.${k}` : k));
  }
  return [];
}

describe("API-Football real: jogo terminado", () => {
  const f = read(path.join(REAL, "fixture-ft.json")).response[0] as AfFixture;

  it("estatísticas por jogador: id e nome vêm de `player` (nunca 'undefined')", () => {
    const teams = mapFixture(f, ctx).details.players!.teams;
    const lines = teams.flatMap((t) => t.players);
    expect(lines.length).toBeGreaterThan(22);
    for (const l of lines) {
      expect(l.playerId).toMatch(/^\d+$/);
      expect(typeof l.name).toBe("string");
      expect(l.name.length).toBeGreaterThan(0);
    }
  });

  it("suplente = quem não está no onze (a API manda substitute sempre false)", () => {
    const { details } = mapFixture(f, ctx);
    for (const t of details.players!.teams) {
      const xi = new Set(f.lineups.find((l) => String(l.team.id) === t.teamId)!.startXI.map((x) => String(x.player.id)));
      for (const p of t.players) expect(p.substitute).toBe(!xi.has(p.playerId));
      expect(t.players.filter((p) => !p.substitute)).toHaveLength(11);
      expect(t.players.some((p) => p.substitute)).toBe(true);
    }
  });

  it("documentos da V2 sem undefined e com nomes dos jogadores", () => {
    const { match } = mapFixture(f, ctx);
    const docs = legacyFromFixture(f, match, null);
    expect(undefinedPaths(docs)).toEqual([]);
    const players = Object.values(docs.players).flatMap((d) => d.Players as { playerId: string; name: string; grid: string; substitute: boolean }[]);
    expect(players.every((p) => /^\d+$/.test(p.playerId) && p.name.length > 0)).toBe(true);
    // Suplente que entrou herda a posição (grid) do titular que saiu.
    expect(players.filter((p) => p.substitute && p.grid !== "").length).toBeGreaterThan(0);
  });

  it("substituição: `player` sai e `assist` entra (minutos batem)", () => {
    const s = f.events.find((e) => e.type === "subst")!;
    const stats = f.players.flatMap((t) => t.players);
    const minutesOf = (id: number | null) => stats.find((p) => p.player.id === id)!.statistics[0].games.minutes!;
    expect(minutesOf(s.player.id)).toBeGreaterThanOrEqual(s.time.elapsed - 1);
    expect(minutesOf(s.assist.id)).toBeLessThanOrEqual(90 - s.time.elapsed + 10);
  });
});

describe("API-Football real: classificação da Liga", () => {
  it("18 linhas, uma por equipa, com o Sporting", () => {
    const docs = legacyStandings(read(path.join(REAL, "standings-94.json")).response, 94, "2026");
    expect(Object.keys(docs)).toHaveLength(18);
    expect(Object.keys(docs)).toContain("228_94_2026");
  });
});

describe("VSports real: jornadas da Liga", () => {
  const r = read(path.join(__dirname, "../fixtures/vsports/real/rounds-1.json")) as VsportsRoundsResponse;

  it("época 2026/2027 é a 31 e o Sporting é a equipa 6", () => {
    expect(r.season.id).toBe("31");
    expect(r.matches.filter((m) => m.hteam.id === VSPORTS_SPORTING_ID || m.ateam.id === VSPORTS_SPORTING_ID)).toHaveLength(34);
  });

  it("`dt` em D/M/AAAA coincide com o dia de Lisboa do jogo", () => {
    const day = lisbonDayKey(new Date("2026-11-07T20:30:00Z"));
    const m = r.matches.find((x) => x.dt === day && (x.hteam.id === VSPORTS_SPORTING_ID || x.ateam.id === VSPORTS_SPORTING_ID));
    expect(m).toBeDefined();
    expect(Number(m!.n_vdos)).toBeGreaterThan(0);
  });
});
