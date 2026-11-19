import type { Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { SPORTING_TEAM_ID } from "../config/brand";

// Canal de TV do jogo (Plano 9). Sem pedidos à API: sai da liga, da época, do nome da equipa da casa e das exceções
// manuais em `config/tvChannels` = { overrides: { [matchId]: texto } }.

export const LIGA_PORTUGAL_ID = 94;
export const TV_SEASON = 2026;
const DEFAULT_CHANNEL = "SPORT TV";

const norm = (s: string): string =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Canal de um jogo do Sporting. Exceção (qualquer jogo, qualquer competição) ganha à regra; texto vazio dá null.
 * Regra: só Liga Portugal (94) na época 2026; casa "benfica" -> BTV, casa "moreirense" -> TVI / V+; senão SPORT TV.
 */
export function resolveTvChannel(
  m: { leagueId: number; season: number; homeName: string; awayName: string },
  overrides: Record<string, string>,
  matchId: string,
): string | null {
  if (Object.prototype.hasOwnProperty.call(overrides, matchId)) {
    const t = typeof overrides[matchId] === "string" ? overrides[matchId]!.trim() : "";
    return t === "" ? null : t;
  }
  if (m.leagueId !== LIGA_PORTUGAL_ID || m.season !== TV_SEASON) return null;
  const home = norm(m.homeName);
  if (home.includes("benfica")) return "BTV";
  if (home.includes("moreirense")) return "TVI / V+";
  return DEFAULT_CHANNEL;
}

/** Canal de um fixture: a regra só vale quando o Sporting joga; as exceções valem para qualquer jogo. */
export function tvForFixture(
  f: { fixture: { id: number }; league: { id: number; season: number }; teams: { home: { id: number; name: string }; away: { id: number; name: string } } },
  overrides: Record<string, string>,
): string | null {
  const id = String(f.fixture.id);
  const sportingPlays = f.teams.home.id === SPORTING_TEAM_ID || f.teams.away.id === SPORTING_TEAM_ID;
  if (!sportingPlays && !Object.prototype.hasOwnProperty.call(overrides, id)) return null;
  return resolveTvChannel(
    { leagueId: f.league.id, season: f.league.season, homeName: f.teams.home.name, awayName: f.teams.away.name },
    overrides,
    id,
  );
}

/** Lê `config/tvChannels`; ausente ou mal formado dá {}. Quem chama lê no máximo uma vez por execução. */
export async function loadTvOverrides(db: Firestore): Promise<Record<string, string>> {
  const raw = (await db.doc("config/tvChannels").get()).get("overrides") as unknown;
  if (typeof raw !== "object" || raw === null) return {};
  return Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter(([, v]) => typeof v === "string")) as Record<string, string>;
}

/**
 * Como loadTvOverrides, mas nunca bloqueia os resultados: se a leitura falhar, um aviso sem ids nem caminhos e devolve
 * `null` ("exceções indisponíveis"), para quem escreve manter o `tv` já guardado em vez de o recalcular sem exceções.
 */
export async function loadTvOverridesSafe(db: Firestore): Promise<Record<string, string> | null> {
  try {
    return await loadTvOverrides(db);
  } catch {
    logger.warn("TV_OVERRIDES_UNAVAILABLE");
    return null;
  }
}
