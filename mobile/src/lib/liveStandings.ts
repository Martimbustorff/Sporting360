// Classificação ao vivo (Plan 7 Task 11, Figma 4935:7111): projeta os jogos a decorrer sobre a tabela oficial.
// O servidor escreve `competitions/{key}/data/liveFixtures` uma vez por minuto enquanto há um jogo do Sporting em liga
// (functions/src/football/liveFixtures.ts); a app nunca grava. Ordem: pontos projetados; em cada grupo de equipas com os
// mesmos pontos que inclua pelo menos uma equipa em jogo, desempata-se como no regulamento da Liga Portugal (confirmado
// pelo Martim a 19/11): (a) pontos nos jogos entre as equipas empatadas nesta época, (b) diferença de golos nesses jogos,
// (c) diferença de golos geral, (d) golos marcados e (e) ordem oficial (posição na tabela recebida). Os jogos ao vivo entre
// as equipas empatadas contam como resultados entre elas. O confronto direto vem de `competitions/{key}/data/fixtures`
// (as jornadas da competição), passado por quem chama em `results`; sem ele, o desempate começa na diferença de golos geral.
// Grupos sem equipas em jogo mantêm a ordem oficial (sem setas para quem não joga), o que também mantém a ordenação transitiva.
import type { FixtureItem, LiveFixture, LiveFixturesDoc, StandingRow } from '@/data/schemas';

/** Documento de jogos ao vivo com 5 minutos ou mais é velho: mostra-se só a tabela oficial. */
export const LIVE_MAX_AGE_MS = 5 * 60_000;

/** Tolerância a relógios desalinhados: `updatedAt` mais de 2 min no futuro conta como indisponível. */
export const LIVE_MAX_SKEW_MS = 2 * 60_000;

export type ProjectedRow = StandingRow & {
  /** Posições ganhas face à oficial: positivo subiu, negativo desceu. */
  delta: number;
  /** Resultado em direto do jogo da equipa, "seus-adversário" (ex.: "2-1"); null sem jogo ao vivo. */
  liveScore: string | null;
};

/** Há jogos ao vivo e o documento é recente: só então o alternador "Ao vivo" / "Oficial" aparece. */
export function liveStandingsAvailable(doc: Pick<LiveFixturesDoc, 'updatedAt' | 'fixtures'> | null, now: Date): boolean {
  if (!doc || doc.fixtures.length === 0) return false;
  const age = now.getTime() - doc.updatedAt.getTime();
  // Relógio do telemóvel atrasado: uma data bem no futuro não prova que o documento é recente.
  return age > -LIVE_MAX_SKEW_MS && age < LIVE_MAX_AGE_MS;
}

/** Resultado final de um jogo da liga entre duas equipas, para o confronto direto. */
export type LeagueResult = { homeId: string; awayId: string; homeGoals: number; awayGoals: number };

const FINISHED: readonly FixtureItem['status'][] = ['FT', 'AET', 'PEN'];

/** Jogos terminados (com golos) de `competitions/{key}/data/fixtures`, no formato do confronto direto. */
export function finishedResults(items: FixtureItem[]): LeagueResult[] {
  const out: LeagueResult[] = [];
  for (const f of items) {
    const { home, away } = f.score;
    if (!FINISHED.includes(f.status) || home == null || away == null) continue;
    out.push({ homeId: f.home.id, awayId: f.away.id, homeGoals: home, awayGoals: away });
  }
  return out;
}

export type ProjectOptions = {
  /**
   * Sem dupla contagem: com a lista completa de jogos terminados em `results`, uma equipa cujo `played` oficial já é maior
   * do que os seus jogos terminados (sem contar o jogo em projeção) já tem esse jogo na tabela oficial, e não se soma outra
   * vez. Só se liga quando a lista de jogos da competição foi lida (senão `results` está vazio e não prova nada).
   */
  guardDoubleCount?: boolean;
};

/**
 * Aplica 3/1/0 pontos a cada jogo ao vivo sobre a tabela oficial e reordena. Não altera `official`.
 * `results`: jogos terminados da época (ver `finishedResults`) para o confronto direto; opcional, puro.
 */
export function projectStandings(
  official: StandingRow[],
  live: LiveFixture[],
  results: readonly LeagueResult[] = [],
  options: ProjectOptions = {},
): { rows: ProjectedRow[] } {
  const base = official.map((r, i) => ({ r: { ...r }, i, liveScore: null as string | null }));
  const byTeam = new Map(base.map((b) => [b.r.teamId, b]));

  // Jogos terminados por equipa, sem contar o jogo em projeção (o mesmo casa/fora, como no desempate).
  const finishedBefore = (teamId: string, f: LiveFixture): number =>
    results.filter((g) => !(g.homeId === f.homeId && g.awayId === f.awayId) && (g.homeId === teamId || g.awayId === teamId)).length;

  const apply = (teamId: string, own: number, other: number, f: LiveFixture) => {
    const b = byTeam.get(teamId);
    if (!b) return;
    const r = b.r;
    b.liveScore = `${own}-${other}`;
    if (options.guardDoubleCount && r.played > finishedBefore(teamId, f)) return;
    r.played += 1;
    r.goalsFor += own;
    r.goalsAgainst += other;
    r.goalsDiff += own - other;
    if (own > other) {
      r.win += 1;
      r.points += 3;
    } else if (own === other) {
      r.draw += 1;
      r.points += 1;
    } else {
      r.lose += 1;
    }
  };
  for (const f of live) {
    apply(f.homeId, f.homeGoals, f.awayGoals, f);
    apply(f.awayId, f.awayGoals, f.homeGoals, f);
  }

  // Por pontos projetados; depois, em cada grupo de pontos iguais com uma equipa em jogo, o regulamento. Os restantes
  // grupos ficam pela ordem oficial.
  const byPoints = [...base].sort((a, b) => b.r.points - a.r.points || a.i - b.i);
  const ordered: typeof base = [];
  for (let start = 0; start < byPoints.length; ) {
    let end = start + 1;
    while (end < byPoints.length && byPoints[end]!.r.points === byPoints[start]!.r.points) end += 1;
    const group = byPoints.slice(start, end);
    ordered.push(...(group.length > 1 && group.some((b) => b.liveScore !== null) ? tieBreak(group, live, results) : group));
    start = end;
  }
  return {
    rows: ordered.map((b, pos) => ({ ...b.r, rank: pos + 1, delta: b.i - pos, liveScore: b.liveScore })),
  };
}

type Entry = { r: StandingRow; i: number; liveScore: string | null };

/**
 * Ordena um grupo de equipas com os mesmos pontos: confronto direto (pontos, diferença nos jogos entre elas). Cada
 * subgrupo que continue empatado e seja mais pequeno do que o grupo repete o confronto direto só entre as suas equipas
 * (regulamento: reaplica-se sem os jogos contra as já separadas). Subgrupo igual ao grupo: diferença geral, golos
 * marcados e ordem oficial. A ordem é total e determinista.
 */
function tieBreak(group: Entry[], live: LiveFixture[], results: readonly LeagueResult[]): Entry[] {
  if (group.length < 2) return group;
  const ids = new Set(group.map((b) => b.r.teamId));
  // Um jogo ao vivo entre as equipas empatadas manda sobre o mesmo casa/fora do calendário (ainda não terminado ou a chegar tarde).
  const liveKeys = new Set(live.map((f) => `${f.homeId}|${f.awayId}`));
  const games: LeagueResult[] = [
    ...results.filter((g) => !liveKeys.has(`${g.homeId}|${g.awayId}`)),
    ...live.map((f) => ({ homeId: f.homeId, awayId: f.awayId, homeGoals: f.homeGoals, awayGoals: f.awayGoals })),
  ].filter((g) => g.homeId !== g.awayId && ids.has(g.homeId) && ids.has(g.awayId));
  const h2h = new Map([...ids].map((id) => [id, { points: 0, diff: 0 }]));
  for (const g of games) {
    const home = h2h.get(g.homeId)!;
    const away = h2h.get(g.awayId)!;
    home.diff += g.homeGoals - g.awayGoals;
    away.diff += g.awayGoals - g.homeGoals;
    if (g.homeGoals > g.awayGoals) home.points += 3;
    else if (g.homeGoals < g.awayGoals) away.points += 3;
    else {
      home.points += 1;
      away.points += 1;
    }
  }
  const stat = (b: Entry) => h2h.get(b.r.teamId)!;
  const sorted = [...group].sort((a, b) => stat(b).points - stat(a).points || stat(b).diff - stat(a).diff || a.i - b.i);
  const out: Entry[] = [];
  for (let start = 0; start < sorted.length; ) {
    let end = start + 1;
    const first = stat(sorted[start]!);
    while (end < sorted.length && stat(sorted[end]!).points === first.points && stat(sorted[end]!).diff === first.diff) end += 1;
    const cluster = sorted.slice(start, end);
    if (cluster.length === 1) out.push(...cluster);
    else if (cluster.length < group.length) out.push(...tieBreak(cluster, live, results));
    else out.push(...cluster.sort((a, b) => b.r.goalsDiff - a.r.goalsDiff || b.r.goalsFor - a.r.goalsFor || a.i - b.i));
    start = end;
  }
  return out;
}

export type Zone = 'champions' | 'europa' | 'conference';

/** Zona europeia a partir de `description` da API ("Promotion - Champions League (...)"); null nas restantes. */
export function zoneOf(description: string | null | undefined): Zone | null {
  if (!description) return null;
  if (/conference/i.test(description)) return 'conference';
  if (/champions/i.test(description)) return 'champions';
  if (/europa/i.test(description)) return 'europa';
  return null;
}
