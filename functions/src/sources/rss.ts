import Parser = require("rss-parser");
import { type FetchFn, SourceError, getText } from "./http";

export interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
  summary: string;
  image: string;
  source: string;
}

// Alguns feeds (Maisfutebol) metem a imagem num <img> dentro do HTML; os outros (Record) usam <enclosure>.
const IMG_SRC_REGEX = /<img[^>]+src="([^"]+)"/i;

const extractImage = (item: Parser.Item): string => {
  if (item.enclosure?.url) return item.enclosure.url;
  const m = IMG_SRC_REGEX.exec(item.content || "");
  return m ? m[1] : "";
};

// O feed do Record escapa duas vezes o CDATA: os marcadores chegam como texto e têm de sair.
const stripCdata = (text: string): string => text.replace(/^<!\[CDATA\[\s*/, "").replace(/\s*\]\]>$/, "").trim();

export async function fetchFeed(f: FetchFn, s: { name: string; url: string }): Promise<FeedItem[]> {
  const { body } = await getText(f, s.url, { source: `rss:${s.name}` });
  let feed: Parser.Output<Parser.Item>;
  try {
    feed = await new Parser().parseString(body);
  } catch (e) {
    throw new SourceError(`rss:${s.name}`, "parse", `feed inválido: ${(e as Error).message}`);
  }
  return (feed.items || []).map((item) => ({
    title: stripCdata(item.title || ""),
    link: item.link || "",
    pubDate: item.pubDate || item.isoDate || "",
    summary: stripCdata(item.contentSnippet || item.content || ""),
    image: extractImage(item),
    source: s.name,
  }));
}
