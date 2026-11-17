export interface IStanding {
  Rank: string;
  Team: string | number; // Assuming it can be either a string or an ID represented by a number
  Points: string;
  Competition: string;
  Played: string;
  Win: string;
  Draw: string;
  Lose: string;
  GoalsFor: string;
  GoalsAgainst: string;
}