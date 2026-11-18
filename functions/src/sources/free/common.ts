import { fromZonedTime } from "date-fns-tz";
import type { GameStatus } from "../../game/types";
import { SPORTING_CREST_URL } from "../../config/brand";
import type { CompetitionType, MatchDoc, Pair, Sport, TeamRef } from "../../model/types";
import type { FetchFn } from "../http";
import { TEAM_SLUG_ALIASES } from "../../modalities/sourcesConfig";

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
  /** Avisos da fonte que não impedem a leitura (ex. fuso da lista não reconhecido); viram alertas. */
  alerts?: string[];
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
 * Nome de equipa comparável entre fontes: minúsculas, sem acentos, sem co-nome depois de "/", sem siglas de clube
 * (SC, CF, FC, SL, CP, ...), "Clube", "de", iniciais com ponto ("J. Pacense"), "d'" e pontuação; depois a tabela
 * `TEAM_SLUG_ALIASES` (ex. "SCT / UP TOMAR" → "tomar"). "SL Benfica" e "Benfica" → "benfica".
 */
export function opponentSlug(name: string): string {
  // Iniciais com ponto ("J. Pacense") e o "d'" de "Riba d'Ave" saem; letras soltas sem ponto ficam ("Sporting CP B").
  const base = decodeEntities(name).split("/")[0].replace(/\b[A-Za-z]\.\s*/g, " ").replace(/\b[dD]['’`]\s*/g, " ");
  const slug = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w !== "" && !DROP.has(w))
    .join(" ");
  return TEAM_SLUG_ALIASES[slug] ?? slug;
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

const MIN = 60_000;
/**
 * Tempo até se dar um jogo com resultado como terminado (as listas não têm marca de "final"; a ficha da FPP tem
 * "provisório" mas não é pedida): 120 min; 150 min em taças e supertaças (prolongamento e penáltis).
 */
export function gameDurationMs(type: CompetitionType): number {
  return type === "cup" || type === "supercup" ? 150 * MIN : 120 * MIN;
}

/** Incerteza máxima de uma hora não confirmada (fuso da fonte desconhecido). */
export const UNCONFIRMED_SLACK_MS = 12 * 60 * MIN;

/**
 * Estado de um jogo com resultado publicado. No futuro nunca é final (amostras com resultado em jogos por jogar).
 * Hora confirmada: LIVE até `gameDurationMs` depois do início, depois final. Hora não confirmada: não se infere o
 * estado da hora; só é final quando nem a pior hora possível (+12 h) o deixa a decorrer; no meio fica NS sem resultado.
 */
export function statusFromScore(
  o: { kickoff: Date; exact: boolean; now: Date; hasScore: boolean; type: CompetitionType; finalStatus?: GameStatus },
): GameStatus {
  const t = o.now.getTime();
  const k = o.kickoff.getTime();
  const final = o.finalStatus ?? "FT";
  if (!o.hasScore) return "NS";
  const slack = o.exact ? 0 : UNCONFIRMED_SLACK_MS;
  if (k - slack > t) return "NS";
  if (t >= k + slack + gameDurationMs(o.type)) return final;
  return o.exact ? "LIVE" : "NS";
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
