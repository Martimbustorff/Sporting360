import { Timestamp, collection, doc, getDocs, limit, orderBy, query, setDoc, where } from "@firebase/firestore"
import { IGame } from "../../interface/IGames"
import { db } from "../firebase"
import * as logger from "firebase-functions/logger";

export class Games {
  updateOrCreateGame = async (game: IGame) => {
    try {
      const document = doc(db, "games", game.api)
      await setDoc(document, game)
      return true
    } catch (error) {
      logger.error(`Error upserting game ${game.api}: `, error)
      return false
    }
  }

  // All games kicking off today (proper [startOfDay, startOfNextDay) window).
  getTodayGame = async (): Promise<IGame | null> => {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfNextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const document = collection(db, 'games');
      const querySnapshot = query(
        document,
        where("timestamp", ">=", Timestamp.fromDate(startOfDay)),
        where("timestamp", "<", Timestamp.fromDate(startOfNextDay)),
        orderBy("timestamp"),
        limit(1)
      );
      const gamesSnapshot = await getDocs(querySnapshot);
      const games = gamesSnapshot.docs.map(doc => doc.data()) as IGame[];
      if (games.length === 0) {
        return null;
      }
      const todayGame = games[0]
      logger.info(`Today game: ${todayGame.teamhome.name} vs ${todayGame.teamaway.name} - ${todayGame.competition} - ${todayGame.journey}`)
      return todayGame
    } catch (error) {
      logger.error(`Error getting today game: `, error)
      return null
    }
  }

  getGames = async (): Promise<IGame[]> => {
    try {
      const gamesCollection = collection(db, "games");
      const gamesSnapshot = await getDocs(gamesCollection);
      const games = gamesSnapshot.docs.map(doc => doc.data()) as IGame[];
      return games;
    } catch (error) {
      logger.error(`Error getting games: `, error)
      return []
    }
  }

  // Games kicking off within +/- `windowDays` of now. Used by the recurring schedulers
  // so they read only a handful of documents instead of the entire multi-season history.
  getRecentGames = async (windowDays: number = 2): Promise<IGame[]> => {
    try {
      const nowMs = Date.now();
      const lower = new Date(nowMs - windowDays * 24 * 60 * 60 * 1000);
      const upper = new Date(nowMs + windowDays * 24 * 60 * 60 * 1000);
      const document = collection(db, 'games');
      const querySnapshot = query(
        document,
        where("timestamp", ">=", Timestamp.fromDate(lower)),
        where("timestamp", "<=", Timestamp.fromDate(upper)),
        orderBy("timestamp")
      );
      const gamesSnapshot = await getDocs(querySnapshot);
      return gamesSnapshot.docs.map(doc => doc.data()) as IGame[];
    } catch (error) {
      logger.error(`Error getting recent games: `, error)
      return []
    }
  }

  getGameById = async (gameId: string): Promise<IGame | null> => {
    try {
      const document = collection(db, 'games');
      const whereSnapshot = where("api", "==", gameId);
      const querySnapshot = query(document, whereSnapshot, limit(1));
      const gamesSnapshot = await getDocs(querySnapshot);
      const games = gamesSnapshot.docs.map(doc => doc.data()) as IGame[];
      if (games.length === 0) {
        logger.info(`No game found for id ${gameId}.`)
        return null;
      }
      const todayGame = games[0]
      logger.info(`Today game: ${todayGame.teamhome.name} vs ${todayGame.teamaway.name} - ${todayGame.competition} - ${todayGame.journey}`)
      return todayGame
    } catch (error) {
      logger.error(`Error getting game ${gameId}: `, error)
      return null
    }
  }
}
