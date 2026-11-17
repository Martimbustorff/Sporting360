export interface IGame {
  Competation: string;
  Timestamp: string;
  Channel: string;
  Journey: string;
  ScoreHome: string;
  Name: string;
  API: string;
  ScoreAway: string;
  TeamHome: string | number;
  TeamAway: string | number;
}

export interface IGameRequest {
  data: Array<{ id: number; attributes: IGame }>;
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}