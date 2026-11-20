// Celebração do golo (Plano 10, Figma 55). Martim 20/11: só futebol, só golos do Sporting, só com a app aberta.
// Regras puras: a primeira leitura de um jogo nunca celebra (abrir a app a meio do jogo), um resultado que desce
// (golo anulado) baixa a referência, e só um jogo ao vivo (LIVE) celebra.
import type { EventItem, Match } from '@/data/schemas';
import { goalsFromEvents } from '@/lib/matchVM';

export type GoalWatch = { id: string; goals: number } | null;

export const CELEBRATION_MS = 2000;

const sportingGoals = (m: Match): number => m.score[m.sportingSide] ?? 0;

export function nextGoalWatch(prev: GoalWatch, match: Match | null): { watch: GoalWatch; goal: boolean } {
  if (!match) return { watch: null, goal: false };
  const goals = sportingGoals(match);
  const watch = { id: match.id, goals };
  const goal = prev !== null && prev.id === match.id && match.status === 'LIVE' && goals > prev.goals;
  return { watch, goal };
}

/** "Trincão 54’": o último golo do Sporting, só quando os lances já contam todos os golos do resultado. */
export function celebrationScorer(match: Match, items: EventItem[]): string | null {
  const ours = goalsFromEvents(items, match.home.id).filter((g) => g.side === match.sportingSide);
  if (ours.length !== sportingGoals(match)) return null;
  return ours.at(-1)?.text || null;
}
