// Equipa e jogador (Task 14): funções puras sobre `teams/football_228/data/*` (functions/src/football/teamSync.ts).
// Textos da API-Football em pt-PT; um valor desconhecido mostra o texto original.
import { z } from 'zod';
import type {
  CompetitionType,
  PlayerSeasonStats,
  PlayerStatsDoc,
  SquadDoc,
  SquadPlayer,
  TeamInjuriesDoc,
  TeamStatsDoc,
  TrophiesDoc,
} from '@/data/schemas';
import { formLetters, type FormLetter } from '@/lib/prematch';
import { MONTHS_SHORT } from '@/lib/ptDate';

const POSITIONS = ['Goalkeeper', 'Defender', 'Midfielder', 'Attacker'] as const;
const GROUP_LABEL: Record<string, string> = {
  Goalkeeper: 'Guarda-redes',
  Defender: 'Defesas',
  Midfielder: 'Médios',
  Attacker: 'Avançados',
};
const SINGULAR: Record<string, string> = {
  Goalkeeper: 'Guarda-redes',
  Defender: 'Defesa',
  Midfielder: 'Médio',
  Attacker: 'Avançado',
};
const NO_POSITION = 'Outros';

/** Nome do grupo do plantel ("Defesas"). */
export function positionLabel(p: string): string {
  return GROUP_LABEL[p] ?? p;
}

/** Posição de um jogador ("Defesa"); vazio sem posição. */
export function playerPositionLabel(p: string | null): string {
  if (!p) return '';
  return SINGULAR[p] ?? p;
}

const byNumber = (a: SquadPlayer, b: SquadPlayer): number => {
  if (a.number === null) return b.number === null ? a.name.localeCompare(b.name, 'pt') : 1;
  if (b.number === null) return -1;
  return a.number - b.number || a.name.localeCompare(b.name, 'pt');
};

/**
 * Plantel por posição: guarda-redes, defesas, médios e avançados, cada grupo por número (sem número no fim).
 * Grupos vazios não aparecem; posições desconhecidas vêm depois com o texto original, sem posição em "Outros".
 */
export function groupSquad(players: SquadPlayer[]): { label: string; players: SquadPlayer[] }[] {
  const groups = new Map<string, SquadPlayer[]>();
  for (const pl of players) {
    const k = pl.position ?? '';
    groups.set(k, [...(groups.get(k) ?? []), pl]);
  }
  const rank = (k: string) => {
    const i = (POSITIONS as readonly string[]).indexOf(k);
    return i >= 0 ? i : k === '' ? POSITIONS.length + 1 : POSITIONS.length;
  };
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([k, ps]) => ({ label: k === '' ? NO_POSITION : positionLabel(k), players: [...ps].sort(byNumber) }));
}

const TRANSFER_TYPE: Record<string, string> = {
  loan: 'Empréstimo',
  free: 'Custo zero',
  transfer: 'Transferência',
  'return from loan': 'Regresso de empréstimo',
  'back from loan': 'Regresso de empréstimo',
  'n/a': '',
};

/** Tipo de transferência: "Empréstimo", "Custo zero"; valores ("€ 10M") tal como vêm; N/A e null vazios. */
export function transferTypeLabel(t: string | null): string {
  if (t === null) return '';
  const v = t.trim();
  return TRANSFER_TYPE[v.toLowerCase()] ?? v;
}

/** Data civil da API ("2026-07-01", talvez com hora) → "1 Jul 2026". Outro formato fica como vem. */
export function calendarDateText(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return s;
  return `${Number(m[3])} ${MONTHS_SHORT[month - 1]} ${m[1]}`;
}

/** Época de futebol (ano de início, `footballSeason`) → "2026/27". */
export function seasonLabel(season: string): string {
  const y = Number(season);
  if (!Number.isInteger(y)) return season;
  return `${y}/${String((y + 1) % 100).padStart(2, '0')}`;
}

type Sidelined = { type: string; start: string; end: string | null };

/** "15 Mar 2026 a 2 Abr 2026"; sem fim, "Desde 20 Out 2026, em curso". */
export function sidelinedPeriodText(s: Sidelined): string {
  const start = calendarDateText(s.start);
  return s.end === null ? `Desde ${start}, em curso` : `${start} a ${calendarDateText(s.end)}`;
}

const BAN = new Set(['Suspended', 'Red Card', 'Yellow Cards']);

/** Tipo de paragem: castigos em pt-PT; lesões com o texto da API. */
export function sidelinedTypeText(type: string): string {
  return BAN.has(type) ? 'Castigo' : type;
}

type UnavailableItem = TeamInjuriesDoc['items'][number];

/** Indisponíveis do plantel: o documento repete o jogador em cada jogo da janela; fica um por jogador. */
export function unavailablePlayers(doc: TeamInjuriesDoc): UnavailableItem[] {
  const seen = new Set<string>();
  return doc.items.filter((i) => (seen.has(i.playerId) ? false : (seen.add(i.playerId), true)));
}

/** Lugar num troféu: "Vencedor", "2.º lugar", "Finalista"; outro valor como vem. */
export function trophyPlaceText(place: string): string {
  if (place === 'Winner') return 'Vencedor';
  if (/^runner[- ]up$/i.test(place)) return 'Finalista';
  const m = /^(\d+)(st|nd|rd|th) Place$/i.exec(place);
  return m ? `${m[1]}.º lugar` : place;
}

/** Jogadores do plantel com troféus, mais troféus primeiro e depois pelo nome. */
export function playersWithTrophies(squad: SquadDoc, trophies: TrophiesDoc): { player: SquadPlayer; count: number }[] {
  return squad.players
    .map((player) => ({ player, count: trophies.byPlayer[player.id]?.length ?? 0 }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count || a.player.name.localeCompare(b.player.name, 'pt'));
}

/** Jogadores com jogos na época, por golos, depois assistências, minutos e nome. */
export function playersByGoals(doc: PlayerStatsDoc): PlayerSeasonStats[] {
  return doc.players
    .filter((x) => x.appearances > 0)
    .sort(
      (a, b) =>
        b.goals - a.goals || b.assists - a.assists || b.minutes - a.minutes || a.name.localeCompare(b.name, 'pt'),
    );
}

/** Linha da época de um jogador; null sem documento, sem linha ou sem jogos ("Sem jogos esta época."). */
export function playerSeasonLine(doc: PlayerStatsDoc | null, id: string): PlayerSeasonStats | null {
  const line = doc?.players.find((x) => x.id === id);
  return line && line.appearances > 0 ? line : null;
}

/** Nota média com uma casa decimal e vírgula ("7,1"); "-" sem nota. */
export function ratingText(r: number | null): string {
  return r === null || !Number.isFinite(r) ? '-' : r.toFixed(1).replace('.', ',');
}

const TYPE_ORDER: Record<CompetitionType, number> = { league: 0, supercup: 1, cup: 1, europe: 2, friendly: 3 };

/** Competições da época: liga, depois taças (supertaça incluída), europeias e, em cada tipo, pelo nome. */
export function orderCompetitions<C extends { name: string; type: CompetitionType }>(cs: C[]): C[] {
  return [...cs].sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.name.localeCompare(b.name, 'pt'));
}

// `fixtures`, `cleanSheet`, `failedToScore` e `goals.*.total` guardam a forma da API-Football: só se lê o que
// se mostra, e uma forma inesperada fica a null em vez de invalidar o documento.
const SplitSchema = z.object({ home: z.number(), away: z.number(), total: z.number() });
export type Split = z.infer<typeof SplitSchema>;
const split = (v: unknown): Split | null => {
  const r = SplitSchema.safeParse(v);
  return r.success ? r.data : null;
};

/** Períodos mostrados: do apito inicial ao fim dos 90 (o prolongamento fica de fora). */
export const PERIODS = ['0-15', '16-30', '31-45', '46-60', '61-75', '76-90'] as const;

export type TeamStatsVM = {
  form: FormLetter[];
  goalsFor: Split | null;
  goalsAgainst: Split | null;
  cleanSheet: Split | null;
  periods: { label: string; for: number; against: number }[];
  /** Nada para mostrar ("Sem estatísticas para esta competição."). */
  empty: boolean;
};

export function teamStatsVM(doc: TeamStatsDoc): TeamStatsVM {
  const forMin = doc.goals.for.minute;
  const againstMin = doc.goals.against.minute;
  const hasPeriods = PERIODS.some((k) => forMin[k] !== undefined || againstMin[k] !== undefined);
  const periods = hasPeriods
    ? PERIODS.map((label) => ({ label, for: forMin[label]?.total ?? 0, against: againstMin[label]?.total ?? 0 }))
    : [];
  const vm = {
    form: formLetters(doc.form),
    goalsFor: split(doc.goals.for.total),
    goalsAgainst: split(doc.goals.against.total),
    cleanSheet: split(doc.cleanSheet),
    periods,
  };
  const empty = vm.form.length === 0 && !vm.goalsFor && !vm.goalsAgainst && !vm.cleanSheet && periods.length === 0;
  return { ...vm, empty };
}
