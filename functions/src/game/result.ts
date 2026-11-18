import { logger } from "firebase-functions";
import { GameState } from "./types";

/** Resultado que conta: FT, AET (prolongamento incluído) ou PEN (golos antes dos penáltis, ou seja empate). */
export function countedScore(g: GameState): { home: number; away: number } | null {
  if (g.status !== "FT" && g.status !== "AET" && g.status !== "PEN") return null;
  if (g.goalsHome === null || g.goalsAway === null) return null;
  if (g.status === "PEN" && g.goalsHome !== g.goalsAway) {
    // Decidido nos penáltis conta como empate. Golos desiguais em PEN são dados inconsistentes da API:
    // nunca atribuir uma vitória, por isso usa-se o menor valor para os dois lados.
    logger.warn(`countedScore: jogo ${g.gameId} em PEN com golos desiguais (${g.goalsHome}-${g.goalsAway}); contado como empate`);
    const d = Math.min(g.goalsHome, g.goalsAway);
    return { home: d, away: d };
  }
  return { home: g.goalsHome, away: g.goalsAway };
}

export function outcome(home: number, away: number): "H" | "D" | "A" {
  if (home > away) return "H";
  if (home < away) return "A";
  return "D";
}
