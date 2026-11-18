// Posições do ranking (spec §6): ordem do servidor (pontos por ordem decrescente); empates com a mesma posição e a
// seguinte salta (ranking de competição: 1, 2, 2, 4). Igual a `fetchMyPosition` (pessoas com mais pontos, mais um).
import type { RankingVM } from '@/components/RankingRow';
import type { LeaderboardEntry } from '@/data/schemas';

export function rankPositions(entries: LeaderboardEntry[]): RankingVM[] {
  let position = 0;
  return entries.map((entry, i) => {
    if (i === 0 || entry.points !== entries[i - 1]?.points) position = i + 1;
    return { position, uid: entry.uid, displayName: entry.displayName, points: entry.points };
  });
}
