import type { GameStatus } from "../game/types";

export const FINAL_STATUSES: ReadonlySet<GameStatus> = new Set<GameStatus>(["FT", "AET", "PEN"]);
export const LIVE_STATUSES: ReadonlySet<GameStatus> = new Set<GameStatus>(["LIVE", "HT"]);

const FOOTBALL: Record<string, GameStatus> = {
  NS: "NS", TBD: "NS",
  "1H": "LIVE", "2H": "LIVE", ET: "LIVE", BT: "LIVE", P: "LIVE", LIVE: "LIVE", INT: "LIVE",
  HT: "HT", FT: "FT", AET: "AET", PEN: "PEN",
  PST: "PST", SUSP: "PST",
  CANC: "CANC", ABD: "CANC", AWD: "CANC", WO: "CANC",
};

/** Código curto da API-Football para estado normalizado. Desconhecido → NS. */
export function footballStatus(short: string): GameStatus {
  return FOOTBALL[short.trim().toUpperCase()] ?? "NS";
}

const COMMON: Record<string, GameStatus> = {
  NS: "NS", POST: "PST", CANC: "CANC", INTR: "PST", SUSP: "PST", ABD: "CANC", AWD: "CANC",
};

const BY_SPORT: Record<"handball" | "volleyball" | "basketball", Record<string, GameStatus>> = {
  handball: {
    "1H": "LIVE", "2H": "LIVE", ET: "LIVE", BT: "LIVE", PT: "LIVE",
    HT: "HT", FT: "FT", AET: "AET", AP: "PEN",
  },
  volleyball: {
    S1: "LIVE", S2: "LIVE", S3: "LIVE", S4: "LIVE", S5: "LIVE",
    FT: "FT", AW: "CANC",
  },
  basketball: {
    Q1: "LIVE", Q2: "LIVE", Q3: "LIVE", Q4: "LIVE", OT: "LIVE", BT: "LIVE",
    HT: "HT", FT: "FT", AOT: "AET",
  },
};

/** Código curto das APIs API-Sports (andebol, voleibol, basquetebol). Desconhecido → NS. */
export function apiSportsStatus(sport: "handball" | "volleyball" | "basketball", short: string): GameStatus {
  const code = short.trim().toUpperCase();
  return BY_SPORT[sport][code] ?? COMMON[code] ?? "NS";
}
