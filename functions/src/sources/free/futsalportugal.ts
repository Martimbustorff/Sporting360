import { load } from "cheerio";
import { logger } from "firebase-functions";
import type { GameStatus } from "../../game/types";
import { competitionLabel } from "../../model/labels";
import type { MatchDoc } from "../../model/types";
import { FREE_SOURCES } from "../../modalities/sourcesConfig";
import { getText, SourceError, type FetchFn } from "../http";
import {
  FREE_HEADERS,
  FREE_TIMEOUT_MS,
  intOrNull,
  isSporting,
  lisbonDate,
  lisbonDay,
  opponentSlug,
  seasonStartYear,
  slugId,
  statusWithScore,
  teamRef,
  type FetchContext,
  type MatchSource,
  type NormalizedMatch,
} from "./common";
import { fetchGamesheet, gamesheetUrl } from "./futsalportugal_gamesheet";

const KEY = "futsalportugal";
const DAY = 86_400_000;
/** Fichas pedidas por execução além das dos jogos próximos (hora com fuso; a lista segue o país de quem pede). */
const GAMESHEETS_PER_RUN = 4;

/** Competições do Sporting no futsalportugal.com (ids da Task 1) e o nome de origem para `competitionLabel`. */
export const FUTSAL_PAGES: { page: number; raw: string }[] = [
  { page: 26, raw: "Liga Placard" },
  { page: 45, raw: "Taça de Portugal" },
  { page: 43, raw: "Taça da Liga" },
  { page: 40, raw: "Supertaça" },
  { page: 57, raw: "UEFA Futsal Champions League" },
];

const MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};
const WEEKDAYS: Record<string, number> = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const pad = (n: number) => String(n).padStart(2, "0");

/** "Sexta-feira, 11 setembro" sem ano → AAAA-MM-DD da época (o dia da semana desempata o ano). */
function dayOf(text: string, season: string): string {
  const t = fold(text);
  const m = t.match(/(\d{1,2})\s+([a-z]+)/);
  const month = m ? MONTHS[m[2]] : undefined;
  if (!m || !month) throw new SourceError(KEY, "parse", `dia ilegível: "${text}"`);
  const day = Number(m[1]);
  const start = seasonStartYear(season);
  const weekday = WEEKDAYS[t.split(/[\s,-]/)[0]];
  const years = [start, start + 1].filter((y) => weekday === undefined || new Date(Date.UTC(y, month - 1, day)).getUTCDay() === weekday);
  const year = years.length === 1 ? years[0] : month >= 7 ? start : start + 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Lista de uma competição. Por omissão só os jogos do Sporting; `all` para testes. Hora da lista tomada como hora de Lisboa. */
export function parseFutsalSchedule(html: string, page: { page: number; raw: string }, season: string, now: Date, o: { all?: boolean } = {}): NormalizedMatch[] {
  const $ = load(html);
  if ($(".sc-body").length === 0) throw new SourceError(KEY, "parse", `competição ${page.page}: sem .sc-body`);
  const label = competitionLabel("futsal", null, page.raw);
  const out: NormalizedMatch[] = [];

  $("article.sc-round").each((_, art) => {
    const h3 = $(art).find("h3").first().clone();
    h3.find("em").remove();
    const round = h3.text().replace(/\s+/g, " ").trim() || null;
    let day: string | null = null;
    $(art)
      .find(".sc-day, .sc-item")
      .each((__, el) => {
        const $el = $(el);
        if ($el.hasClass("sc-day")) {
          day = dayOf($el.text(), season);
          return;
        }
        const names = $el.find(".mcm-name").map((___, n) => $(n).text()).get();
        const goals = $el.find(".mcm-g").map((___, n) => $(n).text()).get();
        const id = ($el.find(".mcm").attr("onclick") ?? "").match(/gamesheet\/(\d+)/)?.[1];
        if (names.length !== 2 || goals.length !== 2 || !id || day === null) {
          throw new SourceError(KEY, "parse", `competição ${page.page}: linha de jogo sem equipas, id ou dia`);
        }
        const sportingHome = isSporting(names[0]);
        const sportingAway = isSporting(names[1]);
        if (!o.all && !sportingHome && !sportingAway) return;

        const kickoff = lisbonDate(day, $el.find(".sc-time").text().trim());
        const upcoming = ($el.find(".mcm").attr("class") ?? "").split(/\s+/).includes("is-up");
        const extra = $el.find(".sc-extra").text().trim();
        const note = $el.find(".mcm-note").text().trim();
        const pen = note.match(/pen[aá]ltis\s*(\d+)\s*-\s*(\d+)/i);
        const home = intOrNull(goals[0]);
        const away = intOrNull(goals[1]);
        const finalStatus: GameStatus = /w\.?\s*o/i.test(extra) ? "CANC" : pen ? "PEN" : /a\.?\s*p/i.test(extra) ? "AET" : "FT";
        const status = upcoming ? "NS" : statusWithScore(kickoff, now, home !== null && away !== null, finalStatus);
        const played = status !== "NS";

        out.push({
          sourceKey: KEY,
          sourceId: id,
          sport: "futsal",
          season,
          competition: { id: slugId(label.name), name: label.name, round, type: label.type },
          kickoff,
          kickoffExact: false,
          home: teamRef(names[0]),
          away: teamRef(names[1]),
          sportingSide: sportingAway && !sportingHome ? "away" : "home",
          status,
          statusRaw: [extra, note].filter(Boolean).join(" ") || (upcoming ? "is-up" : ""),
          score: played ? { home, away } : { home: null, away: null },
          penalty: played && pen ? { home: Number(pen[1]), away: Number(pen[2]) } : null,
          venue: null,
        });
      });
  });
  return out;
}

function pagesFor(ctx: FetchContext | undefined): { page: number; raw: string }[] {
  const ids = new Set((ctx?.focus ?? []).filter((m) => m.sport === "futsal").map((m) => m.competition.id));
  const focused = FUTSAL_PAGES.filter((p) => ids.has(slugId(competitionLabel("futsal", null, p.raw).name)));
  return focused.length > 0 ? focused : FUTSAL_PAGES;
}

/** Hora gravada antes e confirmada por uma ficha, se o dia da lista não mudou. */
function knownExact(m: NormalizedMatch, known: Map<string, MatchDoc>): MatchDoc | null {
  const k = known.get(m.sourceId);
  return k && k.source.exactKickoff === true && lisbonDay(k.kickoff) === lisbonDay(m.kickoff) ? k : null;
}

export const futsalPortugal: MatchSource = {
  key: KEY,
  sport: "futsal",
  async fetchMatches(f: FetchFn, season: string, now: Date, ctx?: FetchContext): Promise<NormalizedMatch[]> {
    const out: NormalizedMatch[] = [];
    for (const page of pagesFor(ctx)) {
      const url = FREE_SOURCES.futsal.primary.url.replace("{competicao}", String(page.page));
      const { body } = await getText(f, url, { source: KEY, headers: FREE_HEADERS, timeoutMs: FREE_TIMEOUT_MS });
      out.push(...parseFutsalSchedule(body, page, season, now));
    }

    const known = new Map<string, MatchDoc>();
    for (const k of ctx?.known ?? []) if (k.source.provider === KEY || k.source.provider === "futsalportugal_gamesheet") known.set(k.source.id, k);

    // Hora já confirmada: reutiliza-a. Fichas: jogos próximos (−1 dia a +2 dias) sempre; dos restantes sem hora
    // confirmada, no máximo 4 por execução (futuros mais próximos primeiro, depois os passados mais recentes).
    const t = now.getTime();
    const near = (m: NormalizedMatch) => m.kickoff.getTime() >= t - DAY && m.kickoff.getTime() <= t + 2 * DAY;
    const todo: NormalizedMatch[] = [];
    const missing: NormalizedMatch[] = [];
    for (const m of out) {
      const k = knownExact(m, known);
      if (k) {
        m.kickoff = k.kickoff;
        m.kickoffExact = true;
        m.venue = k.venue?.name ?? null;
      }
      if (near(m)) todo.push(m);
      else if (!k) missing.push(m);
    }
    const future = missing.filter((m) => m.kickoff.getTime() > t).sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());
    const past = missing.filter((m) => m.kickoff.getTime() <= t).sort((a, b) => b.kickoff.getTime() - a.kickoff.getTime());
    todo.push(...[...future, ...past].slice(0, GAMESHEETS_PER_RUN));

    for (const m of todo) {
      try {
        const g = await fetchGamesheet(f, m.sourceId, KEY);
        // A ficha tem de ser deste jogo (mesmas equipas); senão fica a hora da lista.
        if (opponentSlug(g.home) !== opponentSlug(m.home.name) || opponentSlug(g.away) !== opponentSlug(m.away.name)) {
          logger.warn(`futsalportugal: ficha ${gamesheetUrl(m.sourceId)} com outras equipas, ignorada`);
          continue;
        }
        m.kickoff = g.start;
        m.kickoffExact = true;
        m.venue = g.venue;
        if (m.kickoff.getTime() > t && m.status !== "NS") {
          m.status = "NS";
          m.score = { home: null, away: null };
          m.penalty = null;
        }
      } catch (e) {
        logger.warn(`futsalportugal: ficha ${m.sourceId} falhou: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return out;
  },
};
