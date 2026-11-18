import { load } from "cheerio";
import { competitionLabel } from "../../model/labels";
import { FREE_SOURCES } from "../../modalities/sourcesConfig";
import { getText, SourceError, type FetchFn } from "../http";
import { FREE_HEADERS, FREE_TIMEOUT_MS, isSporting, slugId, teamRef, type FetchContext, type MatchSource, type NormalizedMatch } from "./common";

const KEY = "futsalportugal_gamesheet";
const DAY = 86_400_000;
/** Fichas por execução: só jogos já conhecidos entre −1 dia e +2 dias (os mesmos URLs que a principal pede). */
const MAX_PER_RUN = 3;

export interface Gamesheet {
  competition: string;
  round: string | null;
  home: string;
  away: string;
  start: Date;
  venue: string | null;
}

export const gamesheetUrl = (id: string) => FREE_SOURCES.futsal.fallback.url.replace("{id}", id);

type Ld = { "@type"?: string; name?: string; startDate?: string; homeTeam?: { name?: string }; awayTeam?: { name?: string }; location?: { name?: string } };

/** JSON-LD `SportsEvent` de /pt/gamesheet/{id}: "LIGA PLACARD - 1ª Jornada: AD Fundão vs SC Braga", startDate com fuso, local. */
export function parseGamesheetJsonLd(html: string, source = KEY): Gamesheet {
  const $ = load(html);
  let ev: Ld | undefined;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (ev) return;
    try {
      const raw = JSON.parse($(el).text()) as Ld | Ld[] | { "@graph"?: Ld[] };
      const list: Ld[] = Array.isArray(raw) ? raw : "@graph" in raw && Array.isArray(raw["@graph"]) ? raw["@graph"] : [raw as Ld];
      ev = list.find((x) => x["@type"] === "SportsEvent");
    } catch {
      // outro bloco JSON-LD inválido: continua
    }
  });
  if (!ev) throw new SourceError(source, "parse", "ficha sem JSON-LD SportsEvent");
  const start = new Date(ev.startDate ?? "");
  const home = ev.homeTeam?.name?.trim();
  const away = ev.awayTeam?.name?.trim();
  if (Number.isNaN(start.getTime()) || !home || !away) throw new SourceError(source, "parse", "ficha sem startDate ou equipas");
  const m = (ev.name ?? "").match(/^(.*?)\s+-\s+(.*?):\s/);
  return { competition: (m?.[1] ?? "").trim(), round: m?.[2]?.trim() || null, home, away, start, venue: ev.location?.name?.trim() || null };
}

export async function fetchGamesheet(f: FetchFn, id: string, source = KEY): Promise<Gamesheet> {
  const { body } = await getText(f, gamesheetUrl(id), { source, headers: FREE_HEADERS, timeoutMs: FREE_TIMEOUT_MS });
  return parseGamesheetJsonLd(body, source);
}

/** Recurso do futsal (mesmo editor, outra vista): fichas dos jogos do Sporting já conhecidos e próximos. Sem resultado. */
export const futsalPortugalGamesheet: MatchSource = {
  key: KEY,
  sport: "futsal",
  async fetchMatches(f: FetchFn, season: string, now: Date, ctx?: FetchContext): Promise<NormalizedMatch[]> {
    const t = now.getTime();
    const ids = [
      ...new Set(
        (ctx?.known ?? [])
          .filter((m) => m.sport === "futsal" && (m.source.provider === "futsalportugal" || m.source.provider === KEY))
          .filter((m) => m.kickoff.getTime() >= t - DAY && m.kickoff.getTime() <= t + 2 * DAY)
          .sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime())
          .map((m) => m.source.id),
      ),
    ].slice(0, MAX_PER_RUN);

    const out: NormalizedMatch[] = [];
    for (const id of ids) {
      const g = await fetchGamesheet(f, id);
      const sportingHome = isSporting(g.home);
      const sportingAway = isSporting(g.away);
      if (!sportingHome && !sportingAway) continue;
      const label = competitionLabel("futsal", null, g.competition);
      out.push({
        sourceKey: KEY,
        sourceId: id,
        sport: "futsal",
        season,
        competition: { id: slugId(label.name), name: label.name, round: g.round, type: label.type },
        kickoff: g.start,
        kickoffExact: true,
        home: teamRef(g.home),
        away: teamRef(g.away),
        sportingSide: sportingAway && !sportingHome ? "away" : "home",
        status: "NS",
        statusRaw: "",
        score: { home: null, away: null },
        venue: g.venue,
      });
    }
    return out;
  },
};
