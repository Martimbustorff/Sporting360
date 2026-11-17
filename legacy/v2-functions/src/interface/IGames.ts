import { Timestamp } from "@firebase/firestore";

export interface IGame {
  competition: string;
  season?: string;
  timestamp: Timestamp;
  channel: string;
  journey: string;
  scorehome: string;
  scoreaway: string;
  api: string;
  elapsedTime: string;
  teamhome: {
    name: string;
    logo: string;
    api: string;
  };
  teamaway: {
    name: string;
    logo: string;
    api: string;
  };
  isActive: boolean;
  startTime: string;
  endTime:string;
  // Set once predictionSettlement.ts has awarded the +3 exact-score bonus
  // for every prediction on this game. Absent/false means "not settled yet".
  predictionsSettled?: boolean;
}
