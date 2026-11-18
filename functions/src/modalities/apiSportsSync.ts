import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { crestForSportTeam } from "../config/brand";
import { competitionKey, competitionLabel, roundLabel } from "../model/labels";
import { apiSportsSeason } from "../model/seasons";
import { FINAL_STATUSES, apiSportsStatus } from "../model/status";
import type { MatchDoc, Pair, TeamRef } from "../model/types";
import type { ApiSportsClient, ApiSportsSport as Sport } from "../sources/apiSports";
import { fromFirestore, saveMatch, writeDocs } from "../store/writer";
import { recordRun } from "../store/health";
import { isQuotaError } from "../football/competitionSync";
import { API_SPORTS, type ApiSportsSport as SportConfig } from "./sourcesConfig";

export type ApiSportsConfig = Record<Sport, SportConfig>;

const SPORTS: Sport[] = ["handball", "volleyball", "basketball"];
const PREFIX: Record<Sport, "hb_" | "vb_" | "bb_"> = { handball: "hb_", volleyball: "vb_", basketball: "bb_" };
/** Duração típica, para estimar o apito final (a API não dá a hora). */
const DURATION_MIN: Record<Sport, number> = { handball: 100, volleyball: 120, basketball: 130 };

const MIN = 60_000;
const HOUR = 3_600_000;
const BEFORE_MS = 15 * MIN;
const AFTER_MS = 3 * HOUR;
const IDLE_MS = 3 * HOUR;
const STANDINGS_MS = 6 * HOUR;
/** Abaixo disto pára-se a modalidade: a quota gratuita é de 100 pedidos por dia por modalidade. */
export const MIN_REMAINING = 10;

type Num = number | null | undefined;
type Pairish = { home?: Num; away?: Num } | null | undefined;
/** Pontos/golos: número simples (andebol, voleibol) ou objeto por período com `total` (basquetebol). */
type Points = number | null | { total?: Num; quarter_1?: Num; quarter_2?: Num; [k: string]: Num } | undefined;

/** Jogo da API-Sports (campos usados). Forma por confirmar com respostas reais (Task 21). */
export interface ApiSportsGame {
  id: number;
  date: string;
  timestamp?: number | null;
  week?: string | null;
  status: { long?: string; short: string };
  league: { id: number | null; name: string; type?: string; season?: string | number | null };
  teams: { home: { id: number; name: string; logo?: string | null }; away: { id: number; name: string; logo?: string | null } };
  scores: { home?: Points; away?: Points };
  periods?: Record<string, Pairish> | null;
}

function total(p: Points): number | null {
  if (p === null || p === undefined) return null;
  if (typeof p === "number") return Number.isFinite(p) ? p : null;
  return typeof p.total === "number" ? p.total : null;
}

const SET_KEYS = ["first", "second", "third", "fourth", "fifth"];

function setsOf(periods: ApiSportsGame["periods"]): Pair[] {
  const out: Pair[] = [];
  for (const k of SET_KEYS) {
    const p = periods?.[k];
    if (p && typeof p.home === "number" && typeof p.away === "number") out.push({ home: p.home, away: p.away });
  }
  return out;
}

function halftimeOf(sport: Sport, g: ApiSportsGame): Pair | null {
  if (sport === "handball") {
    const p = g.periods?.first;
    return p && typeof p.home === "number" && typeof p.away === "number" ? { home: p.home, away: p.away } : null;
  }
  if (sport === "basketball") {
    const sum = (side: Points) => {
      if (!side || typeof side === "number") return null;
      const a = side.quarter_1;
      const b = side.quarter_2;
      return typeof a === "number" && typeof b === "number" ? a + b : null;
    };
    const home = sum(g.scores.home);
    const away = sum(g.scores.away);
    return home !== null && away !== null ? { home, away } : null;
  }
  return null;
}

function kickoffOf(g: ApiSportsGame): Date {
  const ts = g.timestamp;
  const d = typeof ts === "number" && Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000) : new Date(g.date);
  if (Number.isNaN(d.getTime())) throw new Error(`apiSports: jogo ${g.id} sem data de início válida`);
  return d;
}

/**
 * Jogo da API-Sports no modelo novo. `sportingTeamId` é o id do Sporting nessa API (por omissão o de
 * `API_SPORTS`); sem ele, ou se não jogar neste jogo, lança. Voleibol: `score` = sets ganhos e `score.sets` = parciais.
 */
export function mapApiSportsGame(sport: Sport, g: ApiSportsGame, sportingTeamId: number | null = API_SPORTS[sport].teamId): MatchDoc {
  if (sportingTeamId === null) throw new Error(`apiSports: id do Sporting em ${sport} por confirmar`);
  const sportingSide = g.teams.home.id === sportingTeamId ? "home" : g.teams.away.id === sportingTeamId ? "away" : null;
  if (sportingSide === null) throw new Error(`apiSports: jogo ${g.id} de ${sport} sem o Sporting (${sportingTeamId})`);

  const team = (t: ApiSportsGame["teams"]["home"]): TeamRef => ({ id: String(t.id), name: t.name, logo: crestForSportTeam(sportingTeamId, t.id, t.logo ?? null) });
  const status = apiSportsStatus(sport, g.status.short);
  const kickoff = kickoffOf(g);
  const label = competitionLabel(sport, g.league.id, g.league.name);
  const season = String(g.league.season ?? "");
  const round = g.week ?? null;
  const sets = sport === "volleyball" ? setsOf(g.periods) : [];

  const finished = FINAL_STATUSES.has(status);
  return {
    id: `${PREFIX[sport]}${g.id}`,
    sport,
    competition: {
      key: competitionKey(sport, g.league.id, season),
      id: String(g.league.id ?? ""),
      name: label.name,
      type: label.type,
      season,
      round,
      roundLabel: roundLabel(round, label.type),
    },
    home: team(g.teams.home),
    away: team(g.teams.away),
    sportingSide,
    kickoff,
    status,
    statusRaw: g.status.short,
    elapsed: null,
    elapsedExtra: null,
    score: {
      home: total(g.scores.home),
      away: total(g.scores.away),
      halftime: halftimeOf(sport, g),
      extratime: null,
      penalty: null,
      ...(sport === "volleyball" ? { sets } : {}),
    },
    // Determinístico (o hash por jogo não muda a cada execução): início + duração típica.
    finishedAt: finished ? new Date(kickoff.getTime() + DURATION_MIN[sport] * MIN) : null,
    finishedAtSource: finished ? "estimated" : null,
    referee: null,
    source: { provider: `api-${sport}`, id: String(g.id) },
  };
}

/** Verdadeiro com um jogo em `[início - 15 min, início + 3 h]` ou sem execução nas últimas 3 h. */
export function apiSportsDue(state: { lastRunAt: Date | null }, matches: Pick<MatchDoc, "kickoff">[], now: Date): boolean {
  const t = now.getTime();
  if (matches.some((m) => t >= m.kickoff.getTime() - BEFORE_MS && t <= m.kickoff.getTime() + AFTER_MS)) return true;
  return state.lastRunAt === null || t - state.lastRunAt.getTime() > IDLE_MS;
}

interface StandingsRow {
  position?: number;
  group?: { name?: string } | null;
  stage?: string;
  team: { id: number; name: string; logo?: string | null };
  games?: { played?: Num; win?: { total?: Num }; draw?: { total?: Num }; lost?: { total?: Num }; lose?: { total?: Num } };
  goals?: { for?: Num; against?: Num };
  points?: Points | { for?: Num; against?: Num };
  form?: string | null;
  description?: string | null;
}

function standingsGroups(response: unknown[], sportingTeamId: number | null) {
  const arrays = (response.length > 0 && Array.isArray(response[0]) ? response : [response]) as StandingsRow[][];
  return arrays
    .filter((rows) => rows.length > 0)
    .map((rows) => ({
      name: rows[0].group?.name ?? rows[0].stage ?? "",
      rows: rows.map((r) => {
        const pts = typeof r.points === "number" ? r.points : null;
        const objPoints = r.points && typeof r.points === "object" ? (r.points as { for?: Num; against?: Num }) : null;
        const gf = r.goals?.for ?? objPoints?.for ?? null;
        const ga = r.goals?.against ?? objPoints?.against ?? null;
        return {
          rank: r.position ?? null,
          teamId: String(r.team.id),
          name: r.team.name,
          logo: crestForSportTeam(sportingTeamId, r.team.id, r.team.logo ?? null),
          points: pts,
          played: r.games?.played ?? null,
          win: r.games?.win?.total ?? null,
          draw: r.games?.draw?.total ?? null,
          lose: (r.games?.lost ?? r.games?.lose)?.total ?? null,
          goalsFor: gf,
          goalsAgainst: ga,
          goalsDiff: typeof gf === "number" && typeof ga === "number" ? gf - ga : null,
          form: r.form ?? null,
          description: r.description ?? null,
        };
      }),
    }));
}

export interface ApiSportsDeps {
  db: Firestore;
  clients: Record<Sport, ApiSportsClient>;
  now: () => Date;
  /** Por omissão `API_SPORTS`; os testes injetam ids e `enabled`. */
  config?: ApiSportsConfig;
}

export interface ApiSportsResult {
  count: number;
  failed: number;
  /** Menor `remaining` conhecido entre as modalidades (para o alerta de quota). */
  remaining: number | null;
  remainingBySport: Record<Sport, number | null>;
}

interface SportState {
  lastRunAt: Date | null;
  lastStandingsAt: Date | null;
  /** `remaining` no fim da execução anterior (cada execução começa com um cliente novo, sem esse valor). */
  lastRemaining: number | null;
}

const stateRef = (db: Firestore, sport: Sport) => db.doc(`ingestState/apisports_state_${sport}`);

async function readState(db: Firestore, sport: Sport): Promise<SportState> {
  const snap = await stateRef(db, sport).get();
  const get = (k: string) => {
    const v = snap.get(k);
    return v ? fromFirestore(v as Date) : null;
  };
  const rem = snap.get("lastRemaining");
  return { lastRunAt: get("lastRunAt"), lastStandingsAt: get("lastStandingsAt"), lastRemaining: typeof rem === "number" ? rem : null };
}

async function sportMatchesNear(db: Firestore, sport: Sport, now: Date): Promise<MatchDoc[]> {
  const snap = await db
    .collection("matches")
    .where("sport", "==", sport)
    .where("kickoff", ">=", new Date(now.getTime() - AFTER_MS))
    .where("kickoff", "<=", new Date(now.getTime() + BEFORE_MS))
    .orderBy("kickoff", "asc")
    .get();
  return snap.docs.map((s) => fromFirestore(s.data() as MatchDoc));
}

/** Setembro a junho em Lisboa: época em que as modalidades devem ter jogos. */
function inSeason(now: Date): boolean {
  const month = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", month: "numeric" }).format(now));
  return month >= 9 || month <= 6;
}

async function syncOne(d: ApiSportsDeps, sport: Sport, cfg: SportConfig, now: Date, state: SportState): Promise<{ count: number; failed: number }> {
  const client = d.clients[sport];
  const season = apiSportsSeason(cfg.seasonFormat, now);
  const teamId = cfg.teamId as number;
  const skipLeagues = new Set(cfg.leagues.filter((l) => l.covered === false && l.id !== null).map((l) => l.id));

  const games = (await client.games({ team: teamId, season })) as ApiSportsGame[];
  let count = 0;
  let failed = 0;
  for (const g of games) {
    if (g.league.id !== null && skipLeagues.has(g.league.id)) continue;
    try {
      await saveMatch(d.db, { match: mapApiSportsGame(sport, g, teamId) });
      count++;
    } catch (e) {
      failed++;
      logger.warn(`apiSportsSync: jogo ${g.id} de ${sport} ignorado: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Classificações de 6 em 6 horas, só das ligas confirmadas como cobertas (id conhecido, covered !== false).
  const stale = state.lastStandingsAt === null || now.getTime() - state.lastStandingsAt.getTime() >= STANDINGS_MS;
  if (stale) {
    for (const league of cfg.leagues) {
      if (league.id === null || league.covered === false) continue;
      if (client.remaining !== null && client.remaining < MIN_REMAINING) break;
      const response = await client.standings({ league: league.id, season });
      const groups = standingsGroups(response, teamId);
      if (groups.length === 0) continue;
      const key = competitionKey(sport, league.id, season);
      const label = competitionLabel(sport, league.id, league.name);
      const writes = [
        { path: `competitions/${key}`, data: { sport, leagueId: league.id, name: label.name, type: label.type } as DocumentData, merge: true },
        { path: `competitions/${key}/data/standings`, data: { groups } as DocumentData },
      ];
      await writeDocs(d.db, writes, { stateKey: `standings_${key}` });
    }
    await stateRef(d.db, sport).set({ lastStandingsAt: now }, { merge: true });
  }
  return { count, failed };
}

/**
 * Andebol, voleibol e basquetebol. Por modalidade: se ligada, com id da equipa e `apiSportsDue`, pede os jogos
 * da época e grava-os; as classificações vêm de 6 em 6 horas. Uma modalidade que falha não trava as outras
 * (só lança se todas as que correram falharem). Uma modalidade com menos de 10 pedidos restantes pára.
 */
export async function syncApiSports(d: ApiSportsDeps): Promise<ApiSportsResult> {
  const now = d.now();
  const config = d.config ?? API_SPORTS;
  const remainingBySport: Record<Sport, number | null> = { handball: null, volleyball: null, basketball: null };
  let count = 0;
  let failed = 0;
  let attempted = 0;
  let threw = 0;

  for (const sport of SPORTS) {
    const cfg = config[sport];
    if (!cfg.enabled || cfg.teamId === null) continue;
    const state = await readState(d.db, sport);
    // Quota quase esgotada na execução anterior: não gastar o resto; volta a sondar passadas 3 h.
    if (state.lastRemaining !== null && state.lastRemaining < MIN_REMAINING && state.lastRunAt !== null && now.getTime() - state.lastRunAt.getTime() < IDLE_MS) continue;
    if (!apiSportsDue(state, await sportMatchesNear(d.db, sport, now), now)) continue;

    attempted++;
    const client = d.clients[sport];
    const health = `apisports_${sport}`;
    const opts = { expectNonZero: inSeason(now), minRemaining: MIN_REMAINING };
    try {
      const r = await syncOne(d, sport, cfg, now, state);
      count += r.count;
      failed += r.failed;
      remainingBySport[sport] = client.remaining;
      await recordRun(d.db, health, { ok: true, count: r.count, remaining: client.remaining, failed: r.failed }, opts);
    } catch (e) {
      threw++;
      failed++;
      remainingBySport[sport] = client.remaining;
      const error = e instanceof Error ? e.message : String(e);
      logger.warn(`apiSportsSync: ${sport} falhou${isQuotaError(e) ? " (quota)" : ""}: ${error}`);
      await recordRun(d.db, health, { ok: false, error });
    }
    await stateRef(d.db, sport).set({ lastRunAt: now, lastRemaining: remainingBySport[sport] }, { merge: true });
  }

  if (attempted > 0 && threw === attempted) throw new Error(`apiSportsSync: as ${threw} modalidades falharam`);
  const known = Object.values(remainingBySport).filter((v): v is number => v !== null);
  return { count, failed, remaining: known.length > 0 ? Math.min(...known) : null, remainingBySport };
}
