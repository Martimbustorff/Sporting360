import { load } from "cheerio";
import { fromZonedTime } from "date-fns-tz";
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
  lisbonDay,
  opponentSlug,
  seasonStartYear,
  slugId,
  statusFromScore,
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

/** Fuso de cada rótulo "hora XX" da lista (o site mostra a hora do país de quem pede). Outros: hora não confirmada. */
export const FUTSAL_LIST_ZONES: Record<string, string> = {
  PT: "Europe/Lisbon",
  ES: "Europe/Paris", FR: "Europe/Paris", BE: "Europe/Paris", NL: "Europe/Paris", LU: "Europe/Paris", DE: "Europe/Paris", IT: "Europe/Paris", CH: "Europe/Paris", AT: "Europe/Paris",
  GB: "Europe/London", UK: "Europe/London", IE: "Europe/London",
};

/** Dados da linha para voltar a calcular o estado quando a ficha confirma a hora. */
interface RowInfo {
  upcoming: boolean;
  home: number | null;
  away: number | null;
  pen: { home: number; away: number } | null;
  finalStatus: GameStatus;
}
const ROWS = new WeakMap<NormalizedMatch, RowInfo>();

/** Estado, resultado e penáltis a partir da linha e da hora atual do jogo (confirmada ou não). */
function applyStatus(m: NormalizedMatch, r: RowInfo, now: Date): void {
  m.status = r.upcoming
    ? "NS"
    : statusFromScore({ kickoff: m.kickoff, exact: m.kickoffExact === true, now, hasScore: r.home !== null && r.away !== null, type: m.competition.type, finalStatus: r.finalStatus });
  const played = m.status !== "NS";
  m.score = played ? { home: r.home, away: r.away } : { home: null, away: null };
  m.penalty = played ? r.pen : null;
}

/**
 * Lista de uma competição. Por omissão só os jogos do Sporting; `all` para testes. A hora da lista está no fuso do
 * rótulo "hora XX": PT e países conhecidos dão hora confirmada; outro rótulo (ex. "US") fica como hora de Lisboa não
 * confirmada e gera um aviso em `o.alerts`. Linhas mal formadas de outras equipas são ignoradas; do Sporting, ou todas, falham.
 */
export function parseFutsalSchedule(
  html: string,
  page: { page: number; raw: string },
  season: string,
  now: Date,
  o: { all?: boolean; alerts?: string[] } = {},
): NormalizedMatch[] {
  const $ = load(html);
  if ($(".sc-body").length === 0) throw new SourceError(KEY, "parse", `competição ${page.page}: sem .sc-body`);
  const label = competitionLabel("futsal", null, page.raw);
  const hora = $(".sc-comp-head span").first().text().match(/hora\s+([A-Za-z]{2,3})\b/)?.[1]?.toUpperCase() ?? null;
  const zone = hora ? FUTSAL_LIST_ZONES[hora] : undefined;
  const out: NormalizedMatch[] = [];
  let rows = 0;
  let bad = 0;

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
        rows++;
        const names = $el.find(".mcm-name").map((___, n) => $(n).text()).get();
        const goals = $el.find(".mcm-g").map((___, n) => $(n).text()).get();
        const id = ($el.find(".mcm").attr("onclick") ?? "").match(/gamesheet\/(\d+)/)?.[1];
        if (names.length !== 2 || goals.length !== 2 || !id || day === null) {
          if (names.some((n) => isSporting(n))) throw new SourceError(KEY, "parse", `competição ${page.page}: linha do Sporting sem equipas, id ou dia`);
          bad++;
          return;
        }
        const sportingHome = isSporting(names[0]);
        const sportingAway = isSporting(names[1]);
        if (!o.all && !sportingHome && !sportingAway) return;

        const time = $el.find(".sc-time").text().trim();
        const hasTime = /^\d{1,2}:\d{2}$/.test(time);
        const kickoff = fromZonedTime(`${day}T${hasTime ? time.padStart(5, "0") : "00:00"}:00`, zone ?? "Europe/Lisbon");
        const extra = $el.find(".sc-extra").text().trim();
        const note = $el.find(".mcm-note").text().trim();
        const pen = note.match(/pen[aá]ltis\s*(\d+)\s*-\s*(\d+)/i);
        const info: RowInfo = {
          upcoming: ($el.find(".mcm").attr("class") ?? "").split(/\s+/).includes("is-up"),
          home: intOrNull(goals[0]),
          away: intOrNull(goals[1]),
          pen: pen ? { home: Number(pen[1]), away: Number(pen[2]) } : null,
          finalStatus: /w\.?\s*o/i.test(extra) ? "CANC" : pen ? "PEN" : /a\.?\s*p/i.test(extra) ? "AET" : "FT",
        };
        const m: NormalizedMatch = {
          sourceKey: KEY,
          sourceId: id,
          sport: "futsal",
          season,
          competition: { id: slugId(label.name), name: label.name, round, type: label.type },
          kickoff,
          kickoffExact: zone !== undefined && hasTime,
          home: teamRef(names[0]),
          away: teamRef(names[1]),
          sportingSide: sportingAway && !sportingHome ? "away" : "home",
          status: "NS",
          statusRaw: [extra, note].filter(Boolean).join(" ") || (info.upcoming ? "is-up" : ""),
          score: { home: null, away: null },
          penalty: null,
          venue: null,
        };
        applyStatus(m, info, now);
        ROWS.set(m, info);
        out.push(m);
      });
  });
  if (rows > 0 && bad === rows) throw new SourceError(KEY, "parse", `competição ${page.page}: nenhuma das ${rows} linhas é legível`);
  if (bad > 0) logger.warn(`futsalportugal: competição ${page.page}: ${bad} linhas de outras equipas ignoradas (mal formadas)`);
  if (zone === undefined && out.length > 0) {
    o.alerts?.push(`futsalportugal: lista ${page.page} com "hora ${hora ?? "?"}" (fuso não reconhecido): horas não confirmadas até à ficha do jogo`);
  }
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
      out.push(...parseFutsalSchedule(body, page, season, now, { alerts: ctx?.alerts }));
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
      if (k && !m.kickoffExact) {
        m.kickoff = k.kickoff;
        m.kickoffExact = true;
        m.venue = k.venue?.name ?? null;
      }
      if (near(m)) todo.push(m);
      else if (!m.kickoffExact) missing.push(m);
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
      } catch (e) {
        logger.warn(`futsalportugal: ficha ${m.sourceId} falhou: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    // Estado com a hora final (confirmada pela ficha ou não).
    for (const m of out) {
      const info = ROWS.get(m);
      if (info) applyStatus(m, info, now);
    }
    return out;
  },
};
