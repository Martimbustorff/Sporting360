export interface TweetsResponse {
  data: Tweet[]
  includes: Includes
  meta: Meta
}

export interface Tweet {
  author_id: string
  id: string
  edit_history_tweet_ids: string
  attachments: MediaKey
  created_at: string
  public_metrics: Public_Metrics
  text: string
  // Present only for long tweets (>280 chars); holds the untruncated text.
  note_tweet?: NoteTweet
}

export interface NoteTweet {
  text: string
}

export interface MediaKey {
  media_keys: string[]
}
export interface Includes {
  media: Media[]
  users: User[]
}
export interface Media {
  media_key: string
  type: string
  url?: string
  preview_image_url?: string
}

export interface User {
  username: string
  id: string
  profile_image_url: string
  name: string
}
export interface Meta {
  media_keys: string[]
}

export interface Public_Metrics {
  retweet_count: number;
  reply_count: number;
  like_count: number;
  quote_count: number;
  bookmark_count: number;
  impression_count: number;
}
