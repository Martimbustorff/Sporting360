import { collection, doc, getDocs, limit, query, setDoc, where } from "@firebase/firestore"
import { db } from "../firebase"
import * as logger from "firebase-functions/logger";
import { ITweet } from "../../interface/ITweets";

export class Tweets {
  updateOrCreateTweet = async (tweet: ITweet) => {
    try {
      const document = doc(db, "tweets", tweet.id)
      await setDoc(document, tweet)
      return true
    } catch (error) {
      logger.error(`Error upserting tweet ${tweet.id}: `, error)
      return false
    }
  }
  getTweets = async (): Promise<ITweet[]> => {
    try {
      const tweetsCollection = collection(db, "tweets");
      const tweetsSnapshot = await getDocs(tweetsCollection);
      const tweets = tweetsSnapshot.docs.map(doc => doc.data()) as ITweet[];
      return tweets;
    } catch (error) {
      logger.error(`Error getting tweets: `, error)
      return []
    }
  }
  getTweetsById = async (tweetId: string): Promise<ITweet | null> => {
    try {
      const document = collection(db, 'tweets');
      const whereSnapshot = where("id", "==", tweetId);
      const querySnapshot = query(document, whereSnapshot, limit(1));
      const tweetsSnapshot = await getDocs(querySnapshot);
      const tweets = tweetsSnapshot.docs.map(doc => doc.data()) as ITweet[];
      if (tweets.length === 0) {
        return null;
      }
      const sametweet = tweets[0]
      logger.info(`Same Tweet: ${sametweet.id}, ${sametweet.name}`)
      return sametweet
    } catch (error) {
      logger.error(`Error getting tweet ${tweetId}: `, error)
      return null
    }
  }
}
