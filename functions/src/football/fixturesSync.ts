import type { Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { SPORTING_TEAM_ID } from "../config/brand";
import { legacyFromFixture } from "../legacy/footballLegacy";
import { FINAL_STATUSES, LIVE_STATUSES, footballStatus } from "../model/status";
import { seasonsToFetch } from "../model/seasons";
import type { MatchDoc } from "../model/types";
import { MAX_IDS, type ApiFootballClient } from "../sources/apiFootball";
import type { AfFixture, AfFixtureCore } from "../sources/apiFootball.types";
import { fromFirestore, getMatch, saveMatch } from "../store/writer";
import { mapFixture } from "./mapFixture";

export interface FootballDeps {
  db: Firestore;
  api: ApiFootballClient;
  now: () => Date;
  /** Prefixo das coleções antigas (ensaio em sombra). Omitido: o parâmetro `LEGACY_COLLECTION_PREFIX`. */
  prefix?: string;
}

const HOUR = 3_600_000;
const DEFAULT_WINDOW_MS = 36 * HOUR;

/** O calendário não traz lances, equipas nem estatísticas: completa com listas vazias. */
const asFull = (f: AfFixtureCore): AfFixture => ({ events: [], lineups: [], statistics: [], players: [], ...f });

function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

/**
 * Calendário completo do Sporting (todas as competições, sem filtro de liga). Escreve `matches` e só
 * `games` nas coleções antigas. Jogos guardados como LIVE/HT não são tocados: pertencem ao ticker
 * (evita a corrida de hashes e que um FT visto aqui fixe um `finishedAt` estimado).
 * Um fixture inválido não aborta o lote.
 */
export async function syncFixtures(d: FootballDeps): Promise<{ count: number; remaining: number | null }> {
  const now = d.now();
  const byId = new Map<string, AfFixtureCore>();
  for (const season of seasonsToFetch(now)) {
    for (const f of await d.api.fixturesByTeamSeason(SPORTING_TEAM_ID, season)) byId.set(String(f.fixture.id), f);
  }

  let count = 0;
  let failed = 0;
  for (const [id, core] of byId) {
    try {
      const previous = await getMatch(d.db, id);
      if (previous && LIVE_STATUSES.has(previous.status)) continue;
      const full = asFull(core);
      const { match } = mapFixture(full, { now, previous, observedLive: false });
      const legacy = legacyFromFixture(full, match, null);
      await saveMatch(d.db, { match, details: null, legacy: { games: legacy.games } }, { prefix: d.prefix });
      count++;
    } catch (e) {
      failed++;
      logger.warn(`syncFixtures: fixture ${id} ignorado: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (failed > 0 && count === 0) throw new Error(`syncFixtures: todos os ${failed} fixtures falharam`);
  return { count, remaining: d.api.remaining };
}

/** Escreve fixtures completos (modelo novo e, salvo `newModelOnly`, todas as coleções antigas). */
async function saveFull(
  d: FootballDeps,
  fixtures: AfFixture[],
  o: { newModelOnly: boolean; force: boolean },
): Promise<{ count: number; failed: number }> {
  const now = d.now();
  let count = 0;
  let failed = 0;
  for (const f of fixtures) {
    try {
      const previous = await getMatch(d.db, String(f.fixture.id));
      const { match, details } = mapFixture(f, { now, previous, observedLive: false });
      const legacy = o.newModelOnly ? null : legacyFromFixture(f, match, null);
      await saveMatch(d.db, { match, details, legacy }, { prefix: d.prefix, force: o.force });
      count++;
    } catch (e) {
      failed++;
      logger.warn(`fixtures ${f.fixture.id} ignorado: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { count, failed };
}

/** Jogos de futebol terminados dentro da janela (por omissão 36 h): fixture completo, em lotes de 20 ids. */
export async function refreshRecent(
  d: FootballDeps,
  o: { finishedWithinMs: number } = { finishedWithinMs: DEFAULT_WINDOW_MS },
): Promise<{ count: number; remaining: number | null }> {
  const now = d.now();
  const from = new Date(now.getTime() - o.finishedWithinMs);
  const snap = await d.db.collection("matches").where("sport", "==", "football").where("finishedAt", ">=", from).get();
  const ids = snap.docs
    .map((s) => fromFirestore(s.data() as MatchDoc))
    .filter((m) => FINAL_STATUSES.has(m.status) && m.finishedAt !== null && m.finishedAt <= now)
    .map((m) => m.id)
    .sort();

  let count = 0;
  let failed = 0;
  for (const batch of chunk(ids, MAX_IDS)) {
    const r = await saveFull(d, await d.api.fixturesByIds(batch), { newModelOnly: false, force: false });
    count += r.count;
    failed += r.failed;
  }
  if (failed > 0 && count === 0) throw new Error(`refreshRecent: todos os ${failed} jogos falharam`);
  return { count, remaining: d.api.remaining };
}

/**
 * Jogos terminados de uma época, completos. Usa `force` (ignora hashes). Com `newModelOnly` não toca nas
 * coleções antigas.
 */
export async function backfillFinished(
  d: FootballDeps,
  season: string,
  o: { newModelOnly: boolean },
): Promise<{ count: number; remaining: number | null }> {
  const all = await d.api.fixturesByTeamSeason(SPORTING_TEAM_ID, season);
  const ids = all.filter((f) => FINAL_STATUSES.has(footballStatus(f.fixture.status.short))).map((f) => String(f.fixture.id));
  let count = 0;
  let failed = 0;
  for (const batch of chunk(ids, MAX_IDS)) {
    const r = await saveFull(d, await d.api.fixturesByIds(batch), { newModelOnly: o.newModelOnly, force: true });
    count += r.count;
    failed += r.failed;
  }
  if (failed > 0 && count === 0) throw new Error(`backfillFinished: todos os ${failed} jogos falharam`);
  return { count, remaining: d.api.remaining };
}

/** Jogos de futebol com `kickoff` entre `from` e `to` (inclusivo), por ordem de início. */
export async function listFootballWindow(db: Firestore, from: Date, to: Date): Promise<MatchDoc[]> {
  const snap = await db
    .collection("matches")
    .where("sport", "==", "football")
    .where("kickoff", ">=", from)
    .where("kickoff", "<=", to)
    .orderBy("kickoff", "asc")
    .get();
  return snap.docs.map((s) => fromFirestore(s.data() as MatchDoc));
}
