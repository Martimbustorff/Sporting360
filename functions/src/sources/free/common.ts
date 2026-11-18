import { fromZonedTime } from "date-fns-tz";
import type { GameStatus } from "../../game/types";
import { SPORTING_CREST_URL } from "../../config/brand";
import type { CompetitionType, MatchDoc, Pair, Sport, TeamRef } from "../../model/types";
import type { FetchFn } from "../http";

/** Jogo lido de uma fonte gratuita, antes da reconciliação. Só parsing, nunca escrita. */
export interface NormalizedMatch {
  sourceKey: string;
  sourceId: string;
  sport: Sport;
  /** Época no formato "2026-2027". */
  season: string;
  competition: { id: string; name: string; round: string | null; type: CompetitionType };
  kickoff: Date;
  /** Hora confirmada (com fuso explícito na fonte); false = hora aproximada. */
  kickoffExact?: boolean;
  home: TeamRef;
  away: TeamRef;
  sportingSide: "home" | "away";
  status: GameStatus;
  statusRaw: string;
  score: Pair;
  penalty?: Pair | null;
  venue: string | null;
  /** Texto de atribuição exigido pelos termos da fonte (ex. hoqueipatins.pt). */
  attribution?: string | null;
}

export interface FetchContext {
  /** Jogos já gravados desta modalidade e época (para ids e horas já confirmadas). */
  known: MatchDoc[];
  /** Jogos em janela de jogo agora: com eles a fonte pode pedir só as páginas que os têm. */
  focus: MatchDoc[];
}

export interface MatchSource {
  key: string;
  sport: Sport;
  fetchMatches(f: FetchFn, season: string, now: Date, ctx?: FetchContext): Promise<NormalizedMatch[]>;
}

/** Cabeçalhos dos pedidos às fontes gratuitas: identificam a app e o propósito. */
export const FREE_HEADERS: Record<string, string> = {
  "User-Agent": "SCP360/2027 (calendario de adeptos do Sporting CP; scp360-37a74.web.app)",
  Accept: "text/html,application/json;q=0.9",
};
export const FREE_TIMEOUT_MS = 15_000;

const DROP = new Set([
  "sc", "cf", "fc", "clube", "de", "do", "da", "dos", "das", "sl", "cp", "cd", "ad", "ud", "gd", "hc", "oc", "sad", "ac", "cs",
  "futsal", "hoquei", "patins",
]);

const ENTITIES: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m);
}

/**
 * Nome de equipa comparável entre fontes: minúsculas, sem acentos, sem patrocinador depois de "/",
 * sem siglas de clube (SC, CF, FC, SL, CP, ...), "Clube", "de" e pontuação. "SL Benfica" e "Benfica" → "benfica".
 */
export function opponentSlug(name: string): string {
  const base = decodeEntities(name).split("/")[0];
  return base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w !== "" && !DROP.has(w))
    .join(" ");
}

export function isSporting(name: string): boolean {
  const s = opponentSlug(name);
  return s === "sporting" || s === "sporting portugal";
}

export function slugId(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Equipa no modelo: id = slug do nome (as fontes não têm ids comuns); o Sporting leva o emblema de 2026. */
export function teamRef(name: string): TeamRef {
  const clean = decodeEntities(name).replace(/\s+/g, " ").trim();
  return isSporting(clean) ? { id: "sporting", name: clean, logo: SPORTING_CREST_URL } : { id: slugId(opponentSlug(clean)) || slugId(clean), name: clean, logo: null };
}

/** Hora local de Lisboa ("2026-11-22", "19:30") para `Date`. */
export function lisbonDate(day: string, time: string): Date {
  const hhmm = /^\d{1,2}:\d{2}$/.test(time) ? time.padStart(5, "0") : "00:00";
  return fromZonedTime(`${day}T${hhmm}:00`, "Europe/Lisbon");
}

/** Dia de Lisboa (AAAA-MM-DD) de um instante. */
export function lisbonDay(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** Duração típica de um jogo de futsal ou hóquei (até ao apito final), para o estado e `finishedAt`. */
export const GAME_DURATION_MS = 110 * 60_000;

/**
 * Estado de um jogo com resultado publicado: no futuro nunca é final (amostras com resultado em jogos
 * por jogar); até 110 min depois do início é LIVE; depois FT.
 */
export function statusWithScore(kickoff: Date, now: Date, hasScore: boolean, finalStatus: GameStatus = "FT"): GameStatus {
  if (!hasScore || kickoff.getTime() > now.getTime()) return "NS";
  return now.getTime() - kickoff.getTime() < GAME_DURATION_MS ? "LIVE" : finalStatus;
}

export function intOrNull(s: string | null | undefined): number | null {
  const t = (s ?? "").trim();
  return /^\d+$/.test(t) ? Number(t) : null;
}

/** Ano inicial de uma época "2026-2027". */
export function seasonStartYear(season: string): number {
  const y = Number(season.slice(0, 4));
  if (!Number.isFinite(y)) throw new Error(`época inválida: ${season}`);
  return y;
}
