import { outcome } from "./result";

export const POINTS = { participation: 1, exact: 3, outcome: 1, mvpCorrect: 2 } as const;

export function predictionBonus(
  pred: { home: number; away: number },
  final: { home: number; away: number },
): 0 | 1 | 3 {
  if (pred.home === final.home && pred.away === final.away) return POINTS.exact;
  if (outcome(pred.home, pred.away) === outcome(final.home, final.away)) return POINTS.outcome;
  return 0;
}

export function mvpBonus(votedPlayerId: string, officialIds: string[]): 0 | 2 {
  return officialIds.includes(votedPlayerId) ? POINTS.mvpCorrect : 0;
}
