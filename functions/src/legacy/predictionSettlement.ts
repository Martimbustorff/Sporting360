import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { FINAL_STATUSES } from "../model/status";
import { getMatch } from "../store/writer";

// Mesma janela da V2 (Games.getRecentGames): um filtro de intervalo em `timestamp`, sem índice composto.
const RECENT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/** Espera após o apito final: dá tempo ao refresh pós-jogo (finishedAt+25 min) de corrigir o resultado; um +3 errado nunca é revogado. */
export const LEGACY_SETTLE_DELAY_MS = 30 * 60_000;

interface LegacyGame {
  api: string;
  scorehome: string;
  scoreaway: string;
  predictionsSettled?: boolean;
}

interface LegacyPrediction {
  userId: string;
  userName: string;
  scorehome: number;
  scoreaway: number;
  season: string;
  source?: string;
}

/**
 * Porta da liquidação "resultado exato" (+3) dos palpites da V2 (`predictions`, `rankings`, `point_events`), que os
 * utilizadores V2 usam até ao cutover. Igual a legacy/v2-functions/.../predictionSettlement.ts, com uma diferença:
 * o jogo só conta como terminado se `matches/{api}.status` ∈ FINAL_STATUSES e `finishedAt + 30 min <= now` (a V2 usava
 * `isActive === false && endTime <= now`, o que liquidava adiados como 0-0).
 * Escreve só nas coleções sem prefixo: usar através de `settleLegacyPredictionsIfProduction`.
 */
export async function settleLegacyPredictions(db: Firestore, now: Date): Promise<{ games: number; predictions: number }> {
  const lower = new Date(now.getTime() - RECENT_WINDOW_MS);
  const snap = await db.collection("games").where("timestamp", ">=", Timestamp.fromDate(lower)).orderBy("timestamp").get();

  let games = 0;
  let predictions = 0;
  for (const doc of snap.docs) {
    const game = doc.data() as LegacyGame;
    if (game.predictionsSettled) continue;
    if (!game.api) continue;
    const match = await getMatch(db, String(game.api));
    if (!match) {
      logger.warn(`Legacy settlement: games/${doc.id} has no matches/${game.api} document.`);
      continue;
    }
    if (!FINAL_STATUSES.has(match.status)) continue;
    if (!match.finishedAt || match.finishedAt.getTime() + LEGACY_SETTLE_DELAY_MS > now.getTime()) continue;

    predictions += await settleGame(db, doc.ref, game);
    games += 1;
  }
  return { games, predictions };
}

/** Só corre em produção (`LEGACY_COLLECTION_PREFIX` vazio); em modo sombra devolve null sem escrever. */
export async function settleLegacyPredictionsIfProduction(
  db: Firestore,
  now: Date,
  prefix: string,
): Promise<{ games: number; predictions: number } | null> {
  if (prefix !== "") return null;
  return settleLegacyPredictions(db, now);
}

async function settleGame(db: Firestore, gameRef: FirebaseFirestore.DocumentReference, game: LegacyGame): Promise<number> {
  const snap = await db.collection("predictions").where("gameId", "==", game.api).where("scored", "==", false).get();
  let settled = 0;
  for (const predictionDoc of snap.docs) {
    const p = predictionDoc.data() as LegacyPrediction;
    if (p.source !== undefined) continue; // v2027: nunca tocar
    const correct = String(p.scorehome) === String(game.scorehome) && String(p.scoreaway) === String(game.scoreaway);

    // Uma transação por palpite: scored + ranking + point_event juntos. Um crash a meio não duplica nem perde pontos,
    // e o scored: false mantém o palpite elegível na execução seguinte.
    await db.runTransaction(async (tx) => {
      const eventRef = db.doc(`point_events/exact_score_${game.api}_${p.userId}`);
      const eventSnap = correct ? await tx.get(eventRef) : null;
      tx.set(predictionDoc.ref, { scored: true, correct }, { merge: true });
      if (correct && !eventSnap!.exists) {
        tx.set(
          db.doc(`rankings/${p.userId}_${p.season}`),
          { userId: p.userId, userName: p.userName, season: p.season, points: FieldValue.increment(3) },
          { merge: true },
        );
        tx.set(eventRef, {
          userId: p.userId,
          userName: p.userName,
          fixtureId: game.api,
          season: p.season,
          type: "exact_score",
          points: 3,
          awardedAt: FieldValue.serverTimestamp(),
        });
      }
    });
    settled += 1;
  }
  // Só depois de todos os palpites: se algum falhar, o jogo fica por liquidar e a próxima execução retoma.
  await gameRef.set({ predictionsSettled: true }, { merge: true });
  logger.info(`Settled ${settled} legacy prediction(s) for game ${game.api}.`);
  return settled;
}
