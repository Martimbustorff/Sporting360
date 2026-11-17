import { deleteDoc, doc, setDoc, query, collection, getDocs } from "@firebase/firestore"
import { db } from "../firebase"
import { IStandings } from "../../interface/IStandings"
import * as logger from "firebase-functions/logger";

export class Standings {
  updateOrCreateStandings = async (Standings: IStandings) => {
    try {
      const document = doc(db, "standings", Standings.api)
      await setDoc(document, Standings)
      return true
    } catch (error) {
      logger.error(`Error upserting standings ${Standings.api}: `, error)
      return false
    }
  }
  deleteAllStandings = async () => {
    try {
      const q = query(collection(db, "standings"));
      const querySnapshot = await getDocs(q);
      const deletePromises = querySnapshot.docs.map(async (docSnapshot) => {
        const documentRef = doc(db, "standings", docSnapshot.id);
        await deleteDoc(documentRef);
      });
      await Promise.all(deletePromises);
      logger.info("Successfully deleted all standings");
      return true;
    } catch (error) {
      logger.error(`Error deleting standings: `, error);
      return false;
    }
  }
}
