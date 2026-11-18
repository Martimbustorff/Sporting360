import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, type Firestore } from "firebase-admin/firestore";
import { getGameState, getPlayerLines } from "../data/gamesRepo";
import { mvpWindow } from "../game/windows";
import { mvpCandidates } from "../game/mvp";
import { awardPoints } from "../points/ledger";
import { POINTS } from "../game/scoring";
import { validGameId } from "./validation";

export async function handleVoteMvp(
  db: Firestore,
  auth: { uid: string } | undefined,
  data: unknown,
  now: Date,
): Promise<{ ok: true }> {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Sessão necessária.");
  const d = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  if (!validGameId(d.gameId) || typeof d.playerId !== "string" || d.playerId.length === 0) {
    throw new HttpsError("invalid-argument", "Dados inválidos.");
  }
  const { gameId, playerId } = d;

  const game = await getGameState(db, gameId, now);
  if (!game) throw new HttpsError("not-found", "Jogo não encontrado.");
  const win = mvpWindow(game, now);
  if (win.state === "before") throw new HttpsError("failed-precondition", "MVP_NOT_OPEN");
  if (win.state === "closed") throw new HttpsError("failed-precondition", "MVP_CLOSED");

  const candidates = mvpCandidates(await getPlayerLines(db, gameId));
  if (!candidates.some((c) => c.playerId === playerId)) {
    throw new HttpsError("invalid-argument", "Jogador inválido.");
  }

  const ref = db.doc(`mvpVotes/${gameId}_${auth.uid}`);
  const found: { data: Record<string, unknown> | null } = { data: null };
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      found.data = snap.data() ?? {};
      return;
    }
    tx.create(ref, {
      gameId,
      userId: auth.uid,
      playerId,
      createdAt: FieldValue.serverTimestamp(),
      source: "v2027",
    });
  });

  const existing = found.data;
  if (existing) {
    // Recupera o ponto se um doc v2027 do próprio utilizador ficou sem pontos (falha entre create e award).
    // awardPoints é idempotente.
    if (existing.source === "v2027" && existing.userId === auth.uid) {
      await awardPoints(db, {
        uid: auth.uid,
        gameId,
        type: "mvp_participation",
        points: POINTS.participation,
        gameDate: game.kickoff,
      });
    }
    throw new HttpsError("already-exists", "Já votaste neste jogo.");
  }

  await awardPoints(db, {
    uid: auth.uid,
    gameId,
    type: "mvp_participation",
    points: POINTS.participation,
    gameDate: game.kickoff,
  });
  return { ok: true };
}

export const voteMvp = onCall({ region: "europe-west1" }, (req) =>
  handleVoteMvp(getFirestore(), req.auth, req.data, new Date()),
);
