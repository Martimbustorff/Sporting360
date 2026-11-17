import { logger } from "firebase-functions";
import type { Firestore } from "firebase-admin/firestore";
import type { TwitterClient } from "../sources/twitter";
import { legacyCollection, writeDocs, type DocWrite } from "../store/writer";

export const TWEET_USERS = [
  { id: "21389998", username: "SportingCP" },
  { id: "60026862", username: "scpmodalidades" },
];

export interface TweetsDeps {
  db: Firestore;
  tw: TwitterClient;
  prefix?: string;
}

/**
 * Últimos tweets das contas do Sporting em `tweets/{id}` (contrato antigo ITweet). Texto completo do
 * `note_tweet` quando existe; `media` com `url` ou, na falta, `preview_image_url`. Um utilizador a
 * falhar não impede o outro; se todos falharem lança. `count` = tweets processados.
 */
export async function syncTweets(d: TweetsDeps): Promise<{ count: number; failed: number }> {
  let count = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const user of TWEET_USERS) {
    try {
      const res = await d.tw.userTweets(user.id);
      const mediaMap = new Map<string, { url: string; type: string }>();
      for (const m of res.includes?.media ?? []) {
        const url = m.url || m.preview_image_url;
        if (url && m.type) mediaMap.set(m.media_key, { url, type: m.type });
      }
      const info = res.includes?.users?.find((u) => u.id === user.id);

      const writes: DocWrite[] = (res.data ?? []).map((t) => ({
        path: `${legacyCollection("tweets", d.prefix)}/${t.id}`,
        data: {
          id: t.id,
          text: t.note_tweet?.text || t.text,
          created_at: t.created_at,
          username: info?.username || user.username,
          name: info?.name || "",
          profile_image_url: info?.profile_image_url || "",
          media: (t.attachments?.media_keys ?? []).map((k) => mediaMap.get(k)).filter((m): m is { url: string; type: string } => !!m),
          metrics: {
            retweet_count: t.public_metrics.retweet_count,
            reply_count: t.public_metrics.reply_count,
            like_count: t.public_metrics.like_count,
            quote_count: t.public_metrics.quote_count,
            bookmark_count: t.public_metrics.bookmark_count,
            impression_count: t.public_metrics.impression_count,
          },
        },
        legacy: true,
      }));
      await writeDocs(d.db, writes, { stateKey: `tweets_${user.id}` });
      count += writes.length;
    } catch (e) {
      failed++;
      const error = e instanceof Error ? e.message : String(e);
      errors.push(`@${user.username}: ${error}`);
      logger.warn(`syncTweets: @${user.username} falhou: ${error}`);
    }
  }
  if (failed === TWEET_USERS.length) throw new Error(`syncTweets: todos os utilizadores falharam (${errors.join("; ")})`);
  return { count, failed };
}
