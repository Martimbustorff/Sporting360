import Parser = require("rss-parser");

const parser = new Parser();

export interface IFeedSource {
  name: string;
  url: string;
}

export interface INormalizedFeedItem {
  title: string;
  link: string;
  pubDate: string;
  summary: string;
  image: string;
  source: string;
}

// Most feeds (e.g. Record) declare a proper <enclosure> for the article image.
// Maisfutebol instead embeds an <img> tag inside the item's HTML description,
// so fall back to pulling the first img src out of the raw content.
const IMG_SRC_REGEX = /<img[^>]+src="([^"]+)"/i;

const extractImage = (item: Parser.Item): string => {
  if (item.enclosure?.url) return item.enclosure.url;
  const match = IMG_SRC_REGEX.exec(item.content || "");
  return match ? match[1] : "";
};

// Record's feed double-escapes its CDATA wrapper (&lt;![CDATA[ ... ]]&gt; instead of a
// real CDATA section), so the literal markers survive XML parsing as plain text — strip
// them defensively so titles/summaries don't show "<![CDATA[ ... ]]>" verbatim.
const stripCdataArtifacts = (text: string): string =>
  text.replace(/^<!\[CDATA\[\s*/, "").replace(/\s*\]\]>$/, "").trim();

export const fetchFeed = async (source: IFeedSource): Promise<INormalizedFeedItem[]> => {
  const feed = await parser.parseURL(source.url);
  return (feed.items || []).map((item: Parser.Item) => ({
    title: stripCdataArtifacts(item.title || ""),
    link: item.link || "",
    pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
    summary: stripCdataArtifacts(item.contentSnippet || ""),
    image: extractImage(item),
    source: source.name,
  }));
};
