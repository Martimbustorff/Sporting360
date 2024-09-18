interface TeamAttributes {
  Name: string;
}

interface TeamData {
  attributes: TeamAttributes;
}

interface StandingAttributes {
  Competation: string;
  Draw: string;
  GoalsAgainst: string;
  GoalsFor: string;
  Lose: string;
  Played: string;
  Points: string;
  Rank: string;
  Win: string;
  Team: {
    data: TeamData;
  };
}

interface StandingItem {
  attributes: StandingAttributes;
}
interface Standings {
  data: StandingItem[];
}


 export interface IStandingsResponse{
  standings: Standings;
}


