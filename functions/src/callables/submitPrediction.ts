import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, type Firestore } from "firebase-admin/firestore";
import { getGameState } from "../data/gamesRepo";
import { predictionOpen } from "../game/windows";
import { awardPoints } from "../points/ledger";
import { POINTS } from "../game/scoring";

export function validGameId(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && !v.includes("/");
}

function validGoals(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 20;
}

export async function handleSubmitPrediction(
  db: Firestore,
  auth: { uid: string } | undefined,
  data: unknown,
  now: Date,
): Promise<{ ok: true }> {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Sessão necessária.");
  const d = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  if (!validGameId(d.gameId) || !validGoals(d.home) || !validGoals(d.away)) {
    throw new HttpsError("invalid-argument", "Dados inválidos.");
  }
  const { gameId, home, away } = d;

  const game = await getGameState(db, gameId, now);
  if (!game) throw new HttpsError("not-found", "Jogo não encontrado.");
  if (!predictionOpen(game, now)) throw new HttpsError("failed-precondition", "PREDICTION_CLOSED");

  // Mesmo id que a V2 usa; o doc v2027 não tem scored/scorehome/scoreaway para o legacy o ignorar.
  const ref = db.doc(`predictions/${gameId}_${auth.uid}`);
  await db.runTransaction(async (tx) => {
    if ((await tx.get(ref)).exists) throw new HttpsError("already-exists", "Já submeteste este prognóstico.");
    tx.create(ref, {
      gameId,
      userId: auth.uid,
      home,
      away,
      createdAt: FieldValue.serverTimestamp(),
      source: "v2027",
    });
  });

  await awardPoints(db, {
    uid: auth.uid,
    gameId,
    type: "prediction_participation",
    points: POINTS.participation,
    gameDate: game.kickoff,
  });
  return { ok: true };
}

export const submitPrediction = onCall({ region: "europe-west1" }, (req) =>
  handleSubmitPrediction(getFirestore(), req.auth, req.data, new Date()),
);
