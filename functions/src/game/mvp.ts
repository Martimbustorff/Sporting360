export interface PlayerLine {
  playerId: string;
  name: string;
  teamIsSporting: boolean;
  minutes: number | null;
  rating: number | null;
}

/**
 * Candidatos a MVP: jogadores do Sporting que jogaram (minutes > 0), ordenados por nome. Uma linha repetida do mesmo
 * `playerId` conta uma vez (fica a primeira). A app tem a mesma regra em mobile/src/lib/gameWindows.ts.
 */
export function mvpCandidates(lines: PlayerLine[]): PlayerLine[] {
  const seen = new Set<string>();
  return lines
    .filter((p) => p.teamIsSporting && p.minutes !== null && p.minutes > 0)
    .filter((p) => !seen.has(p.playerId) && seen.add(p.playerId))
    .sort((a, b) => a.name.localeCompare(b.name, "pt"));
}

/**
 * MVP oficial: candidatos com o rating máximo. Ratings null (ou NaN) são ignorados.
 * Empate conta como todos certos. Vazio se nenhum candidato tiver rating.
 */
export function officialMvpIds(lines: PlayerLine[]): string[] {
  const rated = mvpCandidates(lines).filter(
    (p): p is PlayerLine & { rating: number } => p.rating !== null && !Number.isNaN(p.rating),
  );
  if (rated.length === 0) return [];
  const max = Math.max(...rated.map((p) => p.rating));
  return rated.filter((p) => p.rating === max).map((p) => p.playerId);
}
