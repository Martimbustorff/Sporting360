import { Firestore, FieldValue } from "firebase-admin/firestore";
import { listFinishedUnsettled, getGameState, getPlayerLines } from "../data/gamesRepo";
import { countedScore } from "../game/result";
import { POINTS, predictionBonus, mvpBonus } from "../game/scoring";
import { officialMvpIds } from "../game/mvp";
import { awardPoints } from "../points/ledger";

const DAY_MS = 24 * 60 * 60_000;

export interface SettleResult {
  predictions: number;
  votes: number;
  officialMvp: string[];
  settled: boolean;
}

async function hasParticipation(db: Firestore, uid: string, gameId: string, type: string): Promise<boolean> {
  return (await db.doc(`pointEvents/${uid}_${gameId}_${type}`).get()).exists;
}

/**
 * Liquida um jogo terminado. Só considera documentos v2027 com participação escrita pelo servidor.
 * `settled` é false quando o jogo é saltado (sem resultado, ou MVP à espera de ratings).
 */
export async function settleGame(
  db: Firestore,
  gameId: string,
  now: Date = new Date(),
): Promise<SettleResult> {
  const skipped: SettleResult = { predictions: 0, votes: 0, officialMvp: [], settled: false };
  const game = await getGameState(db, gameId, now);
  if (!game) return skipped;
  const final = countedScore(game);
  if (!final) return skipped;

  const lines = await getPlayerLines(db, gameId);
  const official = officialMvpIds(lines);
  if (official.length === 0 && (game.finishedAt === null || now.getTime() - game.finishedAt.getTime() < DAY_MS)) {
    return skipped;
  }

  let predictions = 0;
  const preds = await db
    .collection("predictions").where("gameId", "==", gameId).where("source", "==", "v2027").get();
  for (const d of preds.docs) {
    const p = d.data();
    const uid = String(p.userId ?? "");
    if (!uid || !Number.isInteger(p.home) || !Number.isInteger(p.away)) continue;
    if (!(await hasParticipation(db, uid, gameId, "prediction_participation"))) continue;
    const bonus = predictionBonus({ home: p.home, away: p.away }, final);
    if (bonus <= 0) continue;
    await awardPoints(db, {
      uid, gameId, gameDate: game.kickoff, points: bonus,
      type: bonus === POINTS.exact ? "prediction_exact" : "prediction_outcome",
    });
    predictions++;
  }

  let votes = 0;
  const vs = await db
    .collection("mvpVotes").where("gameId", "==", gameId).where("source", "==", "v2027").get();
  for (const d of vs.docs) {
    const v = d.data();
    const uid = String(v.userId ?? "");
    if (!uid || v.playerId === undefined || v.playerId === null) continue;
    if (!(await hasParticipation(db, uid, gameId, "mvp_participation"))) continue;
    const bonus = mvpBonus(String(v.playerId), official);
    if (bonus <= 0) continue;
    await awardPoints(db, { uid, gameId, gameDate: game.kickoff, points: bonus, type: "mvp_correct" });
    votes++;
  }

  // Só depois de todas as atribuições: um crash a meio deixa o jogo por liquidar (os awards são idempotentes).
  await db.doc(`settlements/${gameId}`).set({
    settledAt: FieldValue.serverTimestamp(),
    finalHome: final.home,
    finalAway: final.away,
    officialMvp: official,
  });
  return { predictions, votes, officialMvp: official, settled: true };
}

/** Liquida sequencialmente os jogos devidos. Devolve quantos foram liquidados. */
export async function settleDue(db: Firestore, now: Date): Promise<number> {
  const games = await listFinishedUnsettled(db, now);
  let n = 0;
  for (const g of games) {
    try {
      const r = await settleGame(db, g.gameId, now);
      if (r.settled) n++;
    } catch (err) {
      console.error(`settleDue: falha ao liquidar o jogo ${g.gameId}`, err);
    }
  }
  return n;
}
