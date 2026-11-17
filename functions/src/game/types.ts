export type GameStatus = "NS" | "LIVE" | "HT" | "FT" | "AET" | "PEN" | "PST" | "CANC";

export interface GameState {
  gameId: string;
  kickoff: Date;
  status: GameStatus;
  elapsed: number | null;
  goalsHome: number | null;
  goalsAway: number | null;
  finishedAt: Date | null;
  sportingSide: "home" | "away";
}
