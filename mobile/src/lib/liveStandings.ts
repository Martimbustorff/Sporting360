// Classificação ao vivo (Plan 7 Task 11, Figma 4935:7111): projeta os jogos a decorrer sobre a tabela oficial.
// O servidor escreve `competitions/{key}/data/liveFixtures` uma vez por minuto enquanto há um jogo do Sporting em liga
// (functions/src/football/liveFixtures.ts); a app nunca grava. Desempate: pontos, diferença de golos, golos marcados e,
// por fim, a ordem oficial. Critérios da Liga Portugal "a confirmar" (nota do Figma, batch 2): seguem esta ordem do brief.
import type { LiveFixture, LiveFixturesDoc, StandingRow } from '@/data/schemas';

/** Documento de jogos ao vivo com 5 minutos ou mais é velho: mostra-se só a tabela oficial. */
export const LIVE_MAX_AGE_MS = 5 * 60_000;

export type ProjectedRow = StandingRow & {
  /** Posições ganhas face à oficial: positivo subiu, negativo desceu. */
  delta: number;
  /** Resultado em direto do jogo da equipa, "seus-adversário" (ex.: "2-1"); null sem jogo ao vivo. */
  liveScore: string | null;
};

/** Há jogos ao vivo e o documento é recente: só então o alternador "Ao vivo" / "Oficial" aparece. */
export function liveStandingsAvailable(doc: Pick<LiveFixturesDoc, 'updatedAt' | 'fixtures'> | null, now: Date): boolean {
  if (!doc || doc.fixtures.length === 0) return false;
  return now.getTime() - doc.updatedAt.getTime() < LIVE_MAX_AGE_MS;
}

/** Aplica 3/1/0 pontos a cada jogo ao vivo sobre a tabela oficial e reordena. Não altera `official`. */
export function projectStandings(official: StandingRow[], live: LiveFixture[]): { rows: ProjectedRow[] } {
  const base = official.map((r, i) => ({ r: { ...r }, i, liveScore: null as string | null }));
  const byTeam = new Map(base.map((b) => [b.r.teamId, b]));

  const apply = (teamId: string, own: number, other: number) => {
    const b = byTeam.get(teamId);
    if (!b) return;
    const r = b.r;
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
    b.liveScore = `${own}-${other}`;
  };
  for (const f of live) {
    apply(f.homeId, f.homeGoals, f.awayGoals);
    apply(f.awayId, f.awayGoals, f.homeGoals);
  }

  const ordered = [...base].sort(
    (a, b) =>
      b.r.points - a.r.points ||
      b.r.goalsDiff - a.r.goalsDiff ||
      b.r.goalsFor - a.r.goalsFor ||
      a.r.rank - b.r.rank ||
      a.i - b.i,
  );
  const officialPos = new Map([...base].sort((a, b) => a.r.rank - b.r.rank || a.i - b.i).map((b, pos) => [b, pos + 1]));
  return {
    rows: ordered.map((b, pos) => ({ ...b.r, rank: pos + 1, delta: officialPos.get(b)! - (pos + 1), liveScore: b.liveScore })),
  };
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
