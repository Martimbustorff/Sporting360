import { GameState } from "./types";

/** Resultado que conta: FT, AET (prolongamento incluído) ou PEN (golos antes dos penáltis, ou seja empate). */
export function countedScore(g: GameState): { home: number; away: number } | null {
  if (g.status !== "FT" && g.status !== "AET" && g.status !== "PEN") return null;
  if (g.goalsHome === null || g.goalsAway === null) return null;
  return { home: g.goalsHome, away: g.goalsAway };
}

export function outcome(home: number, away: number): "H" | "D" | "A" {
  if (home > away) return "H";
  if (home < away) return "A";
  return "D";
}
