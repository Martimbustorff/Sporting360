import { z } from 'zod';

/** Optional field that never fails the document: a malformed value becomes undefined. */
const lenient = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);

const stringOrNumber = z.union([z.string(), z.number()]);

const optUrl = z.string().optional().catch(undefined);
/** config/app `comunidadeLeonina[]` (functions/src/config/appConfig.ts). */
export const CommunityEntrySchema = z.object({
  name: z.string(),
  description: z.string().nullable().catch(null).default(null),
  image: z.string().nullable().catch(null).default(null),
  links: z
    .object({ twitter: optUrl, patreon: optUrl, youtube: optUrl })
    .catch({})
    .default({}),
});
export type CommunityEntry = z.infer<typeof CommunityEntrySchema>;

/**
 * config/app. Public read, written by the backend (Plan 2 seed).
 * Passthrough keeps `comunidadeLeonina`, `updatedAt` and whatever Plan 2 adds.
 */
export const AppConfigSchema = z.looseObject({
  minVersion: z.object({ ios: z.string(), android: z.string() }),
  // Opcionais e tolerantes: um valor malformado vira undefined em vez de invalidar o documento (a guarda falharia aberta).
  storeUrls: z.object({ ios: z.string().nullish(), android: z.string().nullish() }).nullish().catch(undefined),
  texts: z
    .object({
      updateRequiredTitle: z.string().nullish().catch(undefined),
      updateRequiredBody: z.string().nullish().catch(undefined),
      updateButton: z.string().nullish().catch(undefined),
    })
    .nullish()
    .catch(undefined),
  // Comunidade Leonina (hidden by default). A malformed list becomes [] and a malformed entry is dropped.
  comunidadeLeonina: z
    .array(z.unknown())
    .catch([])
    .transform((items) =>
      items.flatMap((i) => {
        const r = CommunityEntrySchema.safeParse(i);
        return r.success ? [r.data] : [];
      }),
    ),
  // Anything other than `true` means off.
  features: z
    .looseObject({ comunidadeLeonina: z.unknown().transform((v) => v === true) })
    .catch({ comunidadeLeonina: false })
    .default({ comunidadeLeonina: false }),
});
export type AppConfig = z.infer<typeof AppConfigSchema>;

/** publicProfiles/{uid}: the only per-user data other users may see. Never holds an email. */
export const PublicProfileSchema = z.object({
  displayName: z.string(),
  avatarId: z.string().nullable().default(null),
});
export type PublicProfile = z.infer<typeof PublicProfileSchema>;

export const SportSchema = z.enum(['football', 'futsal', 'handball', 'roller_hockey', 'volleyball', 'basketball']);
export type Sport = z.infer<typeof SportSchema>;

const boolOff = z.boolean().catch(false).default(false);
/** Notification preferences, stored only (no push in this release). A missing key is off. */
export const NotificationPrefsSchema = z.object({
  matchStart: boolOff,
  goals: boolOff,
  predictionReminder: boolOff,
  mvpOpen: boolOff,
  news: boolOff,
});
export type NotificationPrefs = z.infer<typeof NotificationPrefsSchema>;

/** users/{uid}: private V2 profile. Every field optional; V2 data is not uniform. */
export const UserDocSchema = z.looseObject({
  name: lenient(z.string()),
  email: lenient(z.string()),
  displayName: lenient(z.string()),
  /** Despite the name: "sócio desde" as `MM/AAAA` (V2). Read with String(v). */
  partnerNumber: lenient(stringOrNumber),
  /** Member number (new field; `partnerNumber` is not it). */
  memberNumber: lenient(z.string()),
  seasonSeat: lenient(z.string()),
  favoriteSport: lenient(SportSchema),
  favoritePlayer: lenient(z.object({ id: z.string(), name: z.string() })),
  notificationPrefs: lenient(NotificationPrefsSchema),
  /** V2: GameBox antiga só no perfil (cifrada ou em claro), lida como "Principal" (lib/gamebox). Só leitura. */
  gameboxNumber: lenient(stringOrNumber),
  gameboxName: lenient(stringOrNumber),
  gameboxPort: lenient(stringOrNumber),
  gameboxSector: lenient(stringOrNumber),
  gameboxLine: lenient(stringOrNumber),
  gameboxSeat: lenient(stringOrNumber),
});
export type UserDoc = z.infer<typeof UserDocSchema>;

// ---------------------------------------------------------------------------
// Sports data (Plan 2 backend, functions/src). Objects are loose: the server may add fields.
// Optional or presentational fields are tolerant (`nullable(...)` with a null fallback) so one
// odd value never drops a whole game; identity fields (ids, sport, status, kickoff) are strict.
// ---------------------------------------------------------------------------

/** Firestore Timestamp (anything with `toDate()`) or Date, returned as Date. */
export const ts = z
  .custom<Date | { toDate: () => Date }>(
    (v) =>
      v instanceof Date ||
      (typeof v === 'object' && v !== null && typeof (v as { toDate?: unknown }).toDate === 'function'),
    { message: 'Esperava Timestamp ou Date' },
  )
  .transform((v) => (v instanceof Date ? v : v.toDate()));

/** Nullable field that never fails the document: missing or malformed becomes null. */
const nullable = <T extends z.ZodType>(schema: T) => schema.nullable().catch(null);
const str = z.string();
const num = z.number();
/** Id that the server may write as number or string; always read as string. */
const idString = z.union([z.string(), z.number()]).transform(String);

export const GameStatusSchema = z.enum(['NS', 'LIVE', 'HT', 'FT', 'AET', 'PEN', 'PST', 'CANC']);
export type GameStatus = z.infer<typeof GameStatusSchema>;

export const CompetitionTypeSchema = z.enum(['league', 'cup', 'supercup', 'europe', 'friendly']);
export type CompetitionType = z.infer<typeof CompetitionTypeSchema>;

export const TeamRefSchema = z.looseObject({ id: str, name: str, logo: nullable(str) });
export type TeamRef = z.infer<typeof TeamRefSchema>;

const PairSchema = z.object({ home: num.nullable(), away: num.nullable() });
export type Pair = z.infer<typeof PairSchema>;

/** matches/{id} (`MatchDoc`, functions/src/model/types.ts). */
export const MatchSchema = z.looseObject({
  id: str,
  sport: SportSchema,
  competition: z.looseObject({
    key: str,
    id: str,
    name: str,
    type: CompetitionTypeSchema,
    season: str,
    round: nullable(str),
    roundLabel: nullable(str),
  }),
  home: TeamRefSchema,
  away: TeamRefSchema,
  sportingSide: z.enum(['home', 'away']),
  kickoff: ts,
  status: GameStatusSchema,
  elapsed: nullable(num),
  elapsedExtra: nullable(num),
  score: z.looseObject({
    home: num.nullable(),
    away: num.nullable(),
    halftime: nullable(PairSchema),
    extratime: nullable(PairSchema),
    penalty: nullable(PairSchema),
  }),
  finishedAt: nullable(ts),
  venue: nullable(
    z.looseObject({
      id: nullable(str),
      name: str,
      city: nullable(str),
      capacity: nullable(num),
      image: nullable(str),
    }),
  ),
  referee: nullable(str),
  /** Canal de TV ("SPORT TV", "BTV", "TVI / V+"); ausente ou null sem canal. */
  tv: z.string().nullish().catch(null),
  /** Estado em bruto da API (ET, BT, P...); documentos antigos não o têm. */
  statusRaw: z.string().nullish().catch(null),
  source: z.looseObject({ provider: str, id: str, attribution: nullable(str) }),
});
export type Match = z.infer<typeof MatchSchema>;

// matches/{id}/details/* (functions/src/football/mapFixture.ts, prematchSync.ts)

export const EventItemSchema = z.looseObject({
  minute: num,
  extra: nullable(num),
  teamId: str,
  playerId: nullable(str),
  playerName: nullable(str),
  assistId: nullable(str),
  assistName: nullable(str),
  type: z.enum(['goal', 'card', 'subst', 'var', 'other']).catch('other'),
  detail: str.catch(''),
  comments: nullable(str),
});
export type EventItem = z.infer<typeof EventItemSchema>;
export const EventsDocSchema = z.looseObject({ items: z.array(EventItemSchema) });
export type EventsDoc = z.infer<typeof EventsDocSchema>;

const StatsTeamsSchema = z.array(
  z.looseObject({ teamId: str, items: z.record(z.string(), z.union([z.string(), z.number(), z.null()])) }),
);
/**
 * `firstHalf`: instantâneo das estatísticas no intervalo (functions/src/store/writer.ts), só existe se o ticker viu o HT.
 * Documentos antigos não o têm; um valor malformado é ignorado (`.catch`), nunca parte o documento.
 */
const StatsPartSchema = z.looseObject({ teams: StatsTeamsSchema, xg: nullable(PairSchema).catch(null) });
export const StatisticsDocSchema = z.looseObject({
  teams: StatsTeamsSchema,
  xg: nullable(PairSchema),
  firstHalf: StatsPartSchema.optional().catch(undefined),
});
export type StatisticsDoc = z.infer<typeof StatisticsDocSchema>;

export const LineupPlayerSchema = z.looseObject({
  playerId: str,
  name: str,
  number: nullable(num),
  pos: nullable(str),
  grid: nullable(str),
});
export type LineupPlayer = z.infer<typeof LineupPlayerSchema>;
export const LineupsDocSchema = z.looseObject({
  teams: z.array(
    z.looseObject({
      teamId: str,
      formation: nullable(str),
      coach: nullable(z.looseObject({ id: nullable(str), name: str, photo: nullable(str) })),
      startXI: z.array(LineupPlayerSchema),
      substitutes: z.array(LineupPlayerSchema),
    }),
  ),
});
export type LineupsDoc = z.infer<typeof LineupsDocSchema>;

export const PlayerStatLineSchema = z.looseObject({
  playerId: str,
  name: str,
  photo: nullable(str),
  number: nullable(num),
  position: nullable(str),
  minutes: nullable(num),
  rating: nullable(num),
  goals: num.catch(0),
  assists: num.catch(0),
  saves: num.catch(0),
  passesAccuracy: nullable(num),
  tackles: num.catch(0),
  foulsCommitted: num.catch(0),
  cardsYellow: num.catch(0),
  cardsRed: num.catch(0),
  substitute: z.boolean().catch(false),
});
export type PlayerStatLine = z.infer<typeof PlayerStatLineSchema>;
export const PlayersDocSchema = z.looseObject({
  teams: z.array(z.looseObject({ teamId: str, players: z.array(PlayerStatLineSchema) })),
});
export type PlayersDoc = z.infer<typeof PlayersDocSchema>;

const Last5Schema = z.looseObject({
  played: nullable(num),
  form: nullable(str),
  att: nullable(str),
  def: nullable(str),
  goalsFor: nullable(num),
  goalsAgainst: nullable(num),
});
export const PrematchFullSchema = z.looseObject({
  fetchedAt: ts,
  advice: str.catch(''),
  winner: nullable(z.looseObject({ id: str, name: str, comment: str.catch('') })),
  percent: z.object({ home: num, draw: num, away: num }),
  form: z.object({ home: str.catch(''), away: str.catch('') }),
  last5: z.object({ home: nullable(Last5Schema), away: nullable(Last5Schema) }),
  h2h: z.array(
    z.looseObject({
      id: str,
      kickoff: ts,
      home: TeamRefSchema,
      away: TeamRefSchema,
      score: PairSchema,
    }),
  ),
});
export const PrematchEmptySchema = z.looseObject({ fetchedAt: ts, empty: z.literal(true) });
/** `{ fetchedAt, empty: true }` means "no predictions for this game". */
export const PrematchDocSchema = z.union([PrematchEmptySchema, PrematchFullSchema]);
export type PrematchDoc = z.infer<typeof PrematchDocSchema>;

export const InjuryItemSchema = z.looseObject({
  teamId: str,
  playerId: str,
  name: str,
  photo: nullable(str),
  type: nullable(str),
  reason: nullable(str),
});
export const InjuriesDocSchema = z.looseObject({ items: z.array(InjuryItemSchema), fetchedAt: nullable(ts) });
export type InjuriesDoc = z.infer<typeof InjuriesDocSchema>;

export type DetailDocs = {
  events: EventsDoc;
  statistics: StatisticsDoc;
  lineups: LineupsDoc;
  players: PlayersDoc;
  prematch: PrematchDoc;
  injuries: InjuriesDoc;
};

/** matches/{id}/videos/{videoId} (functions/src/videos/videosSync.ts). `publishedAt` null sorts last. */
export const VideoSchema = z.looseObject({
  id: str,
  title: str,
  minute: nullable(str),
  type: z.enum(['golo', 'resumo', 'flash_interview', 'outro']).catch('outro'),
  thumbnail: nullable(str),
  embedSrc: str,
  publishedAt: nullable(ts),
});
export type Video = z.infer<typeof VideoSchema>;

/** venues/{id} (prematchSync). */
export const VenueSchema = z.looseObject({
  name: str,
  city: nullable(str),
  address: nullable(str),
  capacity: nullable(num),
  surface: nullable(str),
  image: nullable(str),
});
export type Venue = z.infer<typeof VenueSchema>;

// competitions/{sport}_{leagueId}_{season} (functions/src/football/competitionSync.ts, bracket.ts)

export const CompetitionViewSchema = z.looseObject({
  primary: z.enum(['table', 'bracket']),
  hasTable: z.boolean(),
  hasBracket: z.boolean(),
  currentStage: nullable(str),
});
export type CompetitionView = z.infer<typeof CompetitionViewSchema>;

export const CompetitionSchema = z.looseObject({
  sport: SportSchema,
  leagueId: idString,
  name: str,
  type: CompetitionTypeSchema,
  logo: nullable(str),
  view: CompetitionViewSchema.optional().catch(undefined),
});
export type Competition = z.infer<typeof CompetitionSchema>;

export const StandingRowSchema = z.looseObject({
  rank: num,
  teamId: str,
  name: str,
  logo: nullable(str),
  points: num,
  played: num,
  win: num,
  draw: num,
  lose: num,
  goalsFor: num,
  goalsAgainst: num,
  goalsDiff: num,
  form: nullable(str),
  description: nullable(str),
});
export type StandingRow = z.infer<typeof StandingRowSchema>;
export const StandingsDocSchema = z.looseObject({
  groups: z.array(z.looseObject({ name: str.catch(''), rows: z.array(StandingRowSchema) })),
});
export type StandingsDoc = z.infer<typeof StandingsDocSchema>;

/** `competitions/{key}/data/liveFixtures` (functions/src/football/liveFixtures.ts): jogos da liga a decorrer. */
export const LiveFixtureSchema = z.looseObject({
  homeId: idString,
  awayId: idString,
  homeGoals: num,
  awayGoals: num,
  elapsed: nullable(num),
  status: str.catch(''),
});
export type LiveFixture = z.infer<typeof LiveFixtureSchema>;
export const LiveFixturesDocSchema = z.looseObject({ updatedAt: ts, fixtures: z.array(LiveFixtureSchema) });
export type LiveFixturesDoc = z.infer<typeof LiveFixturesDocSchema>;

export const FixtureItemSchema = z.looseObject({
  id: str,
  kickoff: ts,
  round: str,
  roundLabel: nullable(str),
  home: TeamRefSchema,
  away: TeamRefSchema,
  status: GameStatusSchema,
  score: z.looseObject({
    home: num.nullable(),
    away: num.nullable(),
    extraHome: nullable(num),
    extraAway: nullable(num),
    penaltyHome: nullable(num),
    penaltyAway: nullable(num),
  }),
});
export type FixtureItem = z.infer<typeof FixtureItemSchema>;
export const FixturesDocSchema = z.looseObject({ items: z.array(FixtureItemSchema) });
export type FixturesDoc = z.infer<typeof FixturesDocSchema>;

export const RoundsDocSchema = z.looseObject({
  items: z.array(z.looseObject({ raw: str, label: str })),
  current: nullable(str),
});
export type RoundsDoc = z.infer<typeof RoundsDocSchema>;

export const TieSchema = z.looseObject({
  id: str,
  stage: str,
  home: TeamRefSchema,
  away: TeamRefSchema,
  legs: z.array(
    z.looseObject({
      matchId: str,
      /** Casa desse jogo (`buildTie`, campo novo): o `score` da mão é do ponto de vista dela. Docs antigos não o têm. */
      homeId: lenient(str),
      /** ISO string (the server writes `toISOString()`), not a Timestamp. */
      kickoff: str,
      status: str,
      score: z.looseObject({
        home: num.nullable(),
        away: num.nullable(),
        penaltyHome: nullable(num),
        penaltyAway: nullable(num),
      }),
    }),
  ),
  aggregate: nullable(z.object({ home: num, away: num })),
  winnerTeamId: nullable(str),
  sportingInvolved: z.boolean().catch(false),
});
export type Tie = z.infer<typeof TieSchema>;
export const BracketDocSchema = z.looseObject({
  stages: z.array(z.looseObject({ label: str, raw: str, ties: z.array(TieSchema) })),
});
export type Bracket = z.infer<typeof BracketDocSchema>;

export const TopListItemSchema = z.looseObject({
  playerId: str,
  name: str,
  photo: nullable(str),
  teamId: str,
  teamName: str,
  teamLogo: nullable(str),
  value: num.catch(0),
});
export type TopListItem = z.infer<typeof TopListItemSchema>;
export const TopListDocSchema = z.looseObject({ items: z.array(TopListItemSchema) });
export type TopListDoc = z.infer<typeof TopListDocSchema>;

// teams/football_228/data/* (functions/src/football/teamSync.ts)

export const SquadPlayerSchema = z.looseObject({
  id: str,
  name: str,
  age: nullable(num),
  number: nullable(num),
  position: nullable(str),
  photo: nullable(str),
});
export type SquadPlayer = z.infer<typeof SquadPlayerSchema>;
export const SquadDocSchema = z.looseObject({ players: z.array(SquadPlayerSchema) });
export type SquadDoc = z.infer<typeof SquadDocSchema>;

export const CoachDocSchema = z.looseObject({
  id: str,
  name: str,
  age: nullable(num),
  nationality: nullable(str),
  photo: nullable(str),
  since: nullable(str),
});
export type CoachDoc = z.infer<typeof CoachDocSchema>;

/** Totais de um jogador numa liga (soma das linhas dessa liga); `byLeague` é indexado pelo id da liga na API-Football. */
const LeagueStatsSchema = z.looseObject({
  appearances: num.catch(0),
  minutes: num.catch(0),
  goals: num.catch(0),
  assists: num.catch(0),
});
export const PlayerSeasonStatsSchema = z.looseObject({
  id: str,
  name: str,
  photo: nullable(str),
  appearances: num.catch(0),
  minutes: num.catch(0),
  goals: num.catch(0),
  assists: num.catch(0),
  rating: nullable(num),
  yellow: num.catch(0),
  red: num.catch(0),
  /** Documentos antigos não o têm: fica `{}` (os filtros por competição ficam sem dados). */
  byLeague: z.record(z.string(), LeagueStatsSchema).catch({}),
});
export type PlayerSeasonStats = z.infer<typeof PlayerSeasonStatsSchema>;
export const PlayerStatsDocSchema = z.looseObject({ players: z.array(PlayerSeasonStatsSchema) });
export type PlayerStatsDoc = z.infer<typeof PlayerStatsDocSchema>;

const GoalsSideSchema = z.looseObject({
  total: z.unknown(),
  minute: z.record(z.string(), z.object({ total: num, percentage: nullable(str) })).catch({}),
});
/** API-Football team statistics; `fixtures`, `cleanSheet`, `failedToScore` keep the API's nested shape. */
export const TeamStatsDocSchema = z.looseObject({
  form: nullable(str),
  goals: z.looseObject({ for: GoalsSideSchema, against: GoalsSideSchema }),
  fixtures: z.unknown(),
  cleanSheet: z.unknown(),
  failedToScore: z.unknown(),
});
export type TeamStatsDoc = z.infer<typeof TeamStatsDocSchema>;

export const TeamInjuriesDocSchema = z.looseObject({
  items: z.array(
    z.looseObject({
      playerId: str,
      name: str,
      photo: nullable(str),
      type: nullable(str),
      reason: nullable(str),
      fixtureId: nullable(str),
      date: nullable(str),
    }),
  ),
});
export type TeamInjuriesDoc = z.infer<typeof TeamInjuriesDocSchema>;

export const TransferSchema = z.looseObject({
  playerId: str,
  name: str,
  date: str,
  type: nullable(str),
  direction: z.enum(['in', 'out']),
  in: TeamRefSchema,
  out: TeamRefSchema,
});
export type Transfer = z.infer<typeof TransferSchema>;
export const TransfersDocSchema = z.looseObject({ items: z.array(TransferSchema) });
export type TransfersDoc = z.infer<typeof TransfersDocSchema>;

export const TrophySchema = z.looseObject({ league: str, country: str.catch(''), season: str, place: str });
export type Trophy = z.infer<typeof TrophySchema>;
export const TrophiesDocSchema = z.looseObject({
  byPlayer: z.record(z.string(), z.array(TrophySchema)),
  coach: z.array(TrophySchema).catch([]),
});
export type TrophiesDoc = z.infer<typeof TrophiesDocSchema>;

export const SidelinedDocSchema = z.looseObject({
  byPlayer: z.record(z.string(), z.array(z.looseObject({ type: str, start: str, end: nullable(str) }))),
});
export type SidelinedDoc = z.infer<typeof SidelinedDocSchema>;

// ---------------------------------------------------------------------------
// Points, predictions, news and GameBox (read contract, plan 4 "Contrato de leitura").
// ---------------------------------------------------------------------------

/** leaderboards/{kind}_{key}/entries/{uid} (functions/src/points/ledger.ts). */
export const LeaderboardEntrySchema = z.looseObject({ uid: str, displayName: str.catch(''), points: num.catch(0) });
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

export const PointTypeSchema = z.enum([
  'prediction_participation',
  'prediction_exact',
  'prediction_outcome',
  'mvp_participation',
  'mvp_correct',
]);
export type PointType = z.infer<typeof PointTypeSchema>;

/** pointEvents/{uid}_{gameId}_{type}. `gameId` is null for events without a game. */
export const PointEventSchema = z.looseObject({
  uid: str,
  gameId: nullable(str),
  type: str,
  points: num,
  gameDate: ts,
});
export type PointEvent = z.infer<typeof PointEventSchema>;

/** matchPredictions/{gameId}_{uid}. V2 documents may lack `createdAt` and `source`. */
export const MatchPredictionSchema = z.looseObject({
  gameId: str,
  userId: str,
  home: num,
  away: num,
  createdAt: nullable(ts),
  source: z.string().optional().catch(undefined),
});
export type MatchPrediction = z.infer<typeof MatchPredictionSchema>;

/** mvpVotes/{gameId}_{uid}. */
export const MvpVoteSchema = z.looseObject({
  gameId: str,
  userId: str,
  playerId: idString,
  createdAt: nullable(ts),
  source: z.string().optional().catch(undefined),
});
export type MvpVote = z.infer<typeof MvpVoteSchema>;

/**
 * mvpTallies/{gameId}, written every minute by the aggregator (`updatedAt` and any other field are tolerated and
 * ignored). The shards under it are not client-readable.
 */
export const MvpTallySchema = z.object({
  gameId: z.string(),
  counts: z.record(z.string(), z.number().int().nonnegative()),
  total: z.number().int().nonnegative(),
});
export type MvpTally = z.infer<typeof MvpTallySchema>;

/** settlements/{gameId}, written once by the server. */
export const SettlementSchema = z.looseObject({
  finalHome: num,
  finalAway: num,
  officialMvp: z.array(idString).catch([]),
});
export type Settlement = z.infer<typeof SettlementSchema>;

/**
 * news/{id}. The document also holds `content`; a plain `z.object` strips unknown keys,
 * so the article body never reaches the app state.
 */
export const NewsSchema = z.object({
  id: str,
  title: str,
  image: nullable(str),
  summary: str.catch(''),
  source: str.catch(''),
  url: str,
  sport: SportSchema,
  publishedAt: ts,
});
export type News = z.infer<typeof NewsSchema>;

const gbText = z.string().optional().catch(undefined);
/** gamebox/{auto} (V2). `gameboxNumber` is ciphered; the app never logs it. */
export const GameboxDocSchema = z.looseObject({
  userid: str,
  gameboxNumber: str,
  gameboxName: str.catch(''),
  gameboxPort: gbText,
  gameboxSector: gbText,
  gameboxLine: gbText,
  gameboxSeat: gbText,
  pavilionPort: gbText,
  pavilionSector: gbText,
  pavilionLine: gbText,
  pavilionSeat: gbText,
  order: num.catch(0),
  default: z.boolean().catch(false),
});
export type GameboxDoc = z.infer<typeof GameboxDocSchema>;

// Empréstimo de GameBox (loans/{id}, functions/src/loans/model.ts). O número nunca está aqui (loans/{id}/secret/number).
// ownerUid / ownerName / recipientUid / recipientName são null depois de apagar a conta.
export const LoanSchema = z.looseObject({
  ownerUid: nullable(str),
  ownerName: nullable(str),
  gameboxId: str,
  matchId: str,
  sport: str.catch(''),
  match: z.looseObject({
    homeName: str.catch(''),
    awayName: str.catch(''),
    homeLogo: nullable(str),
    awayLogo: nullable(str),
    competition: str.catch(''),
    kickoff: ts,
    venue: z.enum(['stadium', 'pavilion']).catch('stadium'),
  }),
  seat: z.looseObject({ gate: nullable(str), sector: nullable(str), row: nullable(str), seat: nullable(str) }),
  createdAt: ts,
  expiresAt: ts,
  recipientUid: nullable(str),
  recipientName: nullable(str),
  openedAt: nullable(ts),
  cancelledAt: nullable(ts),
  /** Porque foi cancelado (functions/src/loans); documentos antigos não o têm. */
  cancelReason: z.enum(['owner', 'gamebox-edited', 'gamebox-deleted', 'recipient-left', 'owner-left']).nullish().catch(null),
});
export type Loan = z.infer<typeof LoanSchema>;
