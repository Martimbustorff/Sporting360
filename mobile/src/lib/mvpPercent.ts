import type { MvpTally } from '@/data/schemas';

/**
 * Percentagens inteiras do MVP pelo método do maior resto, com base em `tally.total`. Soma 100 quando todos os votos
 * são de candidatos em `playerIds`; empates no resto vão pela ordem de `playerIds`. Jogador sem votos: 0.
 * `total === 0` devolve `{}`.
 */
export function mvpPercentages(tally: MvpTally, playerIds: string[]): Record<string, number> {
  const { total } = tally;
  if (total <= 0) return {};
  const rows = playerIds.map((id, index) => {
    const votes = tally.counts[id] ?? 0;
    return { id, index, floor: Math.floor((votes * 100) / total), rest: (votes * 100) % total, votes };
  });
  const votesForListed = rows.reduce((s, r) => s + r.votes, 0);
  const floors = rows.reduce((s, r) => s + r.floor, 0);
  let extra = Math.round((votesForListed * 100) / total) - floors;
  const out: Record<string, number> = {};
  for (const r of rows) out[r.id] = r.floor;
  const byRest = rows.filter((r) => r.rest > 0).sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (const r of byRest) {
    if (extra <= 0) break;
    out[r.id] = (out[r.id] ?? 0) + 1;
    extra -= 1;
  }
  return out;
}
