import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { listFootballStates } from "../data/gamesRepo";
import { sameTally, sumShards, tallyActive, type MvpTally } from "../game/mvpTally";

/** Kickoff mais antigo considerado: jogo com prolongamento, penáltis e atrasos, mais a margem depois de fechar. */
export const TALLY_KICKOFF_LOOKBACK_MS = 6 * 60 * 60_000;

/**
 * Soma `mvpTallies/{gameId}/shards/*` em `mvpTallies/{gameId}` = {gameId, counts, total, updatedAt}.
 * Único escritor do documento pai. Só jogos com a janela do MVP aberta ou fechada há até 10 min;
 * escreve apenas quando a soma muda (cada escrita acorda todos os listeners da app).
 */
export async function aggregateMvpTallies(db: Firestore, now: Date): Promise<{ count: number }> {
  const games = (await listFootballStates(db, new Date(now.getTime() - TALLY_KICKOFF_LOOKBACK_MS), now)).filter((g) =>
    tallyActive(g, now),
  );
  let written = 0;
  for (const g of games) {
    const parentRef = db.doc(`mvpTallies/${g.gameId}`);
    const [shards, parent] = await Promise.all([parentRef.collection("shards").get(), parentRef.get()]);
    if (shards.empty) continue;
    const sum = sumShards(shards.docs.map((d) => d.data()));
    if (parent.exists) {
      const prev: MvpTally = { counts: (parent.get("counts") ?? {}) as Record<string, number>, total: parent.get("total") ?? 0 };
      if (sameTally(prev, sum)) continue;
    }
    await parentRef.set({ gameId: g.gameId, counts: sum.counts, total: sum.total, updatedAt: FieldValue.serverTimestamp() });
    written++;
  }
  return { count: written };
}
