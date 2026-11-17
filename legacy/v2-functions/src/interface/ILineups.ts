export interface ILineups {
  GameId: string;
  teamId: string;
  formation: string;
  startXI : {
    playerId: string;
    name: string;
    position: string;
    number: number;
    grid: string;
  }[];
  substitutes: {
    playerId: string;
    position: string;
    name: string;
    grid: string;
    number: number;
  }[];
  id: string;
}
