import { FINAL_STATUSES, LIVE_STATUSES } from "../model/status";
import type { MatchDoc } from "../model/types";

/**
 * Fases de um jogo para o ticker ao vivo. Fora de `idle` o jogo pertence ao ticker: o calendário
 * (fixturesSync) não lhe toca. Módulo próprio para fixturesSync e liveTicker não se importarem um ao outro.
 */
export type Phase = "idle" | "prematch" | "live" | "postmatch" | "ratings";

const MIN = 60_000;
const HOUR = 60 * MIN;

export const PREMATCH_LEAD_MS = 75 * MIN;
export const POSTMATCH_TAIL_MS = 25 * MIN;
export const RATINGS_REFRESH_MIN: readonly number[] = [30, 60, 110];
/** Cada refresco de ratings faz-se uma vez, no primeiro tick em [X, X + 10 min). */
export const RATINGS_WINDOW_MS = 10 * MIN;
/** NS depois do kickoff conta como live (atraso no início) durante este tempo. */
export const LATE_START_MS = 4 * HOUR;

/** Minuto de ratings (30, 60 ou 110) cuja janela de 10 min contém `now`; `null` fora delas. */
export function ratingsSlot(m: MatchDoc, now: Date): number | null {
  if (!FINAL_STATUSES.has(m.status) || !m.finishedAt) return null;
  const since = now.getTime() - m.finishedAt.getTime();
  return RATINGS_REFRESH_MIN.find((x) => since >= x * MIN && since < x * MIN + RATINGS_WINDOW_MS) ?? null;
}

export function phaseFor(m: MatchDoc, now: Date): Phase {
  const t = now.getTime();
  const k = m.kickoff.getTime();
  if (LIVE_STATUSES.has(m.status)) return "live";
  if (m.status === "NS") {
    if (t >= k - PREMATCH_LEAD_MS && t < k) return "prematch";
    if (t >= k && t < k + LATE_START_MS) return "live";
    return "idle";
  }
  if (FINAL_STATUSES.has(m.status) && m.finishedAt) {
    if (t - m.finishedAt.getTime() < POSTMATCH_TAIL_MS) return "postmatch";
    if (ratingsSlot(m, now) !== null) return "ratings";
  }
  return "idle";
}
