import { logger } from "firebase-functions";
import { legacyFromFixture } from "../legacy/footballLegacy";
import { FINAL_STATUSES, LIVE_STATUSES } from "../model/status";
import type { MatchDoc } from "../model/types";
import { MAX_IDS } from "../sources/apiFootball";
import { runJob } from "../store/health";
import { saveMatch } from "../store/writer";
import { refreshCompetition, refreshStandings } from "./competitionSync";
import { LIVE_OWNERSHIP_MS, listFootballWindow, type FootballDeps } from "./fixturesSync";
import { mapFixture } from "./mapFixture";

export type Phase = "idle" | "prematch" | "live" | "postmatch" | "ratings";

const MIN = 60_000;

export const LIVE_INTERVAL_MS = 15_000;
export const LIVE_ITERATIONS = 4;
export const PREMATCH_LEAD_MS = 75 * MIN;
export const POSTMATCH_TAIL_MS = 25 * MIN;
export const RATINGS_REFRESH_MIN: readonly number[] = [30, 60, 110];
/** Nenhuma iteração começa depois disto (a invocação seguinte chega aos 60 s). */
export const LIVE_BUDGET_MS = 50_000;
/** NS depois do kickoff conta como live (atraso no início) durante este tempo. */
export const LATE_START_MS = 4 * 60 * MIN;
/** O segundo refresco de fim de jogo (finishedAt + 25 min) ainda se tenta até aqui, se falhou ou se o minuto se perdeu. */
const POST_REFRESH_UNTIL_MS = 2 * 60 * MIN;

/** Fonte em `ingestHealth`. */
export const LIVE_SOURCE = "football_live";

export type TickDeps = FootballDeps & { sleep: (ms: number) => Promise<void> };

export interface TickResult {
  /** Pedidos à API feitos neste tick (os que chegaram a ter resposta HTTP 2xx). */
  calls: number;
  /** Jogos pedidos à API (fixturesByIds) neste tick. */
  ids: string[];
  remaining: number | null;
  /** Documentos escritos por iteração de fixturesByIds. */
  writes: number[];
  /** Operações falhadas (pedido de fixtures, jogo, standings ou competição). */
  failed: number;
  errors: string[];
}

export function phaseFor(m: MatchDoc, now: Date): Phase {
  const t = now.getTime();
  const k = m.kickoff.getTime();
  if (LIVE_STATUSES.has(m.status)) return "live";
  if (m.status === "NS") {
    if (t >= k - PREMATCH_LEAD_MS && t < k) return "prematch";
    if (t >= k && t < k + LATE_START_MS) return "live";
    return "idle";
  }
  if (FINAL_STATUSES.has(m.status) && m.finishedAt) {
    const since = t - m.finishedAt.getTime();
    if (since < POSTMATCH_TAIL_MS) return "postmatch";
    if (RATINGS_REFRESH_MIN.includes(Math.floor(since / MIN))) return "ratings";
  }
  return "idle";
}

type EndKind = "endRefresh" | "postRefresh";

/** Qual dos dois refrescos de fim de jogo cabe agora a este jogo (ignorando as marcas). */
function endKindFor(m: MatchDoc, now: Date): EndKind | null {
  if (!FINAL_STATUSES.has(m.status) || !m.finishedAt || m.competition.type === "friendly") return null;
  const since = now.getTime() - m.finishedAt.getTime();
  if (since < POSTMATCH_TAIL_MS) return "endRefresh";
  if (since < POST_REFRESH_UNTIL_MS) return "postRefresh";
  return null;
}

function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Um minuto do ticker. Lê os jogos com kickoff em `[now - 6 h, now + 75 min]`; sem nenhum fora de
 * `idle` (e sem refresco de fim de jogo pendente) não faz pedidos. Com algum `live`, até 4 iterações
 * alinhadas a 0/15/30/45 s desde o início, cada uma com um só `fixturesByIds`; senão uma iteração.
 * Os erros contam-se em `failed` e a iteração seguinte continua.
 */
export async function tick(d: TickDeps): Promise<TickResult> {
  const start = d.now().getTime();
  const callsAtStart = d.api.calls;
  const out: TickResult = { calls: 0, ids: [], remaining: null, writes: [], failed: 0, errors: [] };
  const fail = (what: string, e: unknown) => {
    out.failed++;
    out.errors.push(`${what}: ${msg(e)}`);
    logger.warn(`liveTicker: ${what} falhou: ${msg(e)}`);
  };
  const finish = (): TickResult => ({ ...out, calls: d.api.calls - callsAtStart, remaining: d.api.remaining });

  const window = await listFootballWindow(d.db, new Date(start - LIVE_OWNERSHIP_MS), new Date(start + PREMATCH_LEAD_MS));
  const state = new Map(window.map((m) => [m.id, m]));

  // Marcas dos refrescos de fim de jogo (ingestState/match_{id}.ticker), lidas uma vez por jogo.
  const flags = new Map<string, Partial<Record<EndKind, boolean>>>();
  const flagsOf = async (id: string) => {
    let f = flags.get(id);
    if (!f) {
      f = ((await d.db.doc(`ingestState/match_${id}`).get()).get("ticker") ?? {}) as Partial<Record<EndKind, boolean>>;
      flags.set(id, f);
    }
    return f;
  };
  const standingsDone = new Set<string>();

  /** Refresco de fim de jogo (standings + competição), uma vez por marca; a marca só fica com sucesso. */
  const endRefresh = async (m: MatchDoc, now: Date) => {
    const kind = endKindFor(m, now);
    if (!kind || (await flagsOf(m.id))[kind]) return;
    const leagueId = Number(m.competition.id);
    const season = m.competition.season;
    let ok = true;
    try {
      await refreshStandings(d, leagueId, season);
      standingsDone.add(m.competition.key);
    } catch (e) {
      ok = false;
      fail(`standings ${leagueId} (${kind} ${m.id})`, e);
    }
    try {
      const r = await refreshCompetition(d, leagueId, season);
      if (r.failed > 0) logger.warn(`liveTicker: ${r.failed} tops da liga ${leagueId} falharam (${kind} ${m.id})`);
    } catch (e) {
      ok = false;
      fail(`competição ${leagueId} (${kind} ${m.id})`, e);
    }
    if (ok) {
      await d.db.doc(`ingestState/match_${m.id}`).set({ ticker: { [kind]: true } }, { merge: true });
      (await flagsOf(m.id))[kind] = true;
    }
  };

  const startNow = new Date(start);
  const startPhase = new Map<string, Phase>();
  for (const m of state.values()) {
    const p = phaseFor(m, startNow);
    if (p !== "idle") startPhase.set(m.id, p);
  }

  // Jogos idle à espera do segundo refresco (finishedAt + 25 min): não precisam do fixture.
  const pendingIdle: MatchDoc[] = [];
  for (const m of state.values()) {
    if (startPhase.has(m.id)) continue;
    const kind = endKindFor(m, startNow);
    if (kind && !(await flagsOf(m.id))[kind]) pendingIdle.push(m);
  }
  if (startPhase.size === 0 && pendingIdle.length === 0) return finish();
  for (const m of pendingIdle) await endRefresh(m, startNow);

  const anyLive = [...startPhase.values()].includes("live");
  const iterations = startPhase.size === 0 ? 0 : anyLive ? LIVE_ITERATIONS : 1;
  const polled = new Set<string>();

  for (let i = 0; i < iterations; i++) {
    if (i > 0) {
      if (d.now().getTime() - start >= LIVE_BUDGET_MS) break;
      const wait = start + i * LIVE_INTERVAL_MS - d.now().getTime();
      if (wait > 0) await d.sleep(wait);
    }
    const now = d.now();
    const phaseNow = (m: MatchDoc) => (i === 0 ? (startPhase.get(m.id) ?? "idle") : phaseFor(m, now));
    const ids = [...state.values()].filter((m) => (i === 0 ? startPhase.has(m.id) : phaseNow(m) === "live")).map((m) => m.id);
    if (ids.length === 0) break;

    let written = 0;
    const saved: MatchDoc[] = [];
    for (const batch of chunk(ids, MAX_IDS)) {
      batch.forEach((id) => polled.add(id));
      let fixtures;
      try {
        fixtures = await d.api.fixturesByIds(batch);
      } catch (e) {
        fail(`fixtures ${batch.join("-")} (iteração ${i + 1})`, e);
        continue;
      }
      for (const f of fixtures) {
        const id = String(f.fixture.id);
        try {
          const previous = state.get(id) ?? null;
          const observedLive = previous !== null && phaseNow(previous) === "live";
          const { match, details } = mapFixture(f, { now, previous, observedLive });
          const legacy = legacyFromFixture(f, match, null);
          const r = await saveMatch(d.db, { match, details, legacy }, { prefix: d.prefix });
          written += r.written;
          state.set(id, match);
          saved.push(match);
        } catch (e) {
          fail(`jogo ${id}`, e);
        }
      }
    }
    out.writes.push(written);

    // Fim de jogo: na iteração em que passa a final (ou no postmatch, se ainda não correu).
    for (const m of saved) await endRefresh(m, now);

    // Classificação a cada 15 min de jogo, uma vez por competição.
    if (i === 0 && startNow.getUTCMinutes() % 15 === 0) {
      for (const m of state.values()) {
        if (startPhase.get(m.id) !== "live" || m.competition.type === "friendly" || standingsDone.has(m.competition.key)) continue;
        standingsDone.add(m.competition.key);
        try {
          await refreshStandings(d, Number(m.competition.id), m.competition.season);
        } catch (e) {
          fail(`standings ${m.competition.id} (minuto ${startNow.getUTCMinutes()})`, e);
        }
      }
    }
  }

  out.ids = [...polled];
  return finish();
}

/**
 * O tick com registo de saúde em `ingestHealth/football_live`. Um tick com alguma falha conta como
 * execução falhada (consecutiveFailures + 1, alerta) mesmo que as outras iterações tenham corrido.
 */
export async function liveTickerJob(d: TickDeps, o: { minRemaining?: number } = {}): Promise<void> {
  await runJob(
    d.db,
    LIVE_SOURCE,
    async () => {
      const r = await tick(d);
      if (r.failed > 0) throw new Error(`${r.failed} falha(s) no tick (${r.calls} pedidos): ${r.errors.join(" | ")}`.slice(0, 1000));
      return { count: r.calls, remaining: r.remaining };
    },
    { minRemaining: o.minRemaining ?? 500 },
  );
}
