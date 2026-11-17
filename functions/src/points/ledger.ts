import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { periodKeys } from "../time/periods";
import { publicName } from "../data/profiles";

export type PointType =
  | "prediction_participation"
  | "prediction_exact"
  | "prediction_outcome"
  | "mvp_participation"
  | "mvp_correct";

type Kind = "week" | "month" | "season";
const ALL_KINDS: Kind[] = ["week", "month", "season"];

export interface AwardInput {
  uid: string;
  gameId: string | null;
  type: PointType;
  points: number;
  gameDate: Date;
  periods?: Kind[];
}

/**
 * Atribui pontos de forma idempotente (id determinístico). Os pontos contam na data do jogo.
 * Devolve true se atribuiu agora, false se o evento já existia.
 */
export async function awardPoints(db: Firestore, e: AwardInput): Promise<boolean> {
  if (!Number.isInteger(e.points) || e.points <= 0) {
    throw new Error(`awardPoints: points tem de ser um inteiro > 0 (recebido ${e.points})`);
  }
  const id = `${e.uid}_${e.gameId ?? "none"}_${e.type}`;
  const keys = periodKeys(e.gameDate);
  const kinds = [...new Set(e.periods ?? ALL_KINDS)];
  const used: Partial<Record<Kind, string>> = {};
  for (const k of kinds) used[k] = keys[k];

  const eventRef = db.doc(`pointEvents/${id}`);
  const userRef = db.doc(`users/${e.uid}`);

  return db.runTransaction(async (tx) => {
    // Leituras antes das escritas.
    const [eventSnap, userSnap] = await Promise.all([tx.get(eventRef), tx.get(userRef)]);
    if (eventSnap.exists) return false;

    const displayName = publicName(userSnap.exists ? (userSnap.data() ?? {}) : {}, e.uid);

    tx.create(eventRef, {
      uid: e.uid,
      gameId: e.gameId,
      type: e.type,
      points: e.points,
      gameDate: Timestamp.fromDate(e.gameDate),
      periods: used,
      createdAt: FieldValue.serverTimestamp(),
    });

    for (const k of kinds) {
      const boardRef = db.doc(`leaderboards/${k}_${keys[k]}`);
      tx.set(
        boardRef.collection("entries").doc(e.uid),
        {
          uid: e.uid,
          displayName,
          points: FieldValue.increment(e.points),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
    return true;
  });
}
