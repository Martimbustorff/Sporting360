interface Team {
  id: number;
  name: string;
  logo: string;
}

interface Goals {
  for: number;
  against: number;
}

interface TeamStats {
  played: number;
  win: number;
  draw: number;
  lose: number;
  goals: Goals;
}

interface StandingsItem {
  rank: number;
  team: Team;
  points: number;
  goalsDiff: number;
  group: string;
  form: string;
  status: string;
  description: string | null;
  all: TeamStats;
  home: TeamStats;
  away: TeamStats;
  update: string;
}

interface League {
  id: number;
  name: string;
  country: string;
  logo: string;
  flag: string;
  season: number;
  standings: StandingsItem[][];
}

export interface IStandingApi {
  league: League;
}
