/*
 * Adaptador do motor de pontos sobre o modelo novo.
 *
 * matches/{id} (ver src/model/types.ts): sport, status (GameStatus real da API), elapsed, score {home, away},
 *   finishedAt (observado ou estimado), kickoff, sportingSide. O id do documento e o gameId do motor.
 *   Só jogos de futebol (`sport == "football"`) entram no motor; os restantes desportos devolvem null.
 *   O fallback antigo por isActive/endTime acabou: o estado vem diretamente de `matches`.
 *
 * matches/{id}/details/players: { teams: [{ teamId, players: PlayerStatLine[] }] }.
 *   Sporting = teamId "228".
 *
 * settlements/{gameId}: tem `settledAt` quando o jogo já foi liquidado.
 * Jogos fora da janela de 7 dias nunca são re-tentados.
 */
import { Firestore, Timestamp } from "firebase-admin/firestore";
import { GameState } from "../game/types";
import { PlayerLine } from "../game/mvp";
import { MVP_SETTLE_AFTER_MS } from "../game/windows";
import type { MatchDoc } from "../model/types";
import { fromFirestore, getMatch } from "../store/writer";

const SPORTING_TEAM_ID = "228";
const DAY_MS = 24 * 60 * 60_000;
const SETTLE_LOOKBACK_MS = 7 * DAY_MS;
const FINAL_STATUSES: ReadonlyArray<GameState["status"]> = ["FT", "AET", "PEN"];

function toDate(v: unknown): Date | null {
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  return null;
}

function toState(m: MatchDoc): GameState {
  return {
    gameId: m.id,
    kickoff: m.kickoff,
    status: m.status,
    elapsed: m.elapsed,
    goalsHome: m.score.home,
    goalsAway: m.score.away,
    finishedAt: m.finishedAt,
    sportingSide: m.sportingSide,
  };
}

/** Estado do jogo (`matches/{gameId}`); null se não existe ou não é futebol. `now` mantido por compatibilidade. */
export async function getGameState(
  db: Firestore,
  gameId: string,
  _now: Date = new Date(),
): Promise<GameState | null> {
  const m = await getMatch(db, gameId);
  if (!m || m.sport !== "football") return null;
  return toState(m);
}

export async function getPlayerLines(db: Firestore, gameId: string): Promise<PlayerLine[]> {
  const snap = await db.doc(`matches/${gameId}/details/players`).get();
  const teams = (snap.get("teams") ?? []) as { teamId: string; players?: { playerId: string; name?: string; minutes?: number | null; rating?: number | null }[] }[];
  const lines: PlayerLine[] = [];
  for (const t of teams) {
    const teamIsSporting = String(t.teamId ?? "") === SPORTING_TEAM_ID;
    for (const p of t.players ?? []) {
      lines.push({
        playerId: String(p.playerId),
        name: String(p.name ?? ""),
        teamIsSporting,
        minutes: p.minutes ?? null,
        rating: p.rating ?? null,
      });
    }
  }
  return lines;
}

/**
 * Jogos de futebol FT/AET/PEN com finishedAt entre now-7d e now-MVP_SETTLE_AFTER_MS e ainda sem `settledAt`.
 * Usa o índice (sport, finishedAt).
 */
export async function listFinishedUnsettled(db: Firestore, now: Date): Promise<GameState[]> {
  const to = now.getTime() - MVP_SETTLE_AFTER_MS;
  const from = now.getTime() - SETTLE_LOOKBACK_MS;
  const snap = await db
    .collection("matches")
    .where("sport", "==", "football")
    .where("finishedAt", ">=", Timestamp.fromMillis(from))
    .where("finishedAt", "<=", Timestamp.fromMillis(to))
    .get();

  const candidates: GameState[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    const finishedAt = toDate(data.finishedAt);
    if (!finishedAt) continue;
    const m = { ...(data as MatchDoc), id: d.id, kickoff: toDate(data.kickoff) ?? new Date(NaN), finishedAt } as MatchDoc;
    if (!FINAL_STATUSES.includes(m.status)) continue;
    candidates.push(toState(m));
  }

  const settled = await Promise.all(
    candidates.map(async (g) => {
      const s = await db.collection("settlements").doc(g.gameId).get();
      return s.exists && s.get("settledAt") != null;
    }),
  );
  return candidates.filter((_, i) => !settled[i]);
}

/** Jogos de futebol com kickoff em [from, to], como GameState. Usa o índice (sport, kickoff). */
export async function listFootballStates(db: Firestore, from: Date, to: Date): Promise<GameState[]> {
  const snap = await db
    .collection("matches")
    .where("sport", "==", "football")
    .where("kickoff", ">=", Timestamp.fromDate(from))
    .where("kickoff", "<=", Timestamp.fromDate(to))
    .get();
  return snap.docs.map((d) => toState({ ...fromFirestore(d.data() as MatchDoc), id: d.id }));
}
