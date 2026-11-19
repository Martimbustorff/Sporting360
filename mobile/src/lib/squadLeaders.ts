// Marcadores e assistências do plantel (Figma V7.1 frame 11, 4935:7423): filtro por competição, métrica e ordenação.
import type { PlayerSeasonStats } from '@/data/schemas';

export type LeaderFilter = 'all' | 'league' | 'champions' | 'cups';
export type LeaderMetric = 'goals' | 'assists' | 'ga';

/**
 * Ids de liga da API-Football por filtro. Fonte: `functions/src/model/labels.ts` (FOOTBALL_BY_ID):
 * 94 Liga Portugal; Taça de Portugal 96, Taça da Liga 97, Supertaça 550; competições europeias (tipo `europe`)
 * 2 Liga dos Campeões, 3 Liga Europa, 848 Liga Conferência, 531 Supertaça Europeia. Um único sítio para o mapa.
 */
export const LEAGUE_IDS: Record<Exclude<LeaderFilter, 'all'>, readonly string[]> = {
  league: ['94'],
  champions: ['2', '3', '848', '531'],
  cups: ['96', '97', '550'],
};

export const FILTER_ORDER: LeaderFilter[] = ['all', 'league', 'champions', 'cups'];

type Totals = { appearances: number; minutes: number; goals: number; assists: number };

export type LeaderRow = {
  player: PlayerSeasonStats;
  /** Valor da métrica escolhida. */
  value: number;
  appearances: number;
  minutes: number;
  goals: number;
  assists: number;
  /** minutos / golos (arredondado); `null` sem golos. */
  minutesPerGoal: number | null;
};

const ZERO: Totals = { appearances: 0, minutes: 0, goals: 0, assists: 0 };

function totalsFor(p: PlayerSeasonStats, filter: LeaderFilter): Totals {
  if (filter === 'all') return { appearances: p.appearances, minutes: p.minutes, goals: p.goals, assists: p.assists };
  const by = p.byLeague ?? {};
  return LEAGUE_IDS[filter].reduce<Totals>((acc, id) => {
    const l = by[id];
    if (!l) return acc;
    return {
      appearances: acc.appearances + l.appearances,
      minutes: acc.minutes + l.minutes,
      goals: acc.goals + l.goals,
      assists: acc.assists + l.assists,
    };
  }, ZERO);
}

const hasAny = (t: Totals) => t.appearances > 0 || t.minutes > 0 || t.goals > 0 || t.assists > 0;

/** Filtros com chip: 'all' sempre; os outros só se algum jogador tiver dados nessa competição (documento sem `byLeague`: nenhum). */
export function availableFilters(players: PlayerSeasonStats[]): LeaderFilter[] {
  return FILTER_ORDER.filter((f) => f === 'all' || players.some((p) => hasAny(totalsFor(p, f))));
}

const metricValue = (t: Totals, m: LeaderMetric) => (m === 'goals' ? t.goals : m === 'assists' ? t.assists : t.goals + t.assists);

/**
 * Ordem: métrica desc, depois menos minutos (mais eficiente), depois nome (colação pt), depois id.
 * Jogadores com 0 na métrica ficam de fora. `leader` é o primeiro; `rest` os restantes pela mesma ordem.
 */
export function squadLeaders(
  players: PlayerSeasonStats[],
  filter: LeaderFilter,
  metric: LeaderMetric,
): { leader: LeaderRow | null; rest: LeaderRow[] } {
  const rows: LeaderRow[] = [];
  for (const player of players) {
    const t = totalsFor(player, filter);
    const value = metricValue(t, metric);
    if (value <= 0) continue;
    rows.push({ player, value, ...t, minutesPerGoal: t.goals > 0 ? Math.round(t.minutes / t.goals) : null });
  }
  rows.sort(
    (a, b) =>
      b.value - a.value ||
      a.minutes - b.minutes ||
      a.player.name.localeCompare(b.player.name, 'pt') ||
      a.player.id.localeCompare(b.player.id),
  );
  return { leader: rows[0] ?? null, rest: rows.slice(1) };
}
