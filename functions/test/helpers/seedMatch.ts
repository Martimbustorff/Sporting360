import type { Firestore } from "firebase-admin/firestore";
import type { MatchDoc } from "../../src/model/types";
import type { PlayerStatLine } from "../../src/football/mapFixture";

const BASE_KICKOFF = new Date("2026-11-15T20:30:00Z");

/** Jogo de futebol do Sporting em casa (FT 2-1) no modelo `matches`; `over` sobrepõe campos de topo. */
export async function seedFootballMatch(db: Firestore, over: Partial<MatchDoc> & { id: string }): Promise<void> {
  const match: MatchDoc = {
    sport: "football",
    competition: { key: "liga", id: "94", name: "Primeira Liga", type: "league", season: "2026", round: "12", roundLabel: null },
    home: { id: "228", name: "Sporting CP", logo: null },
    away: { id: "211", name: "Benfica", logo: null },
    sportingSide: "home",
    kickoff: BASE_KICKOFF,
    status: "FT",
    statusRaw: "FT",
    elapsed: 90,
    elapsedExtra: null,
    score: { home: 2, away: 1, halftime: null, extratime: null, penalty: null },
    finishedAt: new Date(BASE_KICKOFF.getTime() + 110 * 60_000),
    finishedAtSource: "observed",
    referee: null,
    source: { provider: "api-football", id: over.id },
    ...over,
  };
  await db.doc(`matches/${over.id}`).set(match);
}

function line(p: Partial<PlayerStatLine>): PlayerStatLine {
  return {
    playerId: "0", name: "", photo: null, number: null, position: null, minutes: null, rating: null,
    goals: 0, assists: 0, saves: 0, passesAccuracy: null, tackles: 0, foulsCommitted: 0,
    cardsYellow: 0, cardsRed: 0, substitute: false,
    ...p,
  };
}

/** `matches/{gameId}/details/players` com as linhas por equipa. */
export async function seedPlayers(
  db: Firestore,
  gameId: string,
  lines: { teamId: string; players: Partial<PlayerStatLine>[] }[],
): Promise<void> {
  await db.doc(`matches/${gameId}/details/players`).set({
    teams: lines.map((t) => ({ teamId: t.teamId, players: t.players.map(line) })),
  });
}
