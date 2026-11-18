import { logger } from "firebase-functions";
import type { Firestore } from "firebase-admin/firestore";
import { recordRun } from "../store/health";
import type { Sport } from "../model/types";
import { fetchFeed, type FeedItem } from "../sources/rss";
import type { FetchFn } from "../sources/http";
import { legacyCollection, writeDocs, type DocWrite } from "../store/writer";

// Feeds públicos de editoras, sem chave (iguais ao legado).
export const NEWS_SOURCES = [
  { name: "Maisfutebol", url: "https://maisfutebol.iol.pt/rss" },
  { name: "Record", url: "https://www.record.pt/rss" },
];

// Os feeds cobrem todos os clubes: filtra-se para o Sporting CP, excluindo outros clubes com o mesmo nome.
const FALSE_POSITIVES = [
  "sporting braga",
  "sporting de braga", // acrescentado ao legado: o brief pede que seja rejeitado
  "sp. braga",
  "sp braga",
  "sporting kc",
  "sporting kansas",
  "sporting cristal",
  "sporting gijón",
  "sporting gijon",
  "real sporting",
];

/** Id de documento estável a partir do URL (sem "/"), tal como o legado. */
export const slugifyUrl = (url: string): string =>
  url
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 300);

export const isSportingCPArticle = (item: Pick<FeedItem, "link" | "title" | "summary">): boolean => {
  // O Maisfutebol etiqueta os artigos por clube no URL (ex.: /sporting/mercado/...): é decisivo.
  if (item.link.toLowerCase().includes("/sporting/")) return true;

  const text = `${item.title} ${item.summary}`.toLowerCase();
  if (!/\bsporting\b/.test(text)) return false;
  return !FALSE_POSITIVES.some((fp) => text.includes(fp));
};

const URL_SPORTS: Array<[string, Sport]> = [
  ["/futsal/", "futsal"],
  ["/andebol/", "handball"],
  ["/hoquei", "roller_hockey"],
  ["/voleibol/", "volleyball"],
  ["/basquetebol/", "basketball"],
];
const TEXT_SPORTS: Array<[RegExp, Sport]> = [
  [/futsal/, "futsal"],
  [/andebol/, "handball"],
  [/h[óo]quei/, "roller_hockey"],
  [/voleibol/, "volleyball"],
  [/basquete(bol)?/, "basketball"],
];

/** Modalidade: URL primeiro, depois palavras no título e resumo; futebol por omissão. */
export function detectSport(item: Pick<FeedItem, "link" | "title" | "summary">): Sport {
  const url = item.link.toLowerCase();
  if (url.includes("/futebol/")) return "football";
  for (const [part, sport] of URL_SPORTS) if (url.includes(part)) return sport;
  const text = `${item.title} ${item.summary}`.toLowerCase();
  for (const [re, sport] of TEXT_SPORTS) if (re.test(text)) return sport;
  return "football";
}

/** Corta na última palavra inteira até `max` caracteres e acrescenta "…" (resultado ≤ max + 1). */
export function summarize(text: string, max = 400): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  // Se o carácter seguinte já é espaço, `cut` termina numa palavra inteira.
  const base = /\s/.test(t[max]) ? cut : cut.replace(/\s+\S*$/, "");
  return `${(base || cut).trimEnd()}…`;
}

export interface NewsDeps {
  db: Firestore;
  fetch: FetchFn;
  now: () => Date;
  prefix?: string;
}

/**
 * Notícias do Sporting dos feeds RSS em `news/{slug}` (contrato antigo, mais `sport` e `publishedAt`
 * — campos aditivos, o legado lê só os seus; `merge` não apaga nada). Uma fonte a falhar não impede a
 * outra e fica em `ingestHealth/news_{nome}`; se todas falharem lança. `count` = notícias processadas.
 */
export async function syncNews(d: NewsDeps): Promise<{ count: number; failed: number }> {
  let count = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const source of NEWS_SOURCES) {
    try {
      // Sem data válida o item é ignorado: uma data inventada mudaria a cada execução (reescrita e notícia antiga no topo).
      const items = (await fetchFeed(d.fetch, source))
        .filter((i) => !!i.link && !Number.isNaN(new Date(i.pubDate).getTime()))
        .filter(isSportingCPArticle);
      const writes: DocWrite[] = items.map((item) => {
        const date = new Date(item.pubDate);
        const summary = summarize(item.summary);
        const id = slugifyUrl(item.link);
        return {
          path: `${legacyCollection("news", d.prefix)}/${id}`,
          data: {
            id,
            title: item.title,
            image: item.image,
            summary,
            content: item.summary, // texto integral do snippet, como o legado: o V2 mostra-o como corpo
            source: item.source,
            url: item.link,
            created_at: date.toISOString(),
            sport: detectSport(item),
            publishedAt: date,
          },
          merge: true,
          legacy: true,
        };
      });
      await writeDocs(d.db, writes, { stateKey: `news_${source.name}` });
      count += writes.length;
      await recordRun(d.db, `news_${source.name}`, { ok: true, count: writes.length });
      logger.info(`syncNews: ${writes.length} notícias de ${source.name}`);
    } catch (e) {
      failed++;
      const error = e instanceof Error ? e.message : String(e);
      errors.push(`${source.name}: ${error}`);
      logger.warn(`syncNews: ${source.name} falhou: ${error}`);
      try {
        await recordRun(d.db, `news_${source.name}`, { ok: false, error });
      } catch (inner) {
        logger.error("INGEST_ALERT", { source: `news_${source.name}`, reason: `falha a registar saúde: ${String(inner)}` });
      }
    }
  }
  if (failed === NEWS_SOURCES.length) throw new Error(`syncNews: todas as fontes falharam (${errors.join("; ")})`);
  return { count, failed };
}
