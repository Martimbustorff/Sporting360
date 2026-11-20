import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { listFootballStates } from "../data/gamesRepo";
import { revealed, splitFor, SPLIT_DOC, TALLY_COLLECTION } from "../game/fansPrediction";
import { TALLY_KICKOFF_LOOKBACK_MS } from "./mvpTallyAggregator";

/**
 * Ao apito inicial copia a contagem privada (casa/empate/fora) para `predictionTallies/{gameId}` como
 * vitória/empate/derrota do Sporting. Os palpites fecham no kickoff, por isso escreve uma só vez por jogo.
 * Só jogos com kickoff nas últimas 6 h e que começaram de facto (adiado ou cancelado nunca revela).
 */
export async function publishFansPredictions(db: Firestore, now: Date): Promise<{ count: number }> {
  const games = (await listFootballStates(db, new Date(now.getTime() - TALLY_KICKOFF_LOOKBACK_MS), now)).filter(revealed);
  let written = 0;
  for (const g of games) {
    const ref = db.doc(`${TALLY_COLLECTION}/${g.gameId}`);
    const pub = await ref.get();
    if (!pub.exists || pub.get("win") !== undefined) continue;
    const raw = (await db.doc(`${TALLY_COLLECTION}/${g.gameId}/${SPLIT_DOC}`).get()).data() ?? {};
    await ref.set({ ...splitFor(g.sportingSide, raw), revealedAt: FieldValue.serverTimestamp() }, { merge: true });
    written++;
  }
  return { count: written };
}
