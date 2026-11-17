export interface ISummary {
  Detail: string;
  Comments: string;
  Time: string;
  TimeExtra:string,
  Team: string | number;
  Api:string;
  player: string | number;
  playerSub: string | number;
  Type: string; // Assuming Type can only be "Card"
}
