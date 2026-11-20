// Forma documentada da API-Football v3 (campos usados pela ingestão).

export interface AfTeamRef {
  id: number;
  name: string;
  logo: string;
}

export interface AfFixtureCore {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    periods: { first: number | null; second: number | null };
    venue: { id: number | null; name: string | null; city: string | null };
    status: { long: string; short: string; elapsed: number | null; extra?: number | null };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    round: string;
  };
  teams: {
    home: AfTeamRef & { winner: boolean | null };
    away: AfTeamRef & { winner: boolean | null };
  };
  goals: { home: number | null; away: number | null };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
}

export interface AfEvent {
  time: { elapsed: number; extra: number | null };
  team: AfTeamRef;
  player: { id: number | null; name: string | null };
  assist: { id: number | null; name: string | null };
  type: string; // Goal | Card | subst | Var
  detail: string;
  comments: string | null;
}

export interface AfLineupPlayer {
  player: { id: number; name: string; number: number; pos: string; grid: string | null };
}

export interface AfLineup {
  team: AfTeamRef & { colors?: unknown };
  formation: string | null;
  startXI: AfLineupPlayer[];
  substitutes: AfLineupPlayer[];
  coach: { id: number | null; name: string | null; photo?: string | null };
}

export interface AfTeamStatistics {
  team: AfTeamRef;
  statistics: { type: string; value: number | string | null }[];
}

export interface AfPlayerMatchStats {
  games: { minutes: number | null; number: number | null; position: string | null; rating: string | null; captain: boolean; substitute: boolean };
  goals: { total: number | null; conceded: number | null; assists: number | null; saves: number | null };
  cards: { yellow: number | null; red: number | null };
  [k: string]: unknown;
}

/** Forma real da API (gravada a 20/11): o jogador vem em `player`, as estatísticas ao lado. */
export interface AfFixturePlayers {
  team: AfTeamRef;
  players: { player: { id: number; name: string; photo: string | null }; statistics: AfPlayerMatchStats[] }[];
}

/** Fixture completa (pedido por `ids`): inclui events, lineups, statistics e players. */
export interface AfFixture extends AfFixtureCore {
  events: AfEvent[];
  lineups: AfLineup[];
  statistics: AfTeamStatistics[];
  players: AfFixturePlayers[];
}

export interface AfStandingRow {
  rank: number;
  team: AfTeamRef;
  points: number;
  goalsDiff: number;
  group: string;
  form: string | null;
  status: string;
  description: string | null;
  all: AfStandingStats;
  home: AfStandingStats;
  away: AfStandingStats;
  update: string;
}

export interface AfStandingStats {
  played: number;
  win: number;
  draw: number;
  lose: number;
  goals: { for: number; against: number };
}

export interface AfStandingsResponse {
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    standings: AfStandingRow[][];
  };
}

export interface AfPlayerSeason {
  player: {
    id: number;
    name: string;
    firstname?: string;
    lastname?: string;
    age: number | null;
    nationality?: string | null;
    height?: string | null;
    weight?: string | null;
    injured?: boolean;
    photo: string;
  };
  statistics: {
    team: AfTeamRef;
    league: { id: number; name: string; country: string; season: number };
    games: { appearences: number | null; lineups?: number | null; minutes: number | null; position: string | null; rating: string | null; [k: string]: unknown };
    goals: { total: number | null; assists: number | null; conceded?: number | null; saves?: number | null };
    cards: { yellow: number | null; red: number | null; yellowred?: number | null };
    [k: string]: unknown;
  }[];
}

export interface AfSquad {
  team: AfTeamRef;
  players: { id: number; name: string; age: number | null; number: number | null; position: string; photo: string }[];
}

export interface AfCoach {
  id: number;
  name: string;
  firstname?: string;
  lastname?: string;
  age: number | null;
  nationality: string | null;
  photo: string;
  team: AfTeamRef;
  career: { team: AfTeamRef; start: string | null; end: string | null }[];
}

export interface AfInjury {
  player: { id: number; name: string; photo: string; type: string; reason: string };
  team: AfTeamRef;
  fixture: { id: number; timestamp: number; date: string };
  league: { id: number; season: number; name: string };
}

export interface AfPrediction {
  predictions: {
    winner: { id: number | null; name: string | null; comment: string | null };
    win_or_draw: boolean;
    under_over: string | null;
    goals: { home: string | null; away: string | null };
    advice: string;
    percent: { home: string; draw: string; away: string };
  };
  league: AfFixtureCore["league"] | Record<string, unknown>;
  teams: { home: Record<string, unknown>; away: Record<string, unknown> };
  comparison: Record<string, { home: string; away: string }>;
  h2h: AfFixtureCore[];
}

export interface AfTransfer {
  player: { id: number; name: string };
  update: string;
  transfers: { date: string; type: string | null; teams: { in: AfTeamRef; out: AfTeamRef } }[];
}

export interface AfTrophy {
  league: string;
  country: string;
  season: string;
  place: string;
}

export interface AfSidelined {
  id?: number;
  sidelined: { type: string; start: string; end: string | null }[];
}

export interface AfVenue {
  id: number;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  capacity: number | null;
  surface: string | null;
  image: string | null;
}

export interface AfTopPlayer extends AfPlayerSeason {}

/** Estatísticas de equipa por liga/época (`teams/statistics`); só os campos usados são tipados. */
export interface AfTeamSeasonStats {
  league: { id: number; name: string; season: number };
  team: AfTeamRef;
  form: string | null;
  fixtures: Record<"played" | "wins" | "draws" | "loses", { home: number; away: number; total: number }>;
  goals: Record<"for" | "against", { total: { home: number; away: number; total: number }; average: { home: string; away: string; total: string } }>;
  clean_sheet: { home: number; away: number; total: number };
  failed_to_score: { home: number; away: number; total: number };
  [k: string]: unknown;
}
