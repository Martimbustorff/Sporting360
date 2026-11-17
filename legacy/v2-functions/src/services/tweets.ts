import { Tweets } from "../database/models/tweets";
import { ITweet } from "../interface/ITweets";
import { getTweets } from "../midleware/tweets";
import * as logger from "firebase-functions/logger";

const users = [
  { id: '21389998', username: 'SportingCP' },
  { id: '60026862', username: 'scpmodalidades' }
];

export const TweetsScript = async () => {
  const twitter = new Tweets()
  await Promise.all(
    users.map(async (user) => {
      try {
        const res = await getTweets(user.id);

        // Create media map with type + url
        const mediaMap = new Map<string, { url: string; type: string }>();
        for (const media of res.includes?.media || []) {
          const mediaUrl = media.url || media.preview_image_url;
          if (mediaUrl && media.type) {
            mediaMap.set(media.media_key, {
              url: mediaUrl,
              type: media.type,
            });
          }
        }

        const userInfo = res.includes.users.find((u) => u.id === user.id);

        await Promise.all(
          res.data.map(async (tweet) => {
            const mediaKeys = tweet.attachments?.media_keys || [];

            const media = mediaKeys
              .map((key) => mediaMap.get(key))
              .filter((m): m is { url: string; type: string } => !!m);

            const tweetData: ITweet = {
              id: tweet.id,
              // Prefer the untruncated note_tweet text for long posts; fall back to text.
              text: tweet.note_tweet?.text || tweet.text,
              created_at: tweet.created_at,
              username: userInfo?.username || user.username,
              name: userInfo?.name || '',
              profile_image_url: userInfo?.profile_image_url || '',
              media,
              metrics: {
                retweet_count: tweet.public_metrics.retweet_count,
                reply_count: tweet.public_metrics.reply_count,
                like_count: tweet.public_metrics.like_count,
                quote_count: tweet.public_metrics.quote_count,
                bookmark_count: tweet.public_metrics.bookmark_count,
                impression_count: tweet.public_metrics.impression_count,
              },
            };

            await twitter.updateOrCreateTweet(tweetData);
          })
        );

        logger.log(`✅ Saved tweets for user @${user.username}`);
      } catch (err) {
        logger.error(`❌ Failed to process tweets for @${user.username}`, err);
      }
    })
  );
}

