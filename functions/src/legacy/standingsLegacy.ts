import type { DocumentData } from "firebase-admin/firestore";
import { SPORTING_TEAM_ID, crestFor } from "../config/brand";
import type { AfStandingsResponse } from "../sources/apiFootball.types";

/** Ligas cuja classificação a V2 lê da coleção `standings`. */
export const LEGACY_STANDINGS_LEAGUES: readonly number[] = [94, 2, 97, 96];

const LEGACY_NAME: Record<number, string> = {
  94: "Primeira Liga",
  2: "UEFA Champions League",
  97: "Taça da Liga",
};

/**
 * standings/{teamId}_{league}_{season}, como nas functions antigas: só o grupo onde está o 228
 * (com um só grupo, esse), todos os números em string e o nome de competição antigo.
 * Sem o 228 em nenhum grupo, ou sem dados: mapa vazio (o escritor não apaga nada).
 */
export function legacyStandings(response: AfStandingsResponse[], leagueId: number, season: string): Record<string, DocumentData> {
  const out: Record<string, DocumentData> = {};
  for (const r of response) {
    const groups = r.league.standings;
    if (groups.length === 0) continue;
    const group = groups.find((g) => g.some((row) => row.team.id === SPORTING_TEAM_ID));
    if (!group) continue;
    for (const row of group) {
      const api = `${row.team.id}_${leagueId}_${season}`;
      out[api] = {
        api,
        season,
        points: String(row.points),
        rank: String(row.rank),
        goalsfor: String(row.all.goals.for),
        goalsagainst: String(row.all.goals.against),
        played: String(row.all.played),
        win: String(row.all.win),
        draw: String(row.all.draw),
        lose: String(row.all.lose),
        competition: LEGACY_NAME[leagueId] ?? "Taça de Portugal",
        team: { name: row.team.name, logo: crestFor(row.team.id, row.team.logo ?? null) ?? "", api: String(row.team.id) },
        _ingest: "v2027",
      };
    }
  }
  return out;
}
