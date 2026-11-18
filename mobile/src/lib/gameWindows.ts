// Server source: functions/src/game/windows.ts (predictionOpen). Parity is checked with the server's own test
// vectors (functions/test/unit/windows.test.ts, describe "predictionOpen") in __tests__/lib/gameWindows.test.ts.
// The app check only drives the UI; the callable (functions/src/callables/submitPrediction.ts) decides.
// Task 18 extends this file (MVP window).
import type { Match } from '@/data/schemas';

/** Open while the match has not started (`NS`) and before the official kickoff. */
export function predictionOpen(m: Pick<Match, 'status' | 'kickoff'>, now: Date): boolean {
  return m.status === 'NS' && now.getTime() < m.kickoff.getTime();
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** "mm:ss" (minutes are not wrapped into hours); negative counts as 0. */
export function clockText(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/**
 * Error of a game callable (submitPrediction, voteMvp), mapped from the server's HttpsError codes in
 * services/game.ts. The screen turns `code` into a pt-PT message.
 */
export type GameActionCode = 'CLOSED' | 'NOT_OPEN' | 'ALREADY' | 'INVALID' | 'OFFLINE' | 'UNAUTHENTICATED' | 'UNKNOWN';

export class GameActionError extends Error {
  readonly code: GameActionCode;

  constructor(code: GameActionCode) {
    super(code);
    this.name = 'GameActionError';
    this.code = code;
  }
}
