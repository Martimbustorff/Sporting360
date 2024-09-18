interface GameData {
  id: string;
}

interface TeamData {
  id: string;
}

interface StatisticsAttributes {
  game: {
    data: GameData;
  };
  Team: {
    data: TeamData;
  };
  Type: string;
  Value: string | number | null; // Adjust the type based on the possible values
}

interface StatisticsData {
  id: string;
  attributes: StatisticsAttributes;
}

interface Statistics {
  data: StatisticsData[];
}

export interface IStatisticsResponse {
  statistics: Statistics;
}


