import { HttpsError } from "firebase-functions/v2/https";
import { mvpWindow } from "./windows";
import type { GameState } from "./types";

/** Número de shards de `mvpTallies/{gameId}/shards/{n}` (n em 0..NUM_SHARDS-1). */
export const NUM_SHARDS = 20;

/** O agregador ainda soma os shards durante este tempo depois de a janela do MVP fechar. */
export const TALLY_GRACE_AFTER_CLOSE_MS = 10 * 60_000;

export interface MvpTally {
  counts: Record<string, number>;
  total: number;
}

export function randomShard(): number {
  return Math.floor(Math.random() * NUM_SHARDS);
}

/** Soma os shards (campos em falta ou inválidos contam 0). */
export function sumShards(shards: ReadonlyArray<Record<string, unknown> | undefined>): MvpTally {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const s of shards) {
    if (!s) continue;
    if (typeof s.total === "number" && Number.isFinite(s.total)) total += s.total;
    const c = s.counts;
    if (c && typeof c === "object") {
      for (const [playerId, n] of Object.entries(c as Record<string, unknown>)) {
        if (typeof n === "number" && Number.isFinite(n)) counts[playerId] = (counts[playerId] ?? 0) + n;
      }
    }
  }
  return { counts, total };
}

export function sameTally(a: MvpTally, b: MvpTally): boolean {
  if (a.total !== b.total) return false;
  const ka = Object.keys(a.counts);
  if (ka.length !== Object.keys(b.counts).length) return false;
  return ka.every((k) => a.counts[k] === b.counts[k]);
}

/** Jogos a agregar: janela do MVP aberta, ou fechada há no máximo TALLY_GRACE_AFTER_CLOSE_MS. */
export function tallyActive(g: GameState, now: Date): boolean {
  const w = mvpWindow(g, now);
  if (w.state === "open") return true;
  if (w.state === "closed" && w.closesAt) return now.getTime() - w.closesAt.getTime() <= TALLY_GRACE_AFTER_CLOSE_MS;
  return false;
}

/** Contenção na transação (gRPC ABORTED, código 10) passa a `unavailable` para o cliente repetir; o resto fica igual. */
export function contentionToUnavailable(e: unknown): unknown {
  const code = (e as { code?: unknown } | null)?.code;
  if (code === 10 || code === "ABORTED" || code === "aborted") {
    return new HttpsError("unavailable", "TRY_AGAIN");
  }
  return e;
}
