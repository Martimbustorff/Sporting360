import { load } from "cheerio";
import { competitionLabel } from "../../model/labels";
import { FREE_SOURCES } from "../../modalities/sourcesConfig";
import { getText, SourceError, type FetchFn } from "../http";
import { FREE_HEADERS, FREE_TIMEOUT_MS, intOrNull, isSporting, lisbonDate, slugId, statusWithScore, teamRef, type FetchContext, type MatchSource, type NormalizedMatch } from "./common";

const KEY = "hp_fpp";

/**
 * Por época: páginas com a lista de fases (Campeonato 12, Supertaça 19, Taça e Elite Cup 15 e 20; Task 1) e as fases
 * já conhecidas. As fases novas (play-offs, eliminatórias seguintes da Taça) aparecem nas listas com ids novos.
 */
export const HP_FPP_SEASONS: Record<string, { lists: string[]; phases: number[] }> = {
  "2026-2027": { lists: ["/136/12", "/136/15", "/136/19", "/136/20"], phases: [493, 496, 508, 509] },
};

const text = (s: string) => s.replace(/\s+/g, " ").trim();

/** Nome de origem para `competitionLabel` a partir do título da fase. */
function competitionRaw(h1: string): string {
  if (/campeonato placard/i.test(h1)) return "Campeonato Placard";
  if (/super\s*ta[çc]a/i.test(h1)) return "Supertaça";
  if (/elite cup/i.test(h1)) return "Elite Cup";
  if (/ta[çc]a de portugal/i.test(h1)) return "Taça de Portugal";
  return h1;
}

export function parsePhaseList(html: string): { id: number; name: string }[] {
  const $ = load(html);
  if ($("#principal").length === 0) throw new SourceError(KEY, "parse", "lista de fases sem #principal");
  const out: { id: number; name: string }[] = [];
  $('a[href^="/Competicao/"]').each((_, a) => {
    const id = Number(($(a).attr("href") ?? "").match(/\/Competicao\/(\d+)/)?.[1]);
    if (Number.isFinite(id) && id > 0) out.push({ id, name: text($(a).text()) });
  });
  return out;
}

/** Calendário de uma fase (/Competicao/{id}): só os jogos do Sporting. Hora local de Lisboa. */
export function parseHpPhase(html: string, phaseId: number, season: string, now: Date): NormalizedMatch[] {
  const $ = load(html);
  const h1 = text($("#principal h1").first().text());
  if ($("#principal").length === 0 || h1 === "") throw new SourceError(KEY, "parse", `fase ${phaseId}: sem #principal ou título`);
  const label = competitionLabel("roller_hockey", null, competitionRaw(h1));
  // Play-off: a fase ("1/2 Final") entra na ronda, cada "Jornada" é um jogo da série.
  const playoffPhase = h1.match(/play\s*-?\s*off\s*-\s*(.+)$/i)?.[1]?.trim() ?? null;

  const out: NormalizedMatch[] = [];
  let round: string | null = null;
  $("table.calendario-hp tr").each((_, tr) => {
    const $tr = $(tr);
    const h6 = $tr.find("h6.titulo-jornada");
    if (h6.length > 0) {
      round = text(h6.text()) || null;
      return;
    }
    const dateCell = $tr.find("td.coluna-data").not(".coluna-numero").find("p.data");
    if (dateCell.length === 0) return; // linha só com a ligação de vídeo
    const dt = text(dateCell.text()).match(/(\d{4}-\d{2}-\d{2})\s*(\d{1,2}:\d{2})?/);
    const homeName = text($tr.find("p.visitada").text());
    const awayName = text($tr.find("p.visitante").text());
    const numero = text($tr.find("td.coluna-numero p.data").text());
    if (!dt || homeName === "" || awayName === "" || numero === "") throw new SourceError(KEY, "parse", `fase ${phaseId}: linha sem data, número ou equipas`);
    const sportingHome = isSporting(homeName);
    const sportingAway = isSporting(awayName);
    if (!sportingHome && !sportingAway) return;

    const kickoff = lisbonDate(dt[1], dt[2] ?? "");
    const res = text($tr.find("p.resultado").text()).match(/^(\d+)\s*-\s*(\d+)$/);
    const home = intOrNull(res?.[1]);
    const away = intOrNull(res?.[2]);
    const status = statusWithScore(kickoff, now, home !== null && away !== null);
    out.push({
      sourceKey: KEY,
      sourceId: `${phaseId}_${numero}`,
      sport: "roller_hockey",
      season,
      competition: { id: slugId(label.name), name: label.name, round: playoffPhase && round ? `${playoffPhase} - ${round}` : round, type: label.type },
      kickoff,
      kickoffExact: dt[2] !== undefined,
      home: teamRef(homeName),
      away: teamRef(awayName),
      sportingSide: sportingAway && !sportingHome ? "away" : "home",
      status,
      statusRaw: res ? "resultado" : "-",
      score: status === "NS" ? { home: null, away: null } : { home, away },
      venue: null,
    });
  });
  return out;
}

const get = (f: FetchFn, path: string) => getText(f, `${FREE_SOURCES.roller_hockey.primary.url}${path}`, { source: KEY, headers: FREE_HEADERS, timeoutMs: FREE_TIMEOUT_MS });

/** FPP (oficial). Fora de janela: listas de fases + todas as fases; em janela de jogo só as fases desses jogos. */
export const hpFpp: MatchSource = {
  key: KEY,
  sport: "roller_hockey",
  async fetchMatches(f: FetchFn, season: string, now: Date, ctx?: FetchContext): Promise<NormalizedMatch[]> {
    const cfg = HP_FPP_SEASONS[season];
    if (!cfg) throw new SourceError(KEY, "parse", `época ${season} sem fases configuradas (HP_FPP_SEASONS)`);
    const focus = (ctx?.focus ?? []).filter((m) => m.source.provider === KEY).map((m) => Number(m.source.id.split("_")[0]));
    let phases: number[];
    if (focus.length > 0) {
      phases = focus;
    } else {
      phases = [...cfg.phases];
      for (const list of cfg.lists) phases.push(...parsePhaseList((await get(f, list)).body).map((p) => p.id));
    }
    const out: NormalizedMatch[] = [];
    for (const id of [...new Set(phases)].sort((a, b) => a - b)) {
      out.push(...parseHpPhase((await get(f, `/Competicao/${id}`)).body, id, season, now));
    }
    return out;
  },
};
