import { collection, doc, getDocs, setDoc, query, where } from "@firebase/firestore"
import { db } from "../firebase"
import { ILineups } from "../../interface/ILineups";
import * as logger from "firebase-functions/logger";

export class Lineups {
  getLineups = async (): Promise<ILineups[]> => {
    try {
      const LineupsCollection = collection(db, "lineups");
      const LineupsSnapshot = await getDocs(LineupsCollection);
      const Lineups = LineupsSnapshot.docs.map(doc => doc.data()) as ILineups[];
      return Lineups
    } catch (error) {
      logger.error(`Error getting lineups: `, error)
      return []
    }
  }
  getLineUp = async (featureId: string): Promise<ILineups[]> => {
    try {
      const q = query(collection(db, "lineups"), where("GameId", "==", featureId));
      const LineupsSnapshot = await getDocs(q);
      const Lineups = LineupsSnapshot.docs.map(doc => doc.data()) as ILineups[];
      return Lineups
    } catch (error) {
      logger.error(`Error getting lineup for game ${featureId}: `, error)
      return []
    }
  }
  updateOrCreateLineups = async (lineups: ILineups) => {
    try {
      const document = doc(db, "lineups", lineups.id)
      await setDoc(document, lineups)
      return true
    } catch (error) {
      logger.error(`Error upserting lineup ${lineups.id}: `, error)
      return false
    }
  }
}
