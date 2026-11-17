import { IGame } from "../interface/IGames"
import { Games } from "../database/models/games"

// How far either side of a match the scheduled refreshes still care about a game.
// Wide enough that the daily 9am jobs (summary / players / lineups) still pick up
// today's evening games and yesterday's just-finished games, but narrow enough that
// we stop re-fetching the entire season's history on every run.
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// True when a game kicked off (or will kick off) within the recent window, i.e. it is
// today/just-finished/about-to-start and its data may still need refreshing.
export const isRecentGame = (game: IGame): boolean => {
  const now = Date.now();
  const start = new Date(game.startTime).getTime();
  const end = new Date(game.endTime).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) {
    // Can't place this game in time (missing/garbled dates) — skip it rather than
    // risk re-fetching an undateable old fixture.
    return false;
  }
  return end >= now - RECENT_WINDOW_MS && start <= now + RECENT_WINDOW_MS;
};

// Resolve the set of games a live-data script should process.
// - explicit list passed in  -> use it as-is (e.g. a single targeted match)
// - otherwise                -> only games near "now" (date-bounded Firestore query),
//                               then trimmed to the precise recent window. This avoids
//                               reading the entire (now multi-season) games collection
//                               on every scheduled run.
export const resolveLiveGames = async (games?: IGame[]): Promise<IGame[]> => {
  if (games) {
    return games;
  }
  const recent = await new Games().getRecentGames();
  // Active games are already refreshed every minute by liveMatchUpdater (via TodayGame's
  // explicit-list path above); skip them here so the periodic/daily schedulers don't
  // duplicate that work. Once a game finishes, isActive flips false and it's picked up
  // normally for the post-match refresh.
  return recent.filter((game) => isRecentGame(game) && !game.isActive);
};
