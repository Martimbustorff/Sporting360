import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { crestFor } from "../config/brand";
import { LIVE_STATUSES } from "../model/status";
import type { MatchDoc } from "../model/types";
import type { AfFixture, AfLineup, AfLineupPlayer, AfTeamRef } from "../sources/apiFootball.types";

/**
 * Documentos das coleções antigas (as que a V2 lê), no formato exato das functions antigas.
 * Chave = id do documento, valor = conteúdo. Mapa vazio = "sem dados" (o escritor não apaga nada).
 * O nome `stastistics` é o da coleção em produção (erro de ortografia mantido de propósito).
 */
export interface LegacyDocs {
  games: Record<string, DocumentData>;
  summaries: Record<string, DocumentData>;
  stastistics: Record<string, DocumentData>;
  lineups: Record<string, DocumentData>;
  players: Record<string, DocumentData>;
}

export interface LegacyExisting {
  channel?: string;
}

const GAME_WINDOW_MS = 150 * 60_000;

function logoOf(t: AfTeamRef): string {
  return crestFor(t.id, t.logo ?? null) ?? "";
}

function teamBlock(t: AfTeamRef) {
  return { name: t.name, logo: logoOf(t), api: String(t.id) };
}

/** `round.split("-")[1]` (com o espaço inicial) como as functions antigas; senão a ronda; senão "". */
function journeyOf(round: string | null | undefined): string {
  if (!round) return "";
  return round.split("-")[1] ? round.split("-")[1] : round;
}

function scoreStr(v: number | null): string {
  return v === null || v === undefined ? "0" : String(v);
}

/**
 * games/{fixtureId}. `channel` vem do documento existente (preserva o valor manual) e só cai para ""
 * quando o jogo ainda não existe. `isActive` e `endTime` usam o estado real (e não a janela fixa de 150 min).
 */
export function legacyGame(f: AfFixture, match: MatchDoc, existing: LegacyExisting | null): DocumentData {
  const kickoff = match.kickoff;
  const end = match.finishedAt ?? new Date(kickoff.getTime() + GAME_WINDOW_MS);
  return {
    api: String(f.fixture.id),
    timestamp: Timestamp.fromDate(kickoff),
    teamhome: teamBlock(f.teams.home),
    teamaway: teamBlock(f.teams.away),
    scorehome: scoreStr(match.score.home),
    scoreaway: scoreStr(match.score.away),
    competition: f.league.name,
    season: String(f.league.season),
    channel: existing?.channel ?? "",
    elapsedTime: match.elapsed ? String(match.elapsed) : "0",
    journey: journeyOf(f.league.round),
    isActive: LIVE_STATUSES.has(match.status),
    startTime: kickoff.toISOString(),
    endTime: end.toISOString(),
    _ingest: "v2027",
  };
}

function legacySummaries(f: AfFixture, gameId: string): Record<string, DocumentData> {
  const out: Record<string, DocumentData> = {};
  for (const e of f.events ?? []) {
    const api = `${e.player?.id ?? null}_${e.team.name}_${gameId}_${e.detail}_${e.time.elapsed}`;
    const assistId = e.assist?.id;
    out[api] = {
      api,
      detail: e.detail,
      GameId: gameId,
      type: e.type,
      time: String(e.time.elapsed),
      player: { name: e.player?.name ?? "", api: String(e.player?.id ?? null), logo: "" },
      playerSub: {
        name: e.assist?.name ?? "",
        api: assistId === null || assistId === undefined ? "" : String(assistId),
        logo: "",
      },
      team: { name: e.team.name, api: String(e.team.id), logo: logoOf(e.team) },
    };
  }
  return out;
}

function legacyStatistics(f: AfFixture, gameId: string): Record<string, DocumentData> {
  const out: Record<string, DocumentData> = {};
  for (const s of f.statistics ?? []) {
    for (const item of s.statistics) {
      const api = `${s.team.id}_${gameId}_${item.type}`;
      out[api] = {
        api,
        GameId: gameId,
        team: teamBlock(s.team),
        type: item.type,
        value: String(item.value),
      };
    }
  }
  return out;
}

function lineupMember(p: AfLineupPlayer) {
  return {
    playerId: String(p.player.id),
    number: p.player.number ?? null,
    name: p.player.name,
    grid: p.player.grid ?? null,
    position: String(p.player.pos),
  };
}

function legacyLineups(f: AfFixture, gameId: string): Record<string, DocumentData> {
  const out: Record<string, DocumentData> = {};
  for (const l of f.lineups ?? []) {
    const id = `${l.team.id}_${gameId}`;
    out[id] = {
      GameId: gameId,
      id,
      startXI: (l.startXI ?? []).map(lineupMember),
      substitutes: (l.substitutes ?? []).map(lineupMember),
      teamId: String(l.team.id),
      formation: l.formation || "",
    };
  }
  return out;
}

function text(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

function count(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

function numberOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Plantel mínimo a partir do onze (amigáveis e jogos sem /fixtures/players). */
function minimalRoster(l: AfLineup, gameId: string): DocumentData {
  const members = [
    ...(l.startXI ?? []).map((m) => ({ m, substitute: false })),
    ...(l.substitutes ?? []).map((m) => ({ m, substitute: true })),
  ];
  return {
    GameId: gameId,
    id: `${l.team.id}_${gameId}`,
    teamId: l.team.id,
    Players: members.map(({ m, substitute }) => ({
      playerId: String(m.player.id),
      number: m.player.number ?? null,
      name: m.player.name,
      photo: "",
      position: String(m.player.pos),
      rating: "",
      goals: 0,
      assists: 0,
      saves: 0,
      passesAccuracy: "",
      tackles: 0,
      foulsCommitted: 0,
      cardsYellow: 0,
      cardsRed: 0,
      teamId: l.team.id,
      grid: m.player.grid || "",
      minutes: 0,
      substitute,
    })),
  };
}

function legacyPlayers(f: AfFixture, gameId: string): Record<string, DocumentData> {
  const out: Record<string, DocumentData> = {};
  const lineups = f.lineups ?? [];
  const teams = f.players ?? [];

  if (teams.length === 0) {
    for (const l of lineups) out[`${l.team.id}_${gameId}`] = minimalRoster(l, gameId);
    return out;
  }

  // Substituições: `player` sai, `assist` entra.
  const substs = (f.events ?? []).filter((e) => e.type.trim().toLowerCase() === "subst");
  for (const t of teams) {
    const lineup = lineups.find((l) => l.team.id === t.team.id);
    const startGrid = (playerId: string): string | null =>
      lineup?.startXI.find((x) => String(x.player.id) === playerId)?.player.grid ?? null;
    const id = `${t.team.id}_${gameId}`;
    out[id] = {
      GameId: gameId,
      id,
      teamId: t.team.id,
      Players: t.players.map((p) => {
        const s = p.statistics?.[0];
        const playerId = String(p.player.id);
        // `games.substitute` vem sempre false na API real: com onze conhecido, suplente é quem não é titular.
        const isSub = lineup && lineup.startXI.length ? !lineup.startXI.some((x) => String(x.player.id) === playerId) : s?.games?.substitute === true;
        let grid = "";
        if (isSub) {
          const out1 = substs.find((e) => e.assist?.id !== null && e.assist?.id !== undefined && String(e.assist.id) === playerId);
          grid = (out1 && out1.player?.id != null ? startGrid(String(out1.player.id)) : null) ?? startGrid(playerId) ?? "";
        } else {
          grid = startGrid(playerId) ?? "";
        }
        const passes = (s?.passes ?? {}) as { accuracy?: unknown };
        const tackles = (s?.tackles ?? {}) as { total?: unknown };
        const fouls = (s?.fouls ?? {}) as { committed?: unknown };
        const rating = s?.games?.rating;
        return {
          playerId,
          number: numberOrNull(s?.games?.number),
          name: p.player.name,
          photo: text(p.player.photo),
          position: text(s?.games?.position),
          rating: rating === null || rating === undefined || String(rating).trim() === "" ? null : String(rating),
          goals: count(s?.goals?.total),
          assists: count(s?.goals?.assists),
          saves: count(s?.goals?.saves),
          passesAccuracy: text(passes.accuracy),
          tackles: count(tackles.total),
          foulsCommitted: count(fouls.committed),
          cardsYellow: count(s?.cards?.yellow),
          cardsRed: count(s?.cards?.red),
          teamId: t.team.id,
          grid,
          minutes: count(s?.games?.minutes),
          substitute: isSub,
        };
      }),
    };
  }
  return out;
}

/** Todos os documentos das coleções antigas para um jogo (um fixture completo da API-Football). */
export function legacyFromFixture(f: AfFixture, match: MatchDoc, existing: LegacyExisting | null): LegacyDocs {
  const gameId = String(f.fixture.id);
  return {
    games: { [gameId]: legacyGame(f, match, existing) },
    summaries: legacySummaries(f, gameId),
    stastistics: legacyStatistics(f, gameId),
    lineups: legacyLineups(f, gameId),
    players: legacyPlayers(f, gameId),
  };
}
