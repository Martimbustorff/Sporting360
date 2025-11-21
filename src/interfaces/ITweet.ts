export interface ITweet {
    id: string;
    text: string;
    created_at: string;
    username: string;
    name: string;
    profile_image_url: string;
    media: {
      url: string;
      type: string;
    }[];
    metrics: {
      retweet_count: number;
      reply_count: number;
      like_count: number;
      quote_count: number;
      bookmark_count: number;
      impression_count: number;
    };
  }