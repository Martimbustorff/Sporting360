interface TeamStatistics {
  type: string;
  value: number | string | null;
}

interface Team {
  id: number;
  name: string;
  logo: string;
}

export interface ISatisticsApI {
  team: Team;
  statistics: TeamStatistics[];
}