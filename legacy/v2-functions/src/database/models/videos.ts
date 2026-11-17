import { collection, doc, getDocs, setDoc } from "@firebase/firestore"
import { db } from "../firebase"
import { IVideos } from "../../interface/IVideos"
import * as logger from "firebase-functions/logger";

export class Videos {
  getVideos = async (): Promise<IVideos[]> => {
    try {
      const videosCollection = collection(db, "videos");
      const videosSnapshot = await getDocs(videosCollection);
      const videos = videosSnapshot.docs.map(doc => doc.data()) as IVideos[];
      return videos
    } catch (error) {
      logger.error(`Error getting videos: `, error)
      return []
    }
  }
  updateOrCreateVideos = async (videos: IVideos) => {
    try {
      const document = doc(db, "videos", videos.id)
      await setDoc(document, videos)
      return true
    } catch (error) {
      logger.error(`Error upserting video ${videos.id}: `, error)
      return false
    }
  }
}
