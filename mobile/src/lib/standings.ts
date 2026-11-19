// Classificação: que vista abrir (tabela ou eliminatórias) e os textos da tabela e do quadro.
// O agregado e o vencedor de uma eliminatória vêm do servidor (`Tie.aggregate`, `Tie.winnerTeamId`,
// functions/src/football/bracket.ts) e nunca se recalculam aqui (preflight F11).
import type { Bracket, Competition, StandingsDoc, Tie } from '@/data/schemas';
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
 * Seletor "Tabela"/"Eliminatórias" só quando há as duas vistas com dados e o servidor não diz que a
 * competição não tem quadro (`view.hasBracket === false`). Sem `view`, decidem os documentos de dados.
 */
export function showSelector(view: Competition['view'] | undefined, hasRows: boolean, hasBracket: boolean): boolean {
  return hasRows && hasBracket && view?.hasBracket !== false;
}

// Escolha manual "Tabela"/"Eliminatórias" por competição, guardada em memória até a app reiniciar:
// sobrevive a sair e voltar à tab Classificação ou ao ecrã da competição. Ganha a `view.primary` do
// servidor enquanto a app estiver aberta (`resolveView` põe a escolha do utilizador primeiro).
const viewChoices = new Map<string, StandingsView>();

export function getViewChoice(competitionKey: string): StandingsView | null {
  return viewChoices.get(competitionKey) ?? null;
}

export function setViewChoice(competitionKey: string, v: StandingsView): void {
  viewChoices.set(competitionKey, v);
}

/** Só para testes: começa cada teste sem escolhas. */
export function resetViewChoices(): void {
  viewChoices.clear();
}

/** Agregado do servidor, "3-2"; null enquanto a eliminatória não acabou. */
export function aggregateText(tie: Tie): string | null {
  return tie.aggregate ? `${tie.aggregate.home}-${tie.aggregate.away}` : null;
}

/**
 * Resultado de uma mão do lado das equipas da eliminatória (`tieHomeId` = `tie.home.id`, à esquerda).
 * O servidor grava cada mão do ponto de vista da casa desse jogo e, nos docs novos, diz quem é essa
 * casa (`leg.homeId`): troca-se quando a casa não é `tie.home`. Docs antigos não têm `homeId`: aí
 * `tie.home` é a casa da 1.ª mão (`buildTie`) e a 2.ª joga-se com a casa trocada (índice ímpar).
 * Penáltis com `penaltiesText`: "1-1 (4-3 g.p.)". Null se a mão ainda não tem resultado.
 */
export function legSides(
  leg: Tie['legs'][number],
  index: number,
  tieHomeId: string,
): { home: number; away: number; penHome: number | null; penAway: number | null } | null {
  const { home, away, penaltyHome, penaltyAway } = leg.score;
  if (home == null || away == null) return null;
  const swap = leg.homeId != null ? leg.homeId !== tieHomeId : index % 2 === 1;
  const [l, r] = swap ? [away, home] : [home, away];
  if (penaltyHome == null || penaltyAway == null) return { home: l, away: r, penHome: null, penAway: null };
  const [pl, pr] = swap ? [penaltyAway, penaltyHome] : [penaltyHome, penaltyAway];
  return { home: l, away: r, penHome: pl, penAway: pr };
}

export function legScoreText(leg: Tie['legs'][number], index: number, tieHomeId: string): string | null {
  const s = legSides(leg, index, tieHomeId);
  if (!s) return null;
  const base = `${s.home}-${s.away}`;
  return s.penHome == null || s.penAway == null ? base : `${base} (${penaltiesText(s.penHome, s.penAway)})`;
}
