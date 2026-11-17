import { GameState } from "./types";

export const MVP_CLOSE_AFTER_MS = 20 * 60_000;
export const MVP_SETTLE_AFTER_MS = 2 * 60 * 60_000;

const MVP_OPEN_ELAPSED = 80;
const FINISHED: ReadonlyArray<GameState["status"]> = ["FT", "AET", "PEN"];

export function predictionOpen(g: GameState, now: Date): boolean {
  return g.status === "NS" && now.getTime() < g.kickoff.getTime();
}

export function mvpWindow(
  g: GameState,
  now: Date,
): { state: "before" | "open" | "closed"; closesAt: Date | null } {
  if (g.status === "LIVE") {
    if (g.elapsed !== null && g.elapsed >= MVP_OPEN_ELAPSED) {
      return { state: "open", closesAt: null };
    }
    return { state: "before", closesAt: null };
  }

  if (FINISHED.includes(g.status)) {
    if (g.finishedAt === null) {
      return { state: "before", closesAt: null };
    }
    const closesAt = new Date(g.finishedAt.getTime() + MVP_CLOSE_AFTER_MS);
    return now.getTime() < closesAt.getTime()
      ? { state: "open", closesAt }
      : { state: "closed", closesAt };
  }

  return { state: "before", closesAt: null };
}
