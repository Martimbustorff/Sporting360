interface TeamAttributes {
  Name: string;
  Logo: string;
}

interface TeamData {
  data: {
    id:number,
    attributes: TeamAttributes;
  };
}

interface GameAttributes {
  Competation: string;
  API: string;
  Timestamp: string;
  ElapseTime:string;
  Channel: string;
  Journey: string;
  ScoreHome: string;
  ScoreAway: string;
  TeamHome: TeamData;
  TeamAway: TeamData;
}

interface GameData {
  id: string;
  attributes: GameAttributes;
}

interface GamesData {
  data: GameData[];
}

interface GamesDataById {
  data: GameData;
}
export interface IGameByIdResponse {
  game: GamesDataById;
}


export interface IGamesResponse {
    games: GamesData;
}

