// Classificação ao vivo (Plan 7 Task 11, Figma 4935:7111): projeta os jogos a decorrer sobre a tabela oficial.
// O servidor escreve `competitions/{key}/data/liveFixtures` uma vez por minuto enquanto há um jogo do Sporting em liga
// (functions/src/football/liveFixtures.ts); a app nunca grava. Ordem: pontos projetados; em cada grupo de equipas com os
// mesmos pontos que inclua pelo menos uma equipa em jogo, diferença de golos, golos marcados e, por fim, a ordem oficial
// (posição na tabela recebida). Grupos sem equipas em jogo mantêm a ordem oficial (sem setas para quem não joga), o que
// também mantém a ordenação transitiva. Critérios da Liga Portugal "a confirmar" (nota do Figma, batch 2): ordem do brief.
import type { LiveFixture, LiveFixturesDoc, StandingRow } from '@/data/schemas';

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

  // Pontos projetados em que joga pelo menos uma equipa: só aí a diferença e os golos podem mexer na ordem.
  const livePoints = new Set(base.filter((b) => b.liveScore !== null).map((b) => b.r.points));
  const ordered = [...base].sort((a, b) => {
    if (a.r.points !== b.r.points) return b.r.points - a.r.points;
    if (livePoints.has(a.r.points)) return b.r.goalsDiff - a.r.goalsDiff || b.r.goalsFor - a.r.goalsFor || a.i - b.i;
    return a.i - b.i;
  });
  return {
    rows: ordered.map((b, pos) => ({ ...b.r, rank: pos + 1, delta: b.i - pos, liveScore: b.liveScore })),
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
