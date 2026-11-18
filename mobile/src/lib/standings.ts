// Classificação: que vista abrir (tabela ou eliminatórias) e os textos da tabela e do quadro.
// O agregado e o vencedor de uma eliminatória vêm do servidor (`Tie.aggregate`, `Tie.winnerTeamId`,
// functions/src/football/bracket.ts) e nunca se recalculam aqui (preflight F11).
import type { Bracket, Competition, StandingRow, StandingsDoc, Tie } from '@/data/schemas';
import { penaltiesText } from '@/lib/matchVM';

export type StandingsView = 'table' | 'bracket';

/** Há pelo menos uma linha em algum grupo. */
export function hasTableRows(doc: StandingsDoc | null): boolean {
  return !!doc && doc.groups.some((g) => g.rows.length > 0);
}

/** Há pelo menos uma eliminatória em alguma fase. */
export function hasBracketTies(doc: Bracket | null): boolean {
  return !!doc && doc.stages.some((s) => s.ties.length > 0);
}

/**
 * Vista a mostrar. Uma vista só "existe" se tiver dados (linhas ou eliminatórias): a escolha do
 * utilizador primeiro, se existir; depois `view.primary`; sem `view` (ou se a primária ainda não tem
 * dados), tabela se houver linhas, senão eliminatórias.
 */
export function resolveView(
  view: Competition['view'] | undefined,
  hasRows: boolean,
  hasBracket: boolean,
  userChoice: StandingsView | null,
): StandingsView {
  const exists = (v: StandingsView) => (v === 'table' ? hasRows : hasBracket);
  if (userChoice && exists(userChoice)) return userChoice;
  if (view && exists(view.primary)) return view.primary;
  return hasRows ? 'table' : 'bracket';
}

/**
 * Seletor "Tabela"/"Eliminatórias" só quando há as duas vistas com dados. `view` não entra: os
 * documentos de dados é que dizem o que se pode mostrar (o mesmo critério de `resolveView`).
 */
export function showSelector(_view: Competition['view'] | undefined, hasRows: boolean, hasBracket: boolean): boolean {
  return hasRows && hasBracket;
}

/** Golos marcados e sofridos como no Figma 500:29421: "8:4". */
export function goalsText(row: Pick<StandingRow, 'goalsFor' | 'goalsAgainst'>): string {
  return `${row.goalsFor}:${row.goalsAgainst}`;
}

/** Agregado do servidor, "3-2"; null enquanto a eliminatória não acabou. */
export function aggregateText(tie: Tie): string | null {
  return tie.aggregate ? `${tie.aggregate.home}-${tie.aggregate.away}` : null;
}

/**
 * Resultado de uma mão do lado das equipas da eliminatória (`tie.home` à esquerda). O servidor grava
 * cada mão do ponto de vista da casa desse jogo, sem guardar quem é a casa; `tie.home` é a casa da
 * 1.ª mão (`buildTie`), e numa eliminatória a duas mãos a 2.ª joga-se com a casa trocada (índice
 * ímpar). Penáltis com `penaltiesText`: "1-1 (4-3 g.p.)".
 * Null se a mão ainda não tem resultado.
 */
export function legScoreText(leg: Tie['legs'][number], index: number): string | null {
  const { home, away, penaltyHome, penaltyAway } = leg.score;
  if (home == null || away == null) return null;
  const swap = index % 2 === 1;
  const [l, r] = swap ? [away, home] : [home, away];
  const base = `${l}-${r}`;
  if (penaltyHome == null || penaltyAway == null) return base;
  const [pl, pr] = swap ? [penaltyAway, penaltyHome] : [penaltyHome, penaltyAway];
  return `${base} (${penaltiesText(pl, pr)})`;
}
