export interface ISummary {
  type:string,
  detail:string,
  team: {
    name: string;
    logo: string;
    api: string;
  };
  player: {
    name: string;
    logo: string;
    api: string;
  },
  playerSub: {
    name: string;
    logo: string;
    api: string;
  }
  api: string;
  time: string;
  GameId: string;
}