import { FieldValue } from "firebase-admin/firestore";
import { SPORTING_TEAM_ID } from "../config/brand";
import { FINAL_STATUSES, LIVE_STATUSES } from "../model/status";
import type { MatchDoc } from "../model/types";
import type { AfFixtureCore } from "../sources/apiFootball.types";
import { stageOf } from "./bracket";
import type { FootballDeps } from "./fixturesSync";

/**
 * Jogo ao vivo de uma liga, no formato de `competitions/{key}/data/liveFixtures` (ids como em `data/standings`).
 * Um jogo que saiu do `live=all` fica com `status: "FT"` (último resultado conhecido) e `finishedAt`, até a classificação
 * oficial ser mais recente do que `finishedAt` (ver `keepFinished`); a app projeta-o como qualquer outro.
 */
export interface LiveFixtureItem {
  homeId: string;
  awayId: string;
  homeGoals: number;
  awayGoals: number;
  elapsed: number | null;
  status: string;
  /** Só nos jogos mantidos como FT: quando o servidor reparou que deixaram de estar em direto. */
  finishedAt?: Date;
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

/** Estados da API-Football em que o jogo está a decorrer (inclui intervalo, prolongamento, penáltis e interrupções). */
export const IN_PLAY_STATUSES: ReadonlySet<string> = new Set(["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"]);

/** Resposta de `fixtures?live=all&league=`: só os jogos a decorrer (lista de estados permitidos). */
export function liveFixtureItems(fixtures: AfFixtureCore[]): LiveFixtureItem[] {
  return fixtures
    .filter((f) => IN_PLAY_STATUSES.has(f.fixture.status.short))
    .map((f) => ({
      homeId: String(f.teams.home.id),
      awayId: String(f.teams.away.id),
      homeGoals: f.goals.home ?? 0,
      awayGoals: f.goals.away ?? 0,
      elapsed: f.fixture.status.elapsed ?? null,
      status: f.fixture.status.short,
    }));
}

/** Rede de segurança: um FT mantido há mais disto sem a oficial o apanhar é largado (documento nunca fica preso). */
export const KEEP_FINISHED_MAX_MS = 3 * 60 * 60_000;

const keyOf = (f: Pick<LiveFixtureItem, "homeId" | "awayId">) => `${f.homeId}-${f.awayId}`;

/** Jogos guardados no documento (com `finishedAt` já como Date). */
function storedItems(raw: unknown): LiveFixtureItem[] {
  if (!Array.isArray(raw)) return [];
  const out: LiveFixtureItem[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    if (!r || typeof r.homeId !== "string" || typeof r.awayId !== "string") continue;
    const fin = r.finishedAt as { toDate?: () => Date } | Date | undefined;
    const finishedAt = fin instanceof Date ? fin : typeof fin?.toDate === "function" ? fin.toDate() : undefined;
    out.push({
      homeId: r.homeId,
      awayId: r.awayId,
      homeGoals: Number(r.homeGoals ?? 0),
      awayGoals: Number(r.awayGoals ?? 0),
      elapsed: typeof r.elapsed === "number" ? r.elapsed : null,
      status: typeof r.status === "string" ? r.status : "",
      ...(finishedAt ? { finishedAt } : {}),
    });
  }
  return out;
}

/**
 * Jogos que já estavam no documento e deixaram de vir em direto: ficam como FT com o último resultado e `finishedAt`
 * (o do documento anterior, ou `now` na primeira vez), para a classificação projetada não perder os pontos entre o apito
 * final e o refresco da classificação oficial. Deixam de ser mantidos quando `standingsUpdatedAt` é posterior ao
 * `finishedAt` (a oficial já os conta). Sem pedidos à API.
 */
export function keepFinished(
  previous: LiveFixtureItem[],
  current: LiveFixtureItem[],
  now: Date,
  standingsUpdatedAt: Date | null,
): LiveFixtureItem[] {
  const live = new Set(current.map(keyOf));
  const kept: LiveFixtureItem[] = [];
  for (const p of previous) {
    if (live.has(keyOf(p))) continue;
    // Um jogo que nunca chegou a FT e não vem em direto (documento velho, sem pulsação) já não se sabe como acabou.
    const finishedAt = p.finishedAt ?? now;
    if (standingsUpdatedAt !== null && standingsUpdatedAt.getTime() > finishedAt.getTime()) continue;
    if (now.getTime() - finishedAt.getTime() > KEEP_FINISHED_MAX_MS) continue;
    kept.push({ ...p, status: "FT", elapsed: null, finishedAt });
  }
  return kept;
}

async function standingsUpdatedAtOf(d: FootballDeps, key: string): Promise<Date | null> {
  const t = (await d.db.doc(`competitions/${key}/data/standings`).get()).get("updatedAt") as { toDate?: () => Date } | undefined;
  return typeof t?.toDate === "function" ? t.toDate() : null;
}

/**
 * 1 pedido. Escreve sempre `competitions/{key}/data/liveFixtures` (sem hash: o `updatedAt` serve de pulsação,
 * a app esconde o alternador se tiver mais de 5 min). Os jogos que estavam no documento e já não vêm em direto ficam
 * como FT até a classificação oficial ser mais recente (`keepFinished`); só 2 leituras extra, nenhum pedido a mais.
 */
export async function refreshLiveFixtures(d: FootballDeps, leagueId: number, key: string): Promise<{ count: number }> {
  const current = liveFixtureItems(await d.api.liveFixtures(leagueId));
  const ref = d.db.doc(`competitions/${key}/data/liveFixtures`);
  const previous = storedItems((await ref.get()).get("fixtures"));
  const kept = previous.length > 0 ? keepFinished(previous, current, d.now(), await standingsUpdatedAtOf(d, key)) : [];
  const fixtures = [...current, ...kept];
  await ref.set({ updatedAt: FieldValue.serverTimestamp(), fixtures });
  return { count: fixtures.length };
}

/**
 * Sem pedido à API (não gasta quota): depois do apito final do Sporting não há jogo do Sporting em direto, por isso só
 * se mantêm os jogos FT cuja classificação oficial ainda não os conta (`keepFinished`) e se descartam os que ainda
 * constavam como em curso (já ninguém os atualiza). Com o refresco de fim de jogo feito, o documento fica vazio. Só
 * escreve se houver jogos no documento; com jogos mantidos renova o `updatedAt` (a app não os esconde por velhice).
 */
export async function pruneLiveFixtures(d: FootballDeps, key: string): Promise<boolean> {
  const ref = d.db.doc(`competitions/${key}/data/liveFixtures`);
  const previous = storedItems((await ref.get()).get("fixtures"));
  if (previous.length === 0) return false;
  const kept = keepFinished(previous.filter((p) => p.status === "FT"), [], d.now(), await standingsUpdatedAtOf(d, key));
  await ref.set({ updatedAt: FieldValue.serverTimestamp(), fixtures: kept });
  return true;
}
