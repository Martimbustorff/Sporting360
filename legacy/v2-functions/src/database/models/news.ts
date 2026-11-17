import { doc, setDoc } from "@firebase/firestore"
import { db } from "../firebase"
import * as logger from "firebase-functions/logger";
import { INews } from "../../interface/INews";

// Firestore doc ids can't contain "/". Derive a stable id from the article URL so
// re-fetching the same feed upserts the same doc instead of creating duplicates.
export const slugifyUrl = (url: string): string =>
  url
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 300);

export class News {
  updateOrCreateArticle = async (article: INews) => {
    try {
      const document = doc(db, "news", article.id)
      await setDoc(document, article)
      return true
    } catch (error) {
      logger.error(`Error upserting article ${article.id}: `, error)
      return false
    }
  }
}
