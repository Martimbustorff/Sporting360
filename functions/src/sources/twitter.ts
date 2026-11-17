import { type FetchFn, getJson } from "./http";

export interface TweetsResponse {
  data?: {
    id: string;
    author_id: string;
    created_at: string;
    text: string;
    attachments?: { media_keys: string[] };
    public_metrics: {
      retweet_count: number;
      reply_count: number;
      like_count: number;
      quote_count: number;
      bookmark_count?: number;
      impression_count?: number;
    };
    // Texto completo de tweets longos (>280); `text` vem truncado.
    note_tweet?: { text: string };
  }[];
  includes?: {
    media?: { media_key: string; type: string; url?: string; preview_image_url?: string }[];
    users?: { id: string; username: string; name: string; profile_image_url: string }[];
  };
  meta?: Record<string, unknown>;
}

export interface TwitterClient {
  userTweets(userId: string): Promise<TweetsResponse>;
}

const PARAMS: Array<[string, string]> = [
  ["max_results", "10"],
  ["expansions", "attachments.media_keys,author_id"],
  ["user.fields", "profile_image_url,username,name"],
  ["media.fields", "url,preview_image_url"],
  ["tweet.fields", "created_at,public_metrics,note_tweet"],
];

export function twitter(o: { token: string; fetch?: FetchFn; timeoutMs?: number }): TwitterClient {
  const f = o.fetch ?? fetch;
  return {
    async userTweets(userId) {
      const qs = PARAMS.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
      const url = `https://api.twitter.com/2/users/${encodeURIComponent(userId)}/tweets?${qs}`;
      return (await getJson<TweetsResponse>(f, url, { source: "twitter", headers: { Authorization: `Bearer ${o.token}` }, timeoutMs: o.timeoutMs })).body;
    },
  };
}
