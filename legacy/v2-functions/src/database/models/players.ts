import { doc, setDoc } from "@firebase/firestore"
import { db } from "../firebase"
import { IPlayers } from "../../interface/IPlayers";
import * as logger from "firebase-functions/logger";

export class Players {
  updateOrCreatePlayers = async (players: IPlayers) => {
    try {
      const document = doc(db, "players", players.id)
      await setDoc(document, players)
      return true
    } catch (error) {
      logger.error(`Error upserting players ${players.id}: `, error)
      return false
    }
  }
}
