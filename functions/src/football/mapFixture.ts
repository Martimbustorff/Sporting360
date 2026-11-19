import { logger } from "firebase-functions";
import { SPORTING_TEAM_ID, crestFor } from "../config/brand";
import { competitionKey, competitionLabel, roundLabel } from "../model/labels";
import { FINAL_STATUSES, LIVE_STATUSES, footballStatus } from "../model/status";
import type { MatchDoc, Pair, TeamRef } from "../model/types";
import { tvForFixture } from "./tvChannel";
import type { AfEvent, AfFixture, AfFixturePlayers, AfLineup, AfLineupPlayer, AfTeamRef } from "../sources/apiFootball.types";

export interface EventItem {
  minute: number;
  extra: number | null;
  teamId: string;
  playerId: string | null;
  playerName: string | null;
  assistId: string | null;
  assistName: string | null;
  type: "goal" | "card" | "subst" | "var" | "other";
  detail: string;
  comments: string | null;
}

export interface LineupPlayer {
  playerId: string;
  name: string;
  number: number | null;
  pos: string | null;
  grid: string | null;
}

export interface PlayerStatLine {
  playerId: string;
  name: string;
  photo: string | null;
  number: number | null;
  position: string | null;
  minutes: number | null;
  rating: number | null;
  goals: number;
  assists: number;
  saves: number;
  passesAccuracy: number | null;
  tackles: number;
  foulsCommitted: number;
  cardsYellow: number;
  cardsRed: number;
  substitute: boolean;
}

export interface FootballDetails {
  events: { items: EventItem[] } | null;
  statistics: { teams: { teamId: string; items: Record<string, string | number | null> }[]; xg: Pair | null } | null;
  lineups: {
    teams: {
      teamId: string;
      formation: string | null;
      coach: { id: string | null; name: string; photo: string | null } | null;
      startXI: LineupPlayer[];
      substitutes: LineupPlayer[];
    }[];
  } | null;
  players: { teams: { teamId: string; players: PlayerStatLine[] }[] } | null;
}

export interface MapContext {
  now: Date;
  previous: Pick<MatchDoc, "status" | "finishedAt" | "finishedAtSource"> | null;
  /** O ticker viu o jogo a decorrer (estado LIVE/HT) antes deste fim. */
  observedLive: boolean;
  /** Exceções de canal de TV (`config/tvChannels`), lidas uma vez por execução por quem chama. Omitido: nenhuma. */
  tvOverrides?: Record<string, string>;
}

const MIN = 60_000;

/**
 * Hora estimada do apito final: início da 2.ª parte + 50 min (ou kickoff + 110 min se a API não a deu),
 * +35 min com prolongamento/penáltis. Nunca depois de `now`.
 */
export function estimateFinishedAt(f: AfFixture, now: Date): Date {
  const second = f.fixture.periods.second;
  let ms = second !== null && second !== undefined ? second * 1000 + 50 * MIN : f.fixture.timestamp * 1000 + 110 * MIN;
  const short = f.fixture.status.short.trim().toUpperCase();
  if (short === "AET" || short === "PEN") ms += 35 * MIN;
  return new Date(Math.min(ms, now.getTime()));
}

function pair(p: { home: number | null; away: number | null } | null | undefined): Pair | null {
  if (!p || (p.home === null && p.away === null)) return null;
  return { home: p.home, away: p.away };
}

function teamRef(t: AfTeamRef): TeamRef {
  return { id: String(t.id), name: t.name, logo: crestFor(t.id, t.logo ?? null) };
}

function str(v: number | string | null | undefined): string | null {
  return v === null || v === undefined ? null : String(v);
}

function finish(f: AfFixture, status: MatchDoc["status"], ctx: MapContext): Pick<MatchDoc, "finishedAt" | "finishedAtSource"> {
  if (!FINAL_STATUSES.has(status)) return { finishedAt: null, finishedAtSource: null };
  const prev = ctx.previous;
  if (prev?.finishedAt) return { finishedAt: prev.finishedAt, finishedAtSource: prev.finishedAtSource ?? "estimated" };
  // Se o jogo só foi visto como final por um cálculo do calendário, "observed" pode chegar tarde (hora desse cálculo).
  if (ctx.observedLive || (prev !== null && LIVE_STATUSES.has(prev.status))) {
    return { finishedAt: ctx.now, finishedAtSource: "observed" };
  }
  return { finishedAt: estimateFinishedAt(f, ctx.now), finishedAtSource: "estimated" };
}

/**
 * Resultado que conta. Em AET/PEN é tempo regulamentar + prolongamento (nunca os penáltis); se a API
 * trouxer `goals` diferente disso, prevalece a soma e fica um aviso. Em PEN um resultado contado não
 * empatado também avisa. O resultado guardado mantém tempo regulamentar + prolongamento; a liquidação
 * do Plano 1 (game/result.ts) força empate em PEN.
 */
function countedScore(f: AfFixture, status: MatchDoc["status"]): { home: number | null; away: number | null } {
  const goals = { home: f.goals.home ?? null, away: f.goals.away ?? null };
  if (status !== "AET" && status !== "PEN") return goals;
  const ft = f.score.fulltime;
  const et = f.score.extratime;
  if (ft?.home == null || ft.away == null || et?.home == null || et.away == null) return goals;
  const counted = { home: ft.home + et.home, away: ft.away + et.away };
  if (counted.home !== goals.home || counted.away !== goals.away) {
    logger.warn(`mapFixture: jogo ${f.fixture.id} com goals ${goals.home}-${goals.away} diferente de fulltime+extratime ${counted.home}-${counted.away}; usa-se a soma`);
  }
  if (status === "PEN" && counted.home !== counted.away) {
    logger.warn(`mapFixture: jogo ${f.fixture.id} em PEN com resultado contado ${counted.home}-${counted.away} sem empate`);
  }
  return counted;
}

function kickoffOf(f: AfFixture): Date {
  const ts = f.fixture.timestamp;
  const d = typeof ts === "number" && Number.isFinite(ts) ? new Date(ts * 1000) : new Date(f.fixture.date);
  if (Number.isNaN(d.getTime())) throw new Error(`mapFixture: fixture ${f.fixture.id} sem data de início válida`);
  return d;
}

function eventType(t: string): EventItem["type"] {
  switch (t.trim().toLowerCase()) {
    case "goal": return "goal";
    case "card": return "card";
    case "subst": return "subst";
    case "var": return "var";
    default: return "other";
  }
}

function mapEvent(e: AfEvent): EventItem {
  return {
    minute: e.time.elapsed,
    extra: e.time.extra ?? null,
    teamId: String(e.team.id),
    playerId: str(e.player?.id),
    playerName: e.player?.name ?? null,
    // Na substituição, `assist` é quem entra.
    assistId: str(e.assist?.id),
    assistName: e.assist?.name ?? null,
    type: eventType(e.type),
    detail: e.detail,
    comments: e.comments ?? null,
  };
}

function lineupPlayer(p: AfLineupPlayer): LineupPlayer {
  return {
    playerId: String(p.player.id),
    name: p.player.name,
    number: p.player.number ?? null,
    pos: p.player.pos ?? null,
    grid: p.player.grid ?? null,
  };
}

function mapLineup(l: AfLineup) {
  return {
    teamId: String(l.team.id),
    formation: l.formation ?? null,
    coach: l.coach && l.coach.name ? { id: str(l.coach.id), name: l.coach.name, photo: l.coach.photo ?? null } : null,
    startXI: (l.startXI ?? []).map(lineupPlayer),
    substitutes: (l.substitutes ?? []).map(lineupPlayer),
  };
}

function num(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) return null;
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function mapPlayers(t: AfFixturePlayers) {
  return {
    teamId: String(t.team.id),
    players: t.players.map((p): PlayerStatLine => {
      const s = p.statistics[0];
      const passes = (s?.passes ?? {}) as { accuracy?: unknown };
      const tackles = (s?.tackles ?? {}) as { total?: unknown };
      const fouls = (s?.fouls ?? {}) as { committed?: unknown };
      return {
        playerId: String(p.id),
        name: p.name,
        photo: p.photo ?? null,
        number: s?.games.number ?? null,
        position: s?.games.position ?? null,
        minutes: s?.games.minutes ?? null,
        rating: numOrNull(s?.games.rating),
        goals: num(s?.goals.total),
        assists: num(s?.goals.assists),
        saves: num(s?.goals.saves),
        passesAccuracy: numOrNull(passes.accuracy),
        tackles: num(tackles.total),
        foulsCommitted: num(fouls.committed),
        cardsYellow: num(s?.cards.yellow),
        cardsRed: num(s?.cards.red),
        substitute: s?.games.substitute ?? false,
      };
    }),
  };
}

function expectedGoals(f: AfFixture): Pair | null {
  const read = (teamId: number): number | null => {
    const t = f.statistics.find((s) => s.team.id === teamId);
    return numOrNull(t?.statistics.find((x) => x.type === "expected_goals")?.value);
  };
  return pair({ home: read(f.teams.home.id), away: read(f.teams.away.id) });
}

function mapDetails(f: AfFixture): FootballDetails {
  const events = f.events ?? [];
  const statistics = f.statistics ?? [];
  const lineups = f.lineups ?? [];
  const players = f.players ?? [];
  return {
    events: events.length ? { items: events.map(mapEvent) } : null,
    statistics: statistics.length
      ? {
          teams: statistics.map((s) => ({
            teamId: String(s.team.id),
            items: Object.fromEntries(s.statistics.map((x) => [x.type, x.value ?? null])),
          })),
          xg: expectedGoals(f),
        }
      : null,
    lineups: lineups.length ? { teams: lineups.map(mapLineup) } : null,
    players: players.length ? { teams: players.map(mapPlayers) } : null,
  };
}

export function mapFixture(f: AfFixture, ctx: MapContext): { match: MatchDoc; details: FootballDetails } {
  const status = footballStatus(f.fixture.status.short);
  const season = String(f.league.season);
  const label = competitionLabel("football", f.league.id, f.league.name);
  const v = f.fixture.venue;
  if (f.teams.home.id !== SPORTING_TEAM_ID && f.teams.away.id !== SPORTING_TEAM_ID) {
    logger.warn(`mapFixture: jogo ${f.fixture.id} sem a equipa ${SPORTING_TEAM_ID}; sportingSide assume "away"`);
  }
  const counted = countedScore(f, status);
  const match: MatchDoc = {
    id: String(f.fixture.id),
    sport: "football",
    competition: {
      key: competitionKey("football", f.league.id, season),
      id: String(f.league.id),
      name: label.name,
      type: label.type,
      season,
      round: f.league.round ?? null,
      roundLabel: roundLabel(f.league.round ?? null, label.type),
    },
    home: teamRef(f.teams.home),
    away: teamRef(f.teams.away),
    sportingSide: f.teams.home.id === SPORTING_TEAM_ID ? "home" : "away",
    tv: tvForFixture(f, ctx.tvOverrides ?? {}),
    kickoff: kickoffOf(f),
    status,
    statusRaw: f.fixture.status.short,
    elapsed: f.fixture.status.elapsed ?? null,
    elapsedExtra: f.fixture.status.extra ?? null,
    score: {
      home: counted.home,
      away: counted.away,
      halftime: pair(f.score.halftime),
      extratime: pair(f.score.extratime),
      penalty: pair(f.score.penalty),
    },
    ...finish(f, status, ctx),
    // Sem capacity/image: são escritos pela Task 11 e o merge preserva-os. Sem nome, o campo omite-se.
    ...(v && v.name ? { venue: { id: str(v.id), name: v.name, city: v.city ?? null } } : {}),
    referee: f.fixture.referee ?? null,
    source: { provider: "api-football", id: String(f.fixture.id) },
  };
  return { match, details: mapDetails(f) };
}
