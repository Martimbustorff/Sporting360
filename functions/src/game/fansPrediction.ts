import type { GameState } from "./types";

// Previsão dos sportinguistas (Plano 10, Martim 20/11). Contagem anónima dos palpites em
// `predictionTallies/{gameId}` (lido pela app) e `predictionTallies/{gameId}/private/split` (fechado nas regras).
// Antes do apito a app só vê `total`; as percentagens (win/draw/loss, do lado do Sporting) entram no documento
// público ao apito inicial, escritas pelo agregador.

export type Outcome = "home" | "draw" | "away";

export interface FansSplit {
  win: number;
  draw: number;
  loss: number;
}

export const TALLY_COLLECTION = "predictionTallies";
export const SPLIT_DOC = "private/split";

export function outcomeOf(home: number, away: number): Outcome {
  if (home > away) return "home";
  if (home < away) return "away";
  return "draw";
}

const count = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

/** Converte a contagem por lado (casa/empate/fora) em vitória/empate/derrota do Sporting. */
export function splitFor(sportingSide: GameState["sportingSide"], raw: Record<string, unknown>): FansSplit {
  const home = count(raw.home);
  const away = count(raw.away);
  return {
    win: sportingSide === "home" ? home : away,
    draw: count(raw.draw),
    loss: sportingSide === "home" ? away : home,
  };
}

/** O jogo começou de facto: só então as percentagens ficam públicas. Adiado ou cancelado nunca revela. */
export function revealed(g: GameState): boolean {
  return g.status === "LIVE" || g.status === "HT" || g.status === "FT" || g.status === "AET" || g.status === "PEN";
}
