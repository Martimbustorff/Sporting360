import { deleteDoc, doc, setDoc, query, where, collection, getDocs } from "@firebase/firestore"
import { db } from "../firebase"
import { ISummary } from "../../interface/ISummary"
import * as logger from "firebase-functions/logger";

export class Summary {
  updateOrCreateSummary = async (summary: ISummary) => {
    try {
      const document = doc(db, "summaries", summary.api)
      await setDoc(document, summary)
      return true
    } catch (error) {
      logger.error(`Error upserting summary ${summary.api}: `, error)
      return false
    }
  }

  getSubstSummary = async (featureId: string): Promise<ISummary[]> => {
    try {
      const q = query(collection(db, "summaries"), where("GameId", "==", featureId), where("type", "==", "subst"));
      const SummarySnapshot = await getDocs(q);
      const Summaries = SummarySnapshot.docs.map(doc => doc.data()) as ISummary[];
      return Summaries
    } catch (error) {
      logger.error(`Error getting subst summaries for game ${featureId}: `, error)
      return []
    }
  }

  // Delete summaries for a game whose id is NOT in `keepIds`. This lets the caller
  // upsert the fresh events first and then prune only the stale ones, so there is no
  // window where the game has no summary documents at all.
  pruneStaleSummaries = async (gameId: string, keepIds: Set<string>) => {
    try {
      const q = query(collection(db, "summaries"), where("GameId", "==", gameId));
      const querySnapshot = await getDocs(q);
      const stale = querySnapshot.docs.filter(docSnapshot => !keepIds.has(docSnapshot.id));
      if (stale.length === 0) {
        return true;
      }
      await Promise.all(stale.map(docSnapshot => deleteDoc(doc(db, "summaries", docSnapshot.id))));
      logger.info(`Pruned ${stale.length} stale summaries for game ${gameId}`);
      return true;
    } catch (error) {
      logger.error(`Error pruning summaries for game ${gameId}: `, error);
      return false;
    }
  }
}
