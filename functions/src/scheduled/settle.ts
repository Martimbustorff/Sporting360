import { Firestore, FieldValue } from "firebase-admin/firestore";
import { listFinishedUnsettled, getGameState, getPlayerLines } from "../data/gamesRepo";
import { countedScore } from "../game/result";
import { POINTS, predictionBonus, mvpBonus } from "../game/scoring";
import { officialMvpIds } from "../game/mvp";
import { logger } from "firebase-functions";
import { awardPoints, type PointType } from "../points/ledger";

const DAY_MS = 24 * 60 * 60_000;

export interface SettleResult {
  predictions: number;
  votes: number;
  officialMvp: string[];
  settled: boolean;
}

const CHUNK = 100;
const CONCURRENCY = 10;

interface Candidate {
  uid: string;
  type: PointType;
  points: number;
  participationType: PointType;
  /** Tipo de bónus alternativo; se já existir, não se atribui este (feed corrigido entre execuções). */
  otherType?: PointType;
}

async function runLimited<T>(items: T[], limit: number, fn: (t: T) => Promise<unknown>): Promise<void> {
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/** Filtra por participação do servidor (getAll em lotes) e atribui com concorrência limitada. Devolve quantos passaram. */
async function awardCandidates(db: Firestore, gameId: string, gameDate: Date, cands: Candidate[]): Promise<number> {
  const approved: Candidate[] = [];
  for (let i = 0; i < cands.length; i += CHUNK) {
    const chunk = cands.slice(i, i + CHUNK);
    const refs = chunk.flatMap((c) => {
      const r = [db.doc(`pointEvents/${c.uid}_${gameId}_${c.participationType}`)];
      if (c.otherType) r.push(db.doc(`pointEvents/${c.uid}_${gameId}_${c.otherType}`));
      return r;
    });
    const snaps = await db.getAll(...refs);
    let k = 0;
    for (const c of chunk) {
      const hasPart = snaps[k++].exists;
      const hasOther = c.otherType ? snaps[k++].exists : false;
      if (hasPart && !hasOther) approved.push(c);
    }
  }
  await runLimited(approved, CONCURRENCY, (c) =>
    awardPoints(db, { uid: c.uid, gameId, gameDate, type: c.type, points: c.points }),
  );
  return approved.length;
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
  if (!game) {
    logger.warn(`settle: jogo ${gameId} não legível (getGameState devolveu null)`);
    return skipped;
  }
  const stale = game.finishedAt !== null && now.getTime() - game.finishedAt.getTime() > DAY_MS;
  const final = countedScore(game);
  if (!final) {
    if (stale) logger.warn(`settle: jogo ${gameId} sem resultado contado há mais de 24h`);
    return skipped;
  }

  const lines = await getPlayerLines(db, gameId);
  const official = officialMvpIds(lines);
  if (official.length === 0 && (game.finishedAt === null || now.getTime() - game.finishedAt.getTime() < DAY_MS)) {
    return skipped;
  }

  const preds = await db
    .collection("matchPredictions").where("gameId", "==", gameId).where("source", "==", "v2027").get();
  const predCands: Candidate[] = [];
  for (const d of preds.docs) {
    const p = d.data();
    const uid = String(p.userId ?? "");
    if (!uid || !Number.isInteger(p.home) || !Number.isInteger(p.away)) continue;
    const bonus = predictionBonus({ home: p.home, away: p.away }, final);
    if (bonus <= 0) continue;
    const exact = bonus === POINTS.exact;
    predCands.push({
      uid, points: bonus,
      type: exact ? "prediction_exact" : "prediction_outcome",
      otherType: exact ? "prediction_outcome" : "prediction_exact",
      participationType: "prediction_participation",
    });
  }
  const predictions = await awardCandidates(db, gameId, game.kickoff, predCands);

  const vs = await db
    .collection("mvpVotes").where("gameId", "==", gameId).where("source", "==", "v2027").get();
  const voteCands: Candidate[] = [];
  for (const d of vs.docs) {
    const v = d.data();
    const uid = String(v.userId ?? "");
    if (!uid || v.playerId === undefined || v.playerId === null) continue;
    const bonus = mvpBonus(String(v.playerId), official);
    if (bonus <= 0) continue;
    voteCands.push({ uid, points: bonus, type: "mvp_correct", participationType: "mvp_participation" });
  }
  const votes = await awardCandidates(db, gameId, game.kickoff, voteCands);

  // Só depois de todas as atribuições: um crash a meio deixa o jogo por liquidar (os awards são idempotentes).
  // Idempotente: mantém o settledAt da primeira liquidação (lido na mesma transação).
  const settleRef = db.doc(`settlements/${gameId}`);
  await db.runTransaction(async (tx) => {
    const prev = await tx.get(settleRef);
    const prevAt = prev.exists ? prev.data()?.settledAt : undefined;
    tx.set(settleRef, {
      settledAt: prevAt ?? FieldValue.serverTimestamp(),
      finalHome: final.home,
      finalAway: final.away,
      officialMvp: official,
    });
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
      logger.error(`settleDue: falha ao liquidar o jogo ${g.gameId}`, err);
    }
  }
  return n;
}
