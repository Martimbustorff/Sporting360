export interface IPlayers {
  GameId: string;
  id: string;
  teamId: string;
  Players: {
    playerId: string;
    name?: string;
    photo: string;
    number: number;
    position: string;
    rating: string;
    minutes: number;
    goals: number;
    assists: number;
    saves: number;
    grid?: string;
    passesAccuracy: string;
    tackles: number;
    foulsCommitted: number;
    cardsYellow: number;
    cardsRed: number;
    substitute: boolean;
  }[];
}