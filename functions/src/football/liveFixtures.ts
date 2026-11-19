import { FieldValue } from "firebase-admin/firestore";
import { SPORTING_TEAM_ID } from "../config/brand";
import { FINAL_STATUSES, LIVE_STATUSES } from "../model/status";
import type { MatchDoc } from "../model/types";
import type { AfFixtureCore } from "../sources/apiFootball.types";
import { stageOf } from "./bracket";
import type { FootballDeps } from "./fixturesSync";

/** Jogo ao vivo de uma liga, no formato de `competitions/{key}/data/liveFixtures` (ids como em `data/standings`). */
export interface LiveFixtureItem {
  homeId: string;
  awayId: string;
  homeGoals: number;
  awayGoals: number;
  elapsed: number | null;
  status: string;
}

/**
 * Um jogo do Sporting em direto numa liga (tabela). Só estes jogos justificam o pedido da classificação
 * ao vivo; particulares, taças e eliminatórias ficam de fora. NS atrasado ainda não está em direto.
 */
export function isLiveSportingLeagueMatch(m: MatchDoc): boolean {
  const sporting = Number(m.home.id) === SPORTING_TEAM_ID || Number(m.away.id) === SPORTING_TEAM_ID;
  return sporting && m.competition.type === "league" && stageOf(m.competition.round) === "table" && LIVE_STATUSES.has(m.status);
}

/** Jogo do Sporting numa liga (tabela) que acabou há menos de `tailMs`: a classificação ao vivo já não vale. */
export function isRecentlyFinishedSportingLeagueMatch(m: MatchDoc, now: Date, tailMs: number): boolean {
  const sporting = Number(m.home.id) === SPORTING_TEAM_ID || Number(m.away.id) === SPORTING_TEAM_ID;
  return (
    sporting &&
    m.competition.type === "league" &&
    stageOf(m.competition.round) === "table" &&
    FINAL_STATUSES.has(m.status) &&
    m.finishedAt !== null &&
    now.getTime() - m.finishedAt.getTime() < tailMs
  );
}

/** Resposta de `fixtures?live=all&league=`: só os jogos a decorrer (a API pode incluir intervalo, `HT`). */
export function liveFixtureItems(fixtures: AfFixtureCore[]): LiveFixtureItem[] {
  return fixtures
    .filter((f) => f.fixture.status.short !== "NS" && f.fixture.status.short !== "FT")
    .map((f) => ({
      homeId: String(f.teams.home.id),
      awayId: String(f.teams.away.id),
      homeGoals: f.goals.home ?? 0,
      awayGoals: f.goals.away ?? 0,
      elapsed: f.fixture.status.elapsed ?? null,
      status: f.fixture.status.short,
    }));
}

/**
 * 1 pedido. Escreve sempre `competitions/{key}/data/liveFixtures` (sem hash: o `updatedAt` serve de pulsação,
 * a app esconde o alternador se tiver mais de 5 min).
 */
export async function refreshLiveFixtures(d: FootballDeps, leagueId: number, key: string): Promise<{ count: number }> {
  const fixtures = liveFixtureItems(await d.api.liveFixtures(leagueId));
  await d.db.doc(`competitions/${key}/data/liveFixtures`).set({ updatedAt: FieldValue.serverTimestamp(), fixtures });
  return { count: fixtures.length };
}

/**
 * Sem pedido à API (não gasta quota): depois do apito final esvazia `fixtures`, para a app não somar à tabela
 * oficial (já refrescada no fim de jogo) o resultado de um jogo que acabou. Só escreve se ainda houver jogos.
 */
export async function clearLiveFixtures(d: FootballDeps, key: string): Promise<boolean> {
  const ref = d.db.doc(`competitions/${key}/data/liveFixtures`);
  const snap = await ref.get();
  if (!snap.exists || ((snap.get("fixtures") as unknown[] | undefined) ?? []).length === 0) return false;
  await ref.set({ updatedAt: FieldValue.serverTimestamp(), fixtures: [] });
  return true;
}
