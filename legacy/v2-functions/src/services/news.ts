import { News, slugifyUrl } from "../database/models/news";
import { INews } from "../interface/INews";
import { fetchFeed, IFeedSource, INormalizedFeedItem } from "../midleware/news";
import * as logger from "firebase-functions/logger";

// Free, publicly-syndicated publisher RSS feeds — no API key, no usage restriction
// (unlike e.g. Google News RSS, which restricts use to personal feed readers).
const SOURCES: IFeedSource[] = [
  { name: "Maisfutebol", url: "https://maisfutebol.iol.pt/rss" },
  { name: "Record", url: "https://www.record.pt/rss" },
];

// Both feeds cover all clubs, so filter down to Sporting CP. Match "sporting" as a
// whole word, but exclude other clubs that also carry the name.
const FALSE_POSITIVES = [
  "sporting braga",
  "sp. braga",
  "sp braga",
  "sporting kc",
  "sporting kansas",
  "sporting cristal",
  "sporting gijón",
  "sporting gijon",
  "real sporting",
];

const isSportingCPArticle = (item: INormalizedFeedItem): boolean => {
  // Maisfutebol tags its own articles by club in the URL (e.g. /sporting/mercado/...) —
  // treat that as authoritative when present.
  if (item.link.toLowerCase().includes("/sporting/")) return true;

  const text = `${item.title} ${item.summary}`.toLowerCase();
  if (!/\bsporting\b/.test(text)) return false;
  return !FALSE_POSITIVES.some((fp) => text.includes(fp));
};

export const NewsScript = async () => {
  const news = new News();

  await Promise.all(
    SOURCES.map(async (source) => {
      let items: INormalizedFeedItem[] = [];
      try {
        items = await fetchFeed(source);
      } catch (error) {
        logger.error(`Error fetching feed ${source.name}: `, error);
        return;
      }

      const relevant = items.filter(isSportingCPArticle).filter((item) => !!item.link);

      await Promise.all(
        relevant.map(async (item) => {
          const article: INews = {
            id: slugifyUrl(item.link),
            title: item.title,
            image: item.image,
            summary: item.summary,
            content: item.summary,
            source: item.source,
            url: item.link,
            created_at: new Date(item.pubDate).toISOString(),
          };
          await news.updateOrCreateArticle(article);
        })
      );

      logger.log(`✅ Saved ${relevant.length} Sporting CP articles from ${source.name}`);
    })
  );
};
