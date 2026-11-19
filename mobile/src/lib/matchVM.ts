// View-models puros dos jogos (Agenda, detalhe do jogo, Home): estado, minuto, resultado, competição
// e lances. Sem React nem Firestore; só recebem `Match`/`EventItem` já validados (data/schemas.ts).
import type { GameHeaderVM } from '@/components/GameHeader';
import type { EventVM } from '@/components/EventRow';
import type { Competition, EventItem, FixtureItem, GameStatus, Match } from '@/data/schemas';
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

const pairOrNull = (home: number | null, away: number | null): { home: number; away: number } | null =>
  home == null || away == null ? null : { home, away };

/**
 * Jogo de `competitions/{key}/data/fixtures` como `Match`, para reutilizar a `MatchRow` nas jornadas
 * (preflight F9). O `FixtureItem` não traz intervalo, minuto, local, árbitro nem fonte: ficam a null,
 * e a fonte é a API-Football com o id do jogo. `sportingSide` sai do id 228; num jogo sem o Sporting
 * fica 'home' e não quer dizer nada (só os jogos do Sporting têm `matches/{id}` e abrem o detalhe).
 */
export function fixtureToMatch(item: FixtureItem, c: Competition & { key: string; season: string }): Match {
  const sporting = String(SPORTING_API_ID);
  return {
    id: item.id,
    sport: c.sport,
    competition: {
      key: c.key,
      id: c.leagueId,
      name: c.name,
      type: c.type,
      season: c.season,
      round: item.round,
      roundLabel: item.roundLabel,
    },
    home: item.home,
    away: item.away,
    sportingSide: item.away.id === sporting ? 'away' : 'home',
    kickoff: item.kickoff,
    status: item.status,
    elapsed: null,
    elapsedExtra: null,
    score: {
      home: item.score.home,
      away: item.score.away,
      halftime: null,
      extratime: pairOrNull(item.score.extraHome, item.score.extraAway),
      penalty: pairOrNull(item.score.penaltyHome, item.score.penaltyAway),
    },
    finishedAt: null,
    venue: null,
    referee: null,
    source: { provider: 'api-football', id: item.id, attribution: null },
  };
}

export function toGameHeaderVM(m: Match): GameHeaderVM {
  // Id do emblema. Futebol: o id API-Football da equipa (o Sporting é 228, emblema local 2026); não se usa
  // `sportingSide`, que nos jogos de competição sem o Sporting (`fixtureToMatch`) não quer dizer nada. Outras
  // modalidades: o lado do Sporting leva 228 e o adversário nenhum (ids api-sports podem colidir com 228).
  const team = (t: Match['home'], side: 'home' | 'away') => ({
    id: m.sport === 'football' ? Number(t.id) : side === m.sportingSide ? SPORTING_API_ID : null,
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
    tv: m.tv ?? null,
    minute: m.elapsed,
    minuteText: minuteText(m.elapsed, m.elapsedExtra),
    score: scorePair(m),
    penalty: pairOrNull(m.score.penalty?.home ?? null, m.score.penalty?.away ?? null),
    // Futebol tem a secção "Informação do Jogo"; o local no cabeçalho é só para as outras modalidades.
    venue: m.sport === 'football' ? null : venueText(m.venue),
  };
}

/** "Pavilhão João Rocha, Lisboa"; sem cidade só o nome; sem local null. */
function venueText(v: Match['venue']): string | null {
  if (!v) return null;
  return v.city ? `${v.name}, ${v.city}` : v.name;
}

export type GoalVM = { side: 'home' | 'away'; minute: number; extra: number | null; name: string; text: string };

/** Golos marcados, por ordem do jogo, para os marcadores e a linha do tempo do cabeçalho. Sem penáltis falhados nem desempate. */
export function goalsFromEvents(items: EventItem[], homeTeamId: string): GoalVM[] {
  return items
    .filter((e) => isScoredGoal(e) && e.comments !== 'Penalty Shootout')
    .sort((a, b) => a.minute - b.minute || (a.extra ?? 0) - (b.extra ?? 0))
    .map((e) => {
      const name = e.playerName ?? '';
      return {
        side: scoringSide(e, homeTeamId),
        minute: e.minute,
        extra: e.extra,
        name,
        text: `${name} ${minuteText(e.minute, e.extra)}`.trim(),
      };
    });
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

const VAR_TEXT: [RegExp, string][] = [
  [/goal (disallowed|cancelled|canceled)|disallowed goal/i, 'Golo anulado'],
  [/penalty confirmed/i, 'Penálti confirmado'],
  [/penalty cancelled|penalty canceled/i, 'Penálti anulado'],
  [/card upgrade/i, 'Cartão revisto'],
  [/card (downgrade|cancelled|canceled)/i, 'Cartão anulado'],
];

/** Coluna da cronologia: a do Sporting ou a do adversário. Lado do jogo (`home`/`away`) -> coluna. */
function columnOf(matchSide: 'home' | 'away', sportingSide: 'home' | 'away'): 'sporting' | 'opponent' {
  return matchSide === sportingSide ? 'sporting' : 'opponent';
}

/** Texto do VAR por tipo de decisão da API; sem tipo conhecido fica só o selo e o nome do jogador. */
function varText(e: ShownEvent): { primary: string; secondary?: string } {
  const player = e.playerName ?? '';
  const hit = VAR_TEXT.find(([re]) => re.test(e.detail))?.[1];
  if (!hit) return { primary: player };
  const offside = /offside/i.test(e.detail);
  const secondary = player ? (offside ? `fora de jogo de ${player}` : player) : undefined;
  return { primary: hit, ...(secondary ? { secondary } : {}) };
}

/**
 * `side` é a coluna: o Sporting à esquerda, o adversário à direita (Figma 4933:7057). Golo: o lado de quem marcou
 * (um autogolo vai para a coluna da equipa que beneficiou); os outros lances, a equipa do lance.
 */
export function toEventVM(e: ShownEvent, homeTeamId: string, sportingSide: 'home' | 'away' = 'home'): EventVM {
  const team = e.teamId === homeTeamId ? 'home' : 'away';
  const minute = minuteText(e.minute, e.extra);
  switch (e.type) {
    case 'goal': {
      // Penálti falhado: o tipo da API é `goal`, mas não é golo (ícone próprio e não conta no resultado).
      if (e.detail.toLowerCase() === MISSED_PENALTY) {
        return { minute, side: columnOf(team, sportingSide), kind: 'missedPenalty', primary: e.playerName ?? '', secondary: 'Penálti falhado' };
      }
      const secondary = GOAL_DETAIL[e.detail.toLowerCase()] ?? (e.assistName ? `assist. ${e.assistName}` : undefined);
      return {
        minute,
        side: columnOf(scoringSide(e, homeTeamId), sportingSide),
        kind: 'goal',
        primary: e.playerName ?? '',
        ...(secondary ? { secondary } : {}),
      };
    }
    case 'card':
      return { minute, side: columnOf(team, sportingSide), kind: isRedCard(e.detail) ? 'red' : 'yellow', primary: e.playerName ?? '' };
    case 'subst':
      // Contrato `summaries` do Plano 2: assist = quem entra, player = quem sai.
      return {
        minute,
        side: columnOf(team, sportingSide),
        kind: 'sub',
        primary: e.assistName ?? '',
        ...(e.playerName ? { secondary: `sai ${e.playerName}` } : {}),
      };
    case 'var':
      return { minute, side: columnOf(team, sportingSide), kind: 'var', ...varText(e) };
  }
}

export type LiveEventVM = {
  /** Chave estável (minuto, extra, tipo, jogador): um lance novo no topo não muda a chave dos outros. */
  key: string;
  minute: string;
  /** Coluna do lance: o Sporting ou o adversário (um autogolo conta para quem beneficiou). */
  side: 'sporting' | 'opponent';
  kind: EventVM['kind'];
  /** Segunda linha, só com o que os dados do lance dão (Figma 4924:6466). */
  line?: string;
};

/** Segunda linha de um lance ao vivo. Só vem de dados que o lance já tem; sem eles, nada. */
function liveLine(e: ShownEvent, vm: EventVM): string | undefined {
  switch (e.type) {
    case 'goal': {
      if (vm.kind === 'missedPenalty') return undefined;
      const detail = e.detail.toLowerCase();
      if (detail === 'own goal') return 'Autogolo';
      if (detail === 'penalty') return 'De penálti';
      return e.assistName ? `Assistência de ${e.assistName}` : undefined;
    }
    case 'subst':
      // Contrato `summaries` do Plano 2: assist = quem entra, player = quem sai.
      if (e.assistName && e.playerName) return `Entra ${e.assistName}, sai ${e.playerName}`;
      if (e.assistName) return `Entra ${e.assistName}`;
      return e.playerName ? `Sai ${e.playerName}` : undefined;
    case 'var':
      return VAR_TEXT.some(([re]) => re.test(e.detail)) && vm.primary ? vm.primary : undefined;
    case 'card':
      return undefined;
  }
}

/** Lances do Sumário ao vivo, o mais recente primeiro (no mesmo minuto, a ordem inversa da API). */
export function liveFeed(items: EventItem[], homeTeamId: string, sportingSide: 'home' | 'away' = 'home'): LiveEventVM[] {
  const seen = new Map<string, number>();
  return items
    .filter(isShownEvent)
    .sort((a, b) => a.minute - b.minute || (a.extra ?? 0) - (b.extra ?? 0))
    .reverse()
    .map((e) => {
      const vm = toEventVM(e, homeTeamId, sportingSide);
      const line = liveLine(e, vm);
      const base = `${e.minute}-${e.extra ?? 0}-${e.type}-${e.playerName ?? ''}`;
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      return { key: n === 0 ? base : `${base}#${n}`, minute: vm.minute, side: vm.side, kind: vm.kind, ...(line ? { line } : {}) };
    });
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
  sportingSide: 'home' | 'away' = 'home',
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
      events: events.map((e) => toEventVM(e, homeTeamId, sportingSide)),
    });
  }
  return groups;
}
