// View-models puros dos jogos (Agenda, detalhe do jogo, Home): estado, minuto, resultado, competição
// e lances. Sem React nem Firestore; só recebem `Match`/`EventItem` já validados (data/schemas.ts).
import type { GameHeaderVM } from '@/components/GameHeader';
import type { EventVM } from '@/components/EventRow';
import type { EventItem, GameStatus, Match } from '@/data/schemas';
import { formatRound } from '@/lib/formatRound';
import { SPORTING_API_ID } from '@/lib/teams';

export type UiState = 'scheduled' | 'live' | 'halftime' | 'finished' | 'postponed' | 'cancelled';

const UI_STATE: Record<GameStatus, UiState> = {
  NS: 'scheduled',
  LIVE: 'live',
  HT: 'halftime',
  FT: 'finished',
  AET: 'finished',
  PEN: 'finished',
  PST: 'postponed',
  CANC: 'cancelled',
};

export function uiState(status: GameStatus): UiState {
  return UI_STATE[status];
}

const STATE_LABEL: Record<UiState, string> = {
  scheduled: 'Próximo',
  live: 'Live',
  halftime: 'Intervalo',
  finished: 'Terminado',
  postponed: 'Adiado',
  cancelled: 'Cancelado',
};

/**
 * Palavra do estado, uma só vez para toda a app: faixa do `GameHeader`, linha da Agenda e rótulos
 * de acessibilidade. Ao vivo o minuto é acrescentado por quem mostra ("Live - 23’").
 */
export function stateLabel(state: UiState): string {
  return STATE_LABEL[state];
}

/** Nome e jornada/fase em pt-PT. Nunca "JRound of 32": um rótulo assim cai para o texto original. */
export function competitionText(c: Match['competition']): { name: string; round: string } {
  const round = c.roundLabel ?? formatRound(c.round);
  if (/^J/.test(round) && !/^J\d+$/.test(round)) return { name: c.name, round: c.round ?? '' };
  return { name: c.name, round };
}

/** `23’`, `45+2’`; sem minuto devolve ''. */
export function minuteText(elapsed: number | null, extra: number | null): string {
  if (elapsed == null) return '';
  return extra ? `${elapsed}+${extra}’` : `${elapsed}’`;
}

/** Desempate por penáltis, partilhado pelo resultado e pelo quadro das eliminatórias: "4-3 g.p.". */
export function penaltiesText(home: number, away: number): string {
  return `${home}-${away} g.p.`;
}

const NO_SCORE: readonly UiState[] = ['scheduled', 'postponed', 'cancelled'];

function scorePair(m: Match): { home: number; away: number } | null {
  if (NO_SCORE.includes(uiState(m.status))) return null;
  const { home, away } = m.score;
  return home == null || away == null ? null : { home, away };
}

/** "2-0"; com penáltis "1-1 (4-3 g.p.)"; null antes do jogo, adiado, cancelado ou sem números. */
export function scoreText(m: Match): string | null {
  const pair = scorePair(m);
  if (!pair) return null;
  const pen = m.score.penalty;
  const base = `${pair.home}-${pair.away}`;
  return pen && pen.home != null && pen.away != null ? `${base} (${penaltiesText(pen.home, pen.away)})` : base;
}

export function toGameHeaderVM(m: Match): GameHeaderVM {
  // Id do emblema: o lado do Sporting é sempre 228 (emblema local 2026, em qualquer modalidade). O adversário
  // só guarda o id no futebol: as outras modalidades usam ids api-sports, que podem colidir com 228.
  const team = (t: Match['home'], side: 'home' | 'away') => ({
    id: side === m.sportingSide ? SPORTING_API_ID : m.sport === 'football' ? Number(t.id) : null,
    name: t.name,
    crestUrl: t.logo,
  });
  const { name, round } = competitionText(m.competition);
  return {
    competitionName: name,
    round,
    home: team(m.home, 'home'),
    away: team(m.away, 'away'),
    state: uiState(m.status),
    kickoff: m.kickoff,
    tv: null,
    minute: m.elapsed,
    minuteText: minuteText(m.elapsed, m.elapsedExtra),
    score: scorePair(m),
    // Futebol tem a secção "Informação do Jogo"; o local no cabeçalho é só para as outras modalidades.
    venue: m.sport === 'football' ? null : (m.venue?.name ?? null),
  };
}

export type ShownEvent = EventItem & { type: Exclude<EventItem['type'], 'other'> };

/** Lances que a app mostra (o tipo `other` da API não tem ícone nem texto). */
export function isShownEvent(e: EventItem): e is ShownEvent {
  return e.type !== 'other';
}

const GOAL_DETAIL: Record<string, string> = {
  'own goal': 'Autogolo',
  penalty: 'Penálti',
};

const MISSED_PENALTY = 'missed penalty';

function isRedCard(detail: string): boolean {
  const d = detail.toLowerCase();
  return d === 'red card' || d === 'second yellow card';
}

export function toEventVM(e: ShownEvent, homeTeamId: string): EventVM {
  const base = { minute: minuteText(e.minute, e.extra), side: e.teamId === homeTeamId ? 'home' : 'away' } as const;
  switch (e.type) {
    case 'goal': {
      // Penálti falhado: o tipo da API é `goal`, mas não é golo (ícone próprio e não conta no resultado).
      if (e.detail.toLowerCase() === MISSED_PENALTY) {
        return { ...base, kind: 'missedPenalty', primary: e.playerName ?? '', secondary: 'Penálti falhado' };
      }
      const secondary = GOAL_DETAIL[e.detail.toLowerCase()];
      return { ...base, kind: 'goal', primary: e.playerName ?? '', ...(secondary ? { secondary } : {}) };
    }
    case 'card':
      return { ...base, kind: isRedCard(e.detail) ? 'red' : 'yellow', primary: e.playerName ?? '' };
    case 'subst':
      // Contrato `summaries` do Plano 2: assist = quem entra, player = quem sai.
      return {
        ...base,
        kind: 'sub',
        primary: e.assistName ?? '',
        ...(e.playerName ? { secondary: e.playerName } : {}),
      };
    case 'var':
      return { ...base, kind: 'var', primary: e.playerName ?? '' };
  }
}

type Part = '1ª Parte' | '2ª Parte' | 'Prolongamento' | 'Penáltis';
const PARTS: readonly Part[] = ['1ª Parte', '2ª Parte', 'Prolongamento', 'Penáltis'];

function partOf(e: EventItem): Part {
  if (e.comments === 'Penalty Shootout') return 'Penáltis';
  if (e.minute <= 45) return '1ª Parte';
  if (e.minute <= 90) return '2ª Parte';
  return 'Prolongamento';
}

function isScoredGoal(e: EventItem): boolean {
  return e.type === 'goal' && e.detail.toLowerCase() !== MISSED_PENALTY;
}

/** Lado que marcou. API-Football: no "Own Goal" a equipa do lance é a do jogador, ou seja, a que sofreu. */
function scoringSide(e: EventItem, homeTeamId: string): 'home' | 'away' {
  const eventHome = e.teamId === homeTeamId;
  const ownGoal = e.detail.toLowerCase() === 'own goal';
  return eventHome !== ownGoal ? 'home' : 'away';
}

/**
 * Lances agrupados por parte, com o resultado no fim de cada parte. Partes sem lances não aparecem.
 * Nos penáltis o resultado é só o do desempate (ex.: "4-3"), não somado ao do jogo.
 */
export function groupEvents(
  items: EventItem[],
  homeTeamId: string,
): { label: string; score: string; events: EventVM[] }[] {
  const sorted = items
    .filter(isShownEvent)
    .sort((a, b) => a.minute - b.minute || (a.extra ?? 0) - (b.extra ?? 0));

  const game = { home: 0, away: 0 };
  const shootout = { home: 0, away: 0 };
  const groups: { label: string; score: string; events: EventVM[] }[] = [];
  for (const part of PARTS) {
    const events = sorted.filter((e) => partOf(e) === part);
    const tally = part === 'Penáltis' ? shootout : game;
    for (const e of events) if (isScoredGoal(e)) tally[scoringSide(e, homeTeamId)] += 1;
    if (events.length === 0) continue;
    groups.push({
      label: part,
      score: `${tally.home}-${tally.away}`,
      events: events.map((e) => toEventVM(e, homeTeamId)),
    });
  }
  return groups;
}
