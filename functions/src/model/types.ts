import type { GameStatus } from "../game/types";

export type Sport = "football" | "futsal" | "handball" | "roller_hockey" | "volleyball" | "basketball";

export type CompetitionType = "league" | "cup" | "supercup" | "europe" | "friendly";

export interface TeamRef {
  id: string;
  name: string;
  logo: string | null;
}

export type Pair = { home: number | null; away: number | null };

/** Jogo no modelo novo (`matches/{id}`). As datas são `Date`; o escritor converte para `Timestamp`. */
export interface MatchDoc {
  id: string;
  sport: Sport;
  competition: {
    key: string;
    id: string;
    name: string;
    type: CompetitionType;
    season: string;
    round: string | null;
    roundLabel: string | null;
  };
  home: TeamRef;
  away: TeamRef;
  sportingSide: "home" | "away";
  kickoff: Date;
  status: GameStatus;
  statusRaw: string;
  elapsed: number | null;
  elapsedExtra: number | null;
  score: {
    home: number | null;
    away: number | null;
    halftime: Pair | null;
    extratime: Pair | null;
    penalty: Pair | null;
    sets?: Pair[];
  };
  finishedAt: Date | null;
  finishedAtSource: "observed" | "estimated" | null;
  venue?: {
    id: string | null;
    name: string;
    city: string | null;
    capacity?: number | null;
    image?: string | null;
  } | null;
  referee: string | null;
  source: { provider: string; id: string; fallbackUsed?: boolean };
  locked?: boolean;
}
