import { competitionLabel } from "../../model/labels";
import { FREE_SOURCES } from "../../modalities/sourcesConfig";
import { getJson, SourceError, type FetchFn } from "../http";
import { decodeEntities, FREE_HEADERS, FREE_TIMEOUT_MS, intOrNull, lisbonDate, slugId, statusWithScore, teamRef, type FetchContext, type MatchSource, type NormalizedMatch } from "./common";

const KEY = "hoqueipatins";
export const HOQUEIPATINS_ATTRIBUTION = "hoqueipatins.pt";
/** Equipa do Sporting no SportsPress (filtrar por id: "Sporting" também apanha Sporting B e Alcoi). */
export const HOQUEIPATINS_SPORTING = 3860;
/** Id SportsPress de cada época. */
export const HOQUEIPATINS_SEASONS: Record<string, number> = { "2026-2027": 1122 };
/** Ligas SportsPress (Task 1) e o nome de origem para `competitionLabel`. 233 = Taça de Portugal (por confirmar com jogo do Sporting). */
export const HOQUEIPATINS_LEAGUES: Record<number, string> = {
  230: "Campeonato Placard",
  233: "Taça de Portugal",
  535: "Elite Cup",
  538: "Supertaça",
  1123: "Liga dos Campeões WSE",
};
const MAX_PAGES = 6;

interface SpEvent {
  id: number;
  date: string;
  status: string;
  title?: { rendered?: string };
  leagues?: number[];
  teams?: number[];
  main_results?: string[];
  day?: string | null;
}

/** "Benfica x Sporting (FINAL)" → ["Benfica", "Sporting"]. */
function teamsOf(title: string): [string, string] | null {
  const t = decodeEntities(title).replace(/\s*\([^)]*\)\s*$/, "").trim();
  const parts = t.split(/\s+(?:vs\.?|x)\s+/i);
  return parts.length === 2 && parts[0] && parts[1] ? [parts[0].trim(), parts[1].trim()] : null;
}

function normalize(e: SpEvent, season: string, now: Date): NormalizedMatch | null {
  const teams = e.teams ?? [];
  const idx = teams.indexOf(HOQUEIPATINS_SPORTING);
  if (idx < 0 || idx > 1) return null;
  const league = (e.leagues ?? []).find((l) => HOQUEIPATINS_LEAGUES[l] !== undefined);
  if (league === undefined) return null;
  const names = teamsOf(e.title?.rendered ?? "");
  const dt = (e.date ?? "").match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (!names || !dt || typeof e.id !== "number") throw new SourceError(KEY, "parse", `evento ${e.id}: sem título "A vs B" ou data`);

  const kickoff = lisbonDate(dt[1], dt[2]);
  const r = e.main_results ?? [];
  const home = intOrNull(r[0]);
  const away = intOrNull(r[1]);
  const status = e.status === "publish" ? statusWithScore(kickoff, now, home !== null && away !== null) : "NS";
  const label = competitionLabel("roller_hockey", null, HOQUEIPATINS_LEAGUES[league]);
  return {
    sourceKey: KEY,
    sourceId: String(e.id),
    sport: "roller_hockey",
    season,
    competition: { id: slugId(label.name), name: label.name, round: e.day?.trim() || null, type: label.type },
    kickoff,
    kickoffExact: true,
    home: teamRef(names[0]),
    away: teamRef(names[1]),
    sportingSide: idx === 0 ? "home" : "away",
    status,
    statusRaw: e.status,
    score: status === "NS" ? { home: null, away: null } : { home, away },
    venue: null,
    attribution: HOQUEIPATINS_ATTRIBUTION,
  };
}

/**
 * hoqueipatins.pt (SportsPress REST, não oficial; termos pedem a indicação da fonte). Todas as ligas do Sporting num só
 * pedido paginado; em janela de jogo só as ligas desses jogos. O local (`venues`) é só um id: fica por preencher.
 */
export const hoqueipatins: MatchSource = {
  key: KEY,
  sport: "roller_hockey",
  async fetchMatches(f: FetchFn, season: string, now: Date, ctx?: FetchContext): Promise<NormalizedMatch[]> {
    const seasonId = HOQUEIPATINS_SEASONS[season];
    if (seasonId === undefined) throw new SourceError(KEY, "parse", `época ${season} sem id SportsPress (HOQUEIPATINS_SEASONS)`);
    const all = Object.keys(HOQUEIPATINS_LEAGUES).map(Number);
    const focusIds = new Set((ctx?.focus ?? []).filter((m) => m.sport === "roller_hockey").map((m) => m.competition.id));
    const focused = all.filter((l) => focusIds.has(slugId(competitionLabel("roller_hockey", null, HOQUEIPATINS_LEAGUES[l]).name)));
    const leagues = (focused.length > 0 ? focused : all).join(",");

    const out: NormalizedMatch[] = [];
    let pages = 1;
    for (let page = 1; page <= Math.min(pages, MAX_PAGES); page++) {
      const url = `${FREE_SOURCES.roller_hockey.fallback.url}?seasons=${seasonId}&leagues=${leagues}&per_page=100&orderby=date&order=asc&page=${page}`;
      const { body, headers } = await getJson<unknown>(f, url, { source: KEY, headers: FREE_HEADERS, timeoutMs: FREE_TIMEOUT_MS });
      if (!Array.isArray(body)) throw new SourceError(KEY, "parse", "resposta não é uma lista de eventos");
      const total = Number(headers.get("x-wp-totalpages"));
      if (page === 1 && Number.isFinite(total) && total > 1) pages = total;
      for (const e of body as SpEvent[]) {
        const m = normalize(e, season, now);
        if (m) out.push(m);
      }
    }
    return out;
  },
};
