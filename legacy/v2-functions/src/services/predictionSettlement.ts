import * as logger from "firebase-functions/logger";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "../database/firebaseAdmin";

// Same recent-past window as Games.getRecentGames(), so this reuses an
// already-cheap, index-free query shape (single range filter + orderBy on
// `timestamp`) instead of scanning the whole multi-season `games` history.
const RECENT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

interface SettledGame {
  api: string;
  scorehome: string;
  scoreaway: string;
  endTime?: string;
  isActive?: boolean;
  predictionsSettled?: boolean;
}

interface StoredPrediction {
  userId: string;
  userName: string;
  scorehome: number;
  scoreaway: number;
  season: string;
}

// Awards the PDF's +3 "exact final score" bonus once a match is over — the
// gap flagged in the app's predictions.ts (the `scored`/`correct` fields
// existed but nothing ever set them). Idempotent by design: a game is only
// processed once (`predictionsSettled`) and a prediction is only scored once
// (`scored`), so a retry after a partial failure just resumes instead of
// double-awarding points.
export const PredictionSettlementScript = async (): Promise<void> => {
  const now = Date.now();
  const lower = new Date(now - RECENT_WINDOW_MS);

  const gamesSnapshot = await adminDb
    .collection("games")
    .where("timestamp", ">=", Timestamp.fromDate(lower))
    .orderBy("timestamp")
    .get();

  const finishedUnsettledGames = gamesSnapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as SettledGame) }))
    .filter((game) => {
      if (game.isActive !== false) return false; // still upcoming or currently live
      if (game.predictionsSettled) return false;
      if (!game.endTime) return false;
      return new Date(game.endTime).getTime() <= now;
    });

  if (finishedUnsettledGames.length === 0) {
    logger.info("No finished games pending prediction settlement.");
    return;
  }

  for (const game of finishedUnsettledGames) {
    await settleGame(game);
  }
};

const settleGame = async (game: SettledGame & { id: string }): Promise<void> => {
  const predictionsSnapshot = await adminDb
    .collection("predictions")
    .where("gameId", "==", game.api)
    .where("scored", "==", false)
    .get();

  const batch = adminDb.batch();

  predictionsSnapshot.docs.forEach((predictionDoc) => {
    const prediction = predictionDoc.data() as StoredPrediction;
    const correct =
      String(prediction.scorehome) === String(game.scorehome) &&
      String(prediction.scoreaway) === String(game.scoreaway);

    batch.set(predictionDoc.ref, { scored: true, correct }, { merge: true });

    if (correct) {
      const rankingRef = adminDb.collection("rankings").doc(`${prediction.userId}_${prediction.season}`);
      batch.set(
        rankingRef,
        {
          userId: prediction.userId,
          userName: prediction.userName,
          season: prediction.season,
          points: FieldValue.increment(3),
        },
        { merge: true }
      );

      const eventRef = adminDb.collection("point_events").doc(`exact_score_${game.api}_${prediction.userId}`);
      batch.set(eventRef, {
        userId: prediction.userId,
        userName: prediction.userName,
        fixtureId: game.api,
        season: prediction.season,
        type: "exact_score",
        points: 3,
        awardedAt: FieldValue.serverTimestamp(),
      });
    }
  });

  batch.set(adminDb.collection("games").doc(game.id), { predictionsSettled: true }, { merge: true });

  await batch.commit();
  logger.info(`Settled ${predictionsSnapshot.size} prediction(s) for game ${game.api}.`);
};
