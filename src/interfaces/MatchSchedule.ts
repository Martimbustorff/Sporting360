export interface Match {
  name: string;
  homeTeam?: string;
  awaiTeam?: string;
  data: string;
  time: string;
  result: string;
}

export interface MatchSchedule {
  [monthYear: string]: Match[];
}
