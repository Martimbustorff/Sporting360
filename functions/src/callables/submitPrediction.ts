import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, type Firestore } from "firebase-admin/firestore";
import { getGameState } from "../data/gamesRepo";
import { predictionOpen } from "../game/windows";
import { awardPoints } from "../points/ledger";
import { POINTS } from "../game/scoring";
import { validGameId } from "./validation";
import { contentionToUnavailable } from "../game/mvpTally";
import { outcomeOf, SPLIT_DOC, TALLY_COLLECTION } from "../game/fansPrediction";

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

  // Coleção própria da v2027: não colide com os docs `predictions` da V2.
  const ref = db.doc(`matchPredictions/${gameId}_${auth.uid}`);
  const tallyRef = db.doc(`${TALLY_COLLECTION}/${gameId}`);
  const splitRef = db.doc(`${TALLY_COLLECTION}/${gameId}/${SPLIT_DOC}`);
  const found: { data: Record<string, unknown> | null } = { data: null };
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) {
        found.data = snap.data() ?? {};
        return;
      }
      tx.create(ref, {
        gameId,
        userId: auth.uid,
        home,
        away,
        createdAt: FieldValue.serverTimestamp(),
        source: "v2027",
      });
      // Previsão dos sportinguistas: contagem anónima na mesma transação (incrementos cegos, não lidos).
      // O total é público; o lado escolhido fica no documento privado até ao apito (fansPredictionPublisher).
      tx.set(tallyRef, { gameId, total: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.set(splitRef, { [outcomeOf(home, away)]: FieldValue.increment(1) }, { merge: true });
    });
  } catch (e) {
    throw contentionToUnavailable(e);
  }

  const existing = found.data;
  if (existing) {
    // Recupera o ponto se um doc v2027 do próprio utilizador ficou sem pontos (falha entre create e award).
    // awardPoints é idempotente.
    if (existing.source === "v2027" && existing.userId === auth.uid) {
      await awardPoints(db, {
        uid: auth.uid,
        gameId,
        type: "prediction_participation",
        points: POINTS.participation,
        gameDate: game.kickoff,
      });
    }
    throw new HttpsError("already-exists", "Já submeteste este prognóstico.");
  }

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
