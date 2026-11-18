// Server source: functions/src/game/windows.ts (predictionOpen, mvpWindow, MVP_CLOSE_AFTER_MS, MVP_OPEN_ELAPSED) and
// functions/src/game/mvp.ts (mvpCandidates). Parity is checked with the server's own test vectors
// (functions/test/unit/windows.test.ts, describes "predictionOpen" and "mvpWindow"; functions/test/unit/mvp.test.ts,
// describe "mvpCandidates") in __tests__/lib/gameWindows.test.ts.
// The app check only drives the UI; the callables (functions/src/callables/submitPrediction.ts, voteMvp.ts) decide.
import type { Match, PlayersDoc } from '@/data/schemas';

/** Open while the match has not started (`NS`) and before the official kickoff. */
export function predictionOpen(m: Pick<Match, 'status' | 'kickoff'>, now: Date): boolean {
  return m.status === 'NS' && now.getTime() < m.kickoff.getTime();
}

/** The MVP vote closes 20 minutes after the final whistle (`finishedAt`). */
export const MVP_CLOSE_AFTER_MS = 20 * 60_000;
/** The MVP vote opens at minute 80 of the live clock. */
export const MVP_OPEN_ELAPSED = 80;
const FINISHED: ReadonlyArray<Match['status']> = ['FT', 'AET', 'PEN'];

export type MvpWindow = { state: 'before' | 'open' | 'closed'; closesAt: Date | null };

/**
 * LIVE from minute 80: open with no close time yet. FT/AET/PEN: open until `finishedAt` + 20 min, then closed;
 * before `finishedAt` is known it counts as `before`. Everything else (NS, HT, PST, CANC) is `before`.
 */
export function mvpWindow(m: Pick<Match, 'status' | 'elapsed' | 'finishedAt'>, now: Date): MvpWindow {
  if (m.status === 'LIVE') {
    return m.elapsed !== null && m.elapsed >= MVP_OPEN_ELAPSED
      ? { state: 'open', closesAt: null }
      : { state: 'before', closesAt: null };
  }
  if (FINISHED.includes(m.status)) {
    if (m.finishedAt === null) return { state: 'before', closesAt: null };
    const closesAt = new Date(m.finishedAt.getTime() + MVP_CLOSE_AFTER_MS);
    return now.getTime() < closesAt.getTime() ? { state: 'open', closesAt } : { state: 'closed', closesAt };
  }
  return { state: 'before', closesAt: null };
}

export type MvpCandidate = { playerId: string; name: string; number: number | null };

/** Sporting players who played (minutes > 0), sorted by name (`localeCompare(…, 'pt')`), as the server does. */
export function mvpCandidates(doc: PlayersDoc | null, sportingTeamId = '228'): MvpCandidate[] {
  if (!doc) return [];
  return doc.teams
    .filter((t) => String(t.teamId) === sportingTeamId)
    .flatMap((t) => t.players)
    .filter((p) => p.minutes !== null && p.minutes > 0)
    .map((p) => ({ playerId: String(p.playerId), name: p.name, number: p.number }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
}

export type Stage = 'table' | 'knockout';

/**
 * Tabela (campeonato, fase de liga, grupos), eliminatória, ou `null` se a ronda não se reconhece.
 * Cópia de `stageOf` em functions/src/football/bracket.ts (paridade em __tests__/lib/serverParity.test.ts).
 */
export function stageOf(rawRound: string | null): Stage | null {
  if (rawRound === null) return null;
  const t = rawRound.trim();
  if (/^(?:regular season|league stage|group stage|group [a-z0-9]+)\s*-\s*\d+$/i.test(t)) return 'table';
  if (
    /^round of \d+$/i.test(t) ||
    /^\d+(?:st|nd|rd|th)\s+round$/i.test(t) ||
    /^(?:knockout round )?play-?offs?$/i.test(t) ||
    /^(?:quarter|semi)[- ]?finals?$/i.test(t) ||
    /^final$/i.test(t) ||
    /^\d+(?:st|nd|rd|th)\s+finals?$/i.test(t) ||
    /^1\/\d+[\s-]*finals?$/i.test(t) ||
    /^(?:(?:\d+(?:st|nd|rd|th)\s+)?qualifying|preliminary) round$/i.test(t)
  ) {
    return 'knockout';
  }
  return null;
}

/**
 * Jogo a eliminar: taça e supertaça sempre; competição europeia quando a ronda é de eliminatória (play-off,
 * pré-eliminatórias, oitavos, ...). O servidor conta o resultado com prolongamento e os penáltis como empate em
 * qualquer jogo (functions/src/game/result.ts); a nota da tab Prognóstico aparece nestes, onde pode acontecer.
 */
export function isKnockoutGame(c: Pick<Match['competition'], 'type' | 'round'>): boolean {
  if (c.type === 'cup' || c.type === 'supercup') return true;
  return c.type === 'europe' && stageOf(c.round) === 'knockout';
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
