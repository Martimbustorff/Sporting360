/*
 * Notas sobre os campos reais em produção (verificados via REST, só leitura).
 *
 * games/{docId}:
 *   api (string, id do fixture API-Football = o nosso gameId), startTime e endTime (string ISO),
 *   timestamp (Timestamp; aceitamos também número em segundos ou ms), elapsedTime (string),
 *   isActive (bool), scorehome/scoreaway (string, podem vir vazias), teamhome/teamaway {api, name, logo},
 *   competition, journey, season.
 *   NÃO existem hoje: status, finishedAt. O Plano 2 acrescenta-os; até lá derivamos:
 *     - `status` opcional (código curto API-Football) e `finishedAt` opcional (ISO ou Timestamp) são lidos se existirem;
 *     - sem status: isActive -> LIVE (elapsed = parseInt(elapsedTime)); inativo e now < kickoff -> NS;
 *       inativo, now >= kickoff e elapsed >= 90 -> FT com finishedAt = endTime; caso contrário NS.
 *   kickoff = timestamp, senão startTime. Sporting = teamhome.api == 228 (comparado como string).
 *
 * players/{teamId}_{GameId}:
 *   GameId (string), teamId (int; Sporting = 228),
 *   Players[] { playerId, name, rating (string, pode ser vazia), minutes (int, pode faltar), substitute, ... }.
 *
 * Notas do legacy: endTime é uma estimativa fixa (kickoff+150min) e isActive = startTime<=now<=endTime,
 * logo o FT derivado só aparece depois de kickoff+150min (liquidação ~kickoff+4,5h, conservador).
 * Jogos fora da janela de 7 dias nunca são re-tentados.
 *
 * settlements/{gameId}: tem `settledAt` quando o jogo já foi liquidado.
 */
import { Firestore, Timestamp, DocumentData } from "firebase-admin/firestore";
import { GameState, GameStatus } from "../game/types";
import { PlayerLine } from "../game/mvp";
import { MVP_SETTLE_AFTER_MS } from "../game/windows";

const SPORTING_TEAM_ID = "228";
const DAY_MS = 24 * 60 * 60_000;
const SETTLE_LOOKBACK_MS = 7 * DAY_MS;

const STATUS_MAP: Record<string, GameStatus> = {
  NS: "NS", TBD: "NS",
  "1H": "LIVE", "2H": "LIVE", ET: "LIVE", BT: "LIVE", P: "LIVE", LIVE: "LIVE", INT: "LIVE",
  HT: "HT", FT: "FT", AET: "AET", PEN: "PEN",
  PST: "PST", SUSP: "PST",
  CANC: "CANC", ABD: "CANC", AWD: "CANC", WO: "CANC",
};

function toDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    return new Date(v < 1e11 ? v * 1000 : v); // segundos vs milissegundos
  }
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function toInt(v: unknown): number | null {
  const n = typeof v === "number" ? Math.trunc(v) : parseInt(String(v ?? ""), 10);
  return Number.isNaN(n) ? null : n;
}

function toFloat(v: unknown): number | null {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isNaN(n) ? null : n;
}

function mapGame(data: DocumentData, now: Date): GameState | null {
  const gameId = data.api === undefined || data.api === null ? "" : String(data.api);
  const kickoff = toDate(data.timestamp) ?? toDate(data.startTime);
  if (!gameId || !kickoff) return null;

  const elapsedParsed = toInt(data.elapsedTime);
  let status: GameStatus;
  let elapsed: number | null = elapsedParsed;
  let finishedAt: Date | null = toDate(data.finishedAt);

  const explicit = typeof data.status === "string" ? STATUS_MAP[data.status.trim().toUpperCase()] : undefined;
  if (explicit) {
    status = explicit;
    if ((status === "FT" || status === "AET" || status === "PEN") && finishedAt === null) {
      finishedAt = toDate(data.endTime);
    }
  } else if (data.isActive === true) {
    status = "LIVE";
  } else if (now.getTime() < kickoff.getTime()) {
    status = "NS";
  } else if (elapsedParsed !== null && elapsedParsed >= 90) {
    status = "FT";
    finishedAt = finishedAt ?? toDate(data.endTime);
  } else {
    status = "NS";
  }

  return {
    gameId,
    kickoff,
    status,
    elapsed,
    goalsHome: toInt(data.scorehome),
    goalsAway: toInt(data.scoreaway),
    finishedAt,
    sportingSide: String(data.teamhome?.api ?? "") === SPORTING_TEAM_ID ? "home" : "away",
  };
}

/**
 * Estado do jogo. `gameId` é o id API-Football (campo `api` em games).
 * `now` é injetável para testes (por omissão, a hora atual).
 */
export async function getGameState(
  db: Firestore,
  gameId: string,
  now: Date = new Date(),
): Promise<GameState | null> {
  const snap = await db.collection("games").where("api", "==", gameId).limit(1).get();
  if (snap.empty) return null;
  return mapGame(snap.docs[0].data(), now);
}

export async function getPlayerLines(db: Firestore, gameId: string): Promise<PlayerLine[]> {
  const snap = await db.collection("players").where("GameId", "==", gameId).get();
  const lines: PlayerLine[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    const teamIsSporting = String(data.teamId ?? "") === SPORTING_TEAM_ID;
    const players: DocumentData[] = Array.isArray(data.Players) ? data.Players : [];
    for (const p of players) {
      lines.push({
        playerId: String(p.playerId),
        name: String(p.name ?? ""),
        teamIsSporting,
        minutes: toInt(p.minutes),
        rating: toFloat(p.rating),
      });
    }
  }
  return lines;
}

/**
 * Jogos FT/AET/PEN terminados há pelo menos MVP_SETTLE_AFTER_MS e ainda sem `settledAt`.
 * Firestore não filtra por estado derivado: consulta uma janela por kickoff (últimos 7 dias até now-2h)
 * e filtra em memória. Em produção `timestamp` é sempre Timestamp (a conversão defensiva de números fica só em toDate).
 */
export async function listFinishedUnsettled(db: Firestore, now: Date): Promise<GameState[]> {
  const to = now.getTime() - MVP_SETTLE_AFTER_MS;
  const from = now.getTime() - SETTLE_LOOKBACK_MS;
  const games = db.collection("games");

  const snaps = [
    await games
      .where("timestamp", ">=", Timestamp.fromMillis(from))
      .where("timestamp", "<=", Timestamp.fromMillis(to))
      .get(),
  ];

  const byId = new Map<string, GameState>();
  for (const s of snaps) {
    for (const d of s.docs) {
      const g = mapGame(d.data(), now);
      if (!g) continue;
      if (g.status !== "FT" && g.status !== "AET" && g.status !== "PEN") continue;
      if (g.finishedAt === null || g.finishedAt.getTime() > to) continue;
      byId.set(g.gameId, g);
    }
  }

  const candidates = [...byId.values()];
  const settled = await Promise.all(
    candidates.map(async (g) => {
      const s = await db.collection("settlements").doc(g.gameId).get();
      return s.exists && s.get("settledAt") != null;
    }),
  );
  return candidates.filter((_, i) => !settled[i]);
}
