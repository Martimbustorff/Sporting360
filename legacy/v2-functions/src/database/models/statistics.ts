import { doc, setDoc } from "@firebase/firestore"
import { db } from "../firebase"
import { IStastistics } from "../../interface/IStatistics"
import * as logger from "firebase-functions/logger";

export class Statistics {
  updateOrCreateStatistics = async (Stastistics: IStastistics) => {
    try {
      const document = doc(db, "stastistics", Stastistics.api)
      await setDoc(document, Stastistics)
      return true
    } catch (error) {
      logger.error(`Error upserting statistics ${Stastistics.api}: `, error)
      return false
    }
  }
}
