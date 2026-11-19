// Typed read hooks for games, competitions and the Sporting team (Plan 2 read contract,
// docs/superpowers/plans/2026-11-18-plan-4-ecras.md, "Contrato de leitura").
import { useEffect, useMemo, useState } from 'react';
import type { z } from 'zod';
import { collection, doc, getDoc, limit, orderBy, query, where, type Query } from '@react-native-firebase/firestore';
import { db } from '@/services/firebase';
import { orderCompetitions } from '@/lib/team';
import { BLOCK_MS } from './clock';
import { useCollection, useDocument, type Loadable } from './hooks';
import {
  BracketDocSchema,
  CoachDocSchema,
  CompetitionSchema,
  EventsDocSchema,
  FixturesDocSchema,
  InjuriesDocSchema,
  LineupsDocSchema,
  MatchSchema,
  MvpTallySchema,
  PlayersDocSchema,
  PlayerStatsDocSchema,
  PrematchDocSchema,
  RoundsDocSchema,
  SidelinedDocSchema,
  SquadDocSchema,
  StandingsDocSchema,
  LiveFixturesDocSchema,
  StatisticsDocSchema,
  TeamInjuriesDocSchema,
  TeamStatsDocSchema,
  TopListDocSchema,
  TransfersDocSchema,
  TrophiesDocSchema,
  VenueSchema,
  VideoSchema,
  type Bracket,
  type CoachDoc,
  type Competition,
  type CompetitionType,
  type DetailDocs,
  type FixturesDoc,
  type GameStatus,
  type Match,
  type MvpTally,
  type PlayerStatsDoc,
  type RoundsDoc,
  type SidelinedDoc,
  type Sport,
  type SquadDoc,
  type StandingsDoc,
  type LiveFixturesDoc,
  type TeamInjuriesDoc,
  type TeamStatsDoc,
  type TopListDoc,
  type TransfersDoc,
  type TrophiesDoc,
  type Venue,
  type Video,
} from './schemas';

const HOUR = 3_600_000;
// List queries are rebuilt at most once per BLOCK_MS block of `now` (no resubscribe per render).
const LIST_LIMIT = 40;
const NEXT_LIMIT = 3;
/** A game started up to 4 h ago still counts as "upcoming" (it may be live). */
const UPCOMING_GRACE_MS = 4 * HOUR;
const HOME_LOOKBACK_MS = 24 * HOUR;
const HOME_LIMIT = 6;
const DONE: ReadonlySet<GameStatus> = new Set<GameStatus>(['FT', 'AET', 'PEN', 'CANC']);
const TEAM = 'teams/football_228';

/** Same Loadable with `data` transformed; keeps `fromCache`. Memoized on the input object. */
function useMapped<A, B>(l: Loadable<A>, f: (a: A) => B): Loadable<B> {
  // `f` must be a module-level function: only the Loadable identity is a dependency.
  return useMemo(() => (l.status === 'ready' ? { status: 'ready', data: f(l.data), fromCache: l.fromCache } : l), [l]);
}

/** Start of the 10-minute block that holds `now`, as a stable number for memo deps. */
const blockOf = (now: Date): number => Math.floor(now.getTime() / BLOCK_MS) * BLOCK_MS;

// --- Matches ---------------------------------------------------------------------------------

export function useMatch(id: string | null): Loadable<Match> {
  return useDocument(id ? `matches/${id}` : null, MatchSchema);
}

/** Leituras únicas de jogos, uma por id e por execução da app (a lista do histórico do perfil tem uma linha por jogo). */
const matchOnce = new Map<string, Promise<Match | null>>();

/**
 * Um jogo lido uma só vez (getDoc, sem listener): para listas com uma linha por jogo. `undefined` enquanto chega; `null` se o
 * jogo não existe, é inválido ou a leitura falhou (nesse caso a próxima linha a pedi-lo volta a tentar). Não escreve nada e
 * o id do jogo nunca vai para logs.
 */
export function useMatchOnce(id: string | null): Match | null | undefined {
  const [held, setHeld] = useState<{ id: string | null; match: Match | null } | null>(null);
  useEffect(() => {
    if (id === null) return undefined;
    let alive = true;
    let pending = matchOnce.get(id);
    if (!pending) {
      pending = getDoc(doc(db(), `matches/${id}`)).then(
        (snap) => {
          const parsed = snap.exists() ? MatchSchema.safeParse({ id, ...snap.data() }) : null;
          return parsed?.success ? parsed.data : null;
        },
        () => {
          matchOnce.delete(id);
          return null;
        },
      );
      matchOnce.set(id, pending);
    }
    void pending.then((match) => {
      if (alive) setHeld({ id, match });
    });
    return () => {
      alive = false;
    };
  }, [id]);
  if (id === null) return null;
  return held?.id === id ? held.match : undefined;
}

export type DetailKind = keyof DetailDocs;

const DETAIL_SCHEMAS: { [K in DetailKind]: z.ZodType<DetailDocs[K]> } = {
  events: EventsDocSchema,
  statistics: StatisticsDocSchema,
  lineups: LineupsDocSchema,
  players: PlayersDocSchema,
  prematch: PrematchDocSchema,
  injuries: InjuriesDocSchema,
};

/** Percentagens do MVP: mvpTallies/{gameId}, escrito pelo servidor ao minuto (as shards não se leem). Inexistente = `missing`. */
export function useMvpTally(gameId: string | null): Loadable<MvpTally> {
  return useDocument(gameId ? `mvpTallies/${gameId}` : null, MvpTallySchema);
}

export function useMatchDetail<K extends DetailKind>(id: string | null, kind: K): Loadable<DetailDocs[K]> {
  return useDocument(id ? `matches/${id}/details/${kind}` : null, DETAIL_SCHEMAS[kind]);
}

const byPublishedAt = (vs: Video[]): Video[] =>
  [...vs].sort((a, b) => {
    if (a.publishedAt === null) return b.publishedAt === null ? 0 : 1;
    if (b.publishedAt === null) return -1;
    return a.publishedAt.getTime() - b.publishedAt.getTime();
  });

/** Videos of a game, oldest first; videos without `publishedAt` go last. */
export function useMatchVideos(id: string | null): Loadable<Video[]> {
  const q = useMemo(() => (id ? collection(db(), `matches/${id}/videos`) : null), [id]);
  return useMapped(useCollection(q, VideoSchema), byPublishedAt);
}

function upcomingQuery(sport: Sport, block: number, n: number): Query {
  return query(
    collection(db(), 'matches'),
    where('sport', '==', sport),
    where('kickoff', '>=', new Date(block - UPCOMING_GRACE_MS)),
    orderBy('kickoff', 'asc'),
    limit(n),
  );
}

/** Games of `sport` from 4 h before `now` on, soonest first (40). `now` counts per 10-minute block. */
export function useUpcomingMatches(sport: Sport | null, now: Date): Loadable<Match[]> {
  const block = blockOf(now);
  const q = useMemo(() => (sport ? upcomingQuery(sport, block, LIST_LIMIT) : null), [sport, block]);
  return useCollection(q, MatchSchema);
}

/** Games of `sport` that kicked off before `now`, latest first (40). `now` counts per 10-minute block. */
export function useResultMatches(sport: Sport | null, now: Date): Loadable<Match[]> {
  const block = blockOf(now);
  const q = useMemo(
    () =>
      sport
        ? query(
            collection(db(), 'matches'),
            where('sport', '==', sport),
            where('kickoff', '<', new Date(block)),
            orderBy('kickoff', 'desc'),
            limit(LIST_LIMIT),
          )
        : null,
    [sport, block],
  );
  return useCollection(q, MatchSchema);
}

const firstOpen = (ms: Match[]): Match | null => ms.find((m) => !DONE.has(m.status)) ?? null;

/** Next football game not yet finished or cancelled (a live one counts); null when none is scheduled. */
export function useNextFootballMatch(now: Date): Loadable<Match | null> {
  const block = blockOf(now);
  const q = useMemo(() => upcomingQuery('football', block, NEXT_LIMIT), [block]);
  return useMapped(useCollection(q, MatchSchema), firstOpen);
}

/**
 * Jogos de futebol desde 24 h antes, por apito (6): a Home escolhe o do cartão com lib/homeMatchMoment.pickHomeMatch
 * (ao vivo, por abrir ou terminado hoje em Lisboa), ao minuto. Mesma coleção e campos de sempre; só a janela é maior.
 * `attempt` muda a query para tentar outra vez depois de um erro.
 */
export function useHomeMatches(now: Date, attempt = 0): Loadable<Match[]> {
  const block = blockOf(now);
  const q = useMemo(
    () =>
      query(
        collection(db(), 'matches'),
        where('sport', '==', 'football'),
        where('kickoff', '>=', new Date(block - HOME_LOOKBACK_MS)),
        orderBy('kickoff', 'asc'),
        limit(HOME_LIMIT),
      ),
    // `attempt` só serve para reconstruir a query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [block, attempt],
  );
  return useCollection(q, MatchSchema);
}

// --- Competitions ----------------------------------------------------------------------------

export function useCompetition(key: string | null): Loadable<Competition> {
  return useDocument(key ? `competitions/${key}` : null, CompetitionSchema);
}

export type CompetitionDataDocs = {
  standings: StandingsDoc;
  liveFixtures: LiveFixturesDoc;
  fixtures: FixturesDoc;
  rounds: RoundsDoc;
  bracket: Bracket;
  topscorers: TopListDoc;
  topassists: TopListDoc;
  topyellowcards: TopListDoc;
  topredcards: TopListDoc;
};
export type CompetitionDataKind = keyof CompetitionDataDocs;

const COMPETITION_SCHEMAS: { [K in CompetitionDataKind]: z.ZodType<CompetitionDataDocs[K]> } = {
  standings: StandingsDocSchema,
  liveFixtures: LiveFixturesDocSchema,
  fixtures: FixturesDocSchema,
  rounds: RoundsDocSchema,
  bracket: BracketDocSchema,
  topscorers: TopListDocSchema,
  topassists: TopListDocSchema,
  topyellowcards: TopListDocSchema,
  topredcards: TopListDocSchema,
};

export function useCompetitionData<K extends CompetitionDataKind>(
  key: string | null,
  kind: K,
): Loadable<CompetitionDataDocs[K]> {
  return useDocument(key ? `competitions/${key}/data/${kind}` : null, COMPETITION_SCHEMAS[kind]);
}

export type SeasonCompetition = { key: string; leagueId: string; name: string; type: CompetitionType };

const distinctCompetitions = (ms: Match[]): SeasonCompetition[] => {
  const seen = new Map<string, SeasonCompetition>();
  for (const m of ms) {
    const c = m.competition;
    if (c.type === 'friendly' || seen.has(c.key)) continue;
    seen.set(c.key, { key: c.key, leagueId: c.id, name: c.name, type: c.type });
  }
  // The query has no orderBy (document id order): sort so the list is stable.
  return orderCompetitions([...seen.values()]);
};

/**
 * Competitions of the football `season` (start year), from its games, without friendlies.
 * Order: league, then cups (supercup included), then europe, by name within each type.
 */
export function useSeasonFootballCompetitions(season: string): Loadable<SeasonCompetition[]> {
  const q = useMemo(
    () =>
      query(
        collection(db(), 'matches'),
        where('sport', '==', 'football'),
        where('competition.season', '==', season),
      ),
    [season],
  );
  return useMapped(useCollection(q, MatchSchema), distinctCompetitions);
}

// --- Team ------------------------------------------------------------------------------------

export type TeamDataDocs = {
  squad: SquadDoc;
  coach: CoachDoc;
  injuries: TeamInjuriesDoc;
  transfers: TransfersDoc;
  trophies: TrophiesDoc;
  sidelined: SidelinedDoc;
};
export type TeamDataKind = keyof TeamDataDocs;

const TEAM_SCHEMAS: { [K in TeamDataKind]: z.ZodType<TeamDataDocs[K]> } = {
  squad: SquadDocSchema,
  coach: CoachDocSchema,
  injuries: TeamInjuriesDocSchema,
  transfers: TransfersDocSchema,
  trophies: TrophiesDocSchema,
  sidelined: SidelinedDocSchema,
};

export function useTeamData<K extends TeamDataKind>(kind: K): Loadable<TeamDataDocs[K]> {
  return useDocument(`${TEAM}/data/${kind}`, TEAM_SCHEMAS[kind]);
}

/** `season` is the football season (`footballSeason`, August start), e.g. "2026". */
export function usePlayerStats(season: string): Loadable<PlayerStatsDoc> {
  return useDocument(`${TEAM}/data/playerStats_${season}`, PlayerStatsDocSchema);
}

export function useTeamStats(leagueId: string, season: string): Loadable<TeamStatsDoc> {
  return useDocument(`${TEAM}/data/teamStats_${leagueId}_${season}`, TeamStatsDocSchema);
}

export function useVenue(id: string | null): Loadable<Venue> {
  return useDocument(id ? `venues/${id}` : null, VenueSchema);
}
