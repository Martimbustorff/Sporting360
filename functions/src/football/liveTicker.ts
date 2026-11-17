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
const HOUR = 60 * MIN;

export const LIVE_INTERVAL_MS = 15_000;
export const LIVE_ITERATIONS = 4;
export const PREMATCH_LEAD_MS = 75 * MIN;
export const POSTMATCH_TAIL_MS = 25 * MIN;
export const RATINGS_REFRESH_MIN: readonly number[] = [30, 60, 110];
/** Cada refresco de ratings faz-se uma vez, no primeiro tick em [X, X + 10 min). */
export const RATINGS_WINDOW_MS = 10 * MIN;

/** Timeout de cada pedido do ticker (o cliente em index.ts usa este valor). */
export const LIVE_REQUEST_TIMEOUT_MS = 5_000;
/** Nenhuma iteração começa se, com o timeout de um pedido, puder acabar depois disto (a invocação seguinte). */
export const TICK_DEADLINE_MS = 60_000;
/** Refrescos de fim de jogo (≈7 pedidos seguidos) só correm dentro do tick até aqui; depois ficam para o minuto seguinte. */
export const INLINE_REFRESH_MS = 30_000;
/** NS depois do kickoff conta como live (atraso no início) durante este tempo. */
export const LATE_START_MS = 4 * HOUR;
/** ...mas só a 4 pedidos por minuto nos primeiros 20 min; depois 1 por minuto. */
export const LATE_START_FAST_MS = 20 * MIN;
/** LIVE/HT com kickoff há mais disto (interrompido, API presa) desce para 1 pedido por minuto. */
export const LIVE_FAST_MS = 4 * HOUR;
/** O segundo refresco de fim de jogo (finishedAt + 25 min) ainda se tenta até aqui, se falhou ou se ficou adiado. */
const POST_REFRESH_UNTIL_MS = 2 * HOUR;

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
  /** Jogos cujo refresco de fim de jogo ficou para o minuto seguinte (tick já demasiado adiantado). */
  deferred: string[];
}

/** Minuto de ratings (30, 60 ou 110) cuja janela de 10 min contém `now`; `null` fora delas. */
export function ratingsSlot(m: MatchDoc, now: Date): number | null {
  if (!FINAL_STATUSES.has(m.status) || !m.finishedAt) return null;
  const since = now.getTime() - m.finishedAt.getTime();
  return RATINGS_REFRESH_MIN.find((x) => since >= x * MIN && since < x * MIN + RATINGS_WINDOW_MS) ?? null;
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
    if (t - m.finishedAt.getTime() < POSTMATCH_TAIL_MS) return "postmatch";
    if (ratingsSlot(m, now) !== null) return "ratings";
  }
  return "idle";
}

/**
 * Ritmo de um jogo `live`: `fast` (4 pedidos por minuto) ou `slow` (1). NS atrasado é `fast` só nos
 * primeiros 20 min depois do kickoff; LIVE/HT só até kickoff + 4 h.
 */
export function liveRate(m: MatchDoc, now: Date): "fast" | "slow" {
  const since = now.getTime() - m.kickoff.getTime();
  if (m.status === "NS") return since < LATE_START_FAST_MS ? "fast" : "slow";
  return since < LIVE_FAST_MS ? "fast" : "slow";
}

const isFast = (m: MatchDoc, now: Date) => phaseFor(m, now) === "live" && liveRate(m, now) === "fast";

type Flag = "endRefresh" | "postRefresh" | `ratings${number}`;
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
 * `idle` (nem refresco pendente) não faz pedidos. Com algum `live` rápido, até 4 iterações alinhadas a
 * 0/15/30/45 s desde o início, cada uma com um só `fixturesByIds`; senão uma iteração. Nenhuma
 * iteração começa se puder acabar depois dos 60 s; os refrescos de fim de jogo depois dos 30 s ficam
 * para o minuto seguinte. Os erros contam-se em `failed` e a iteração seguinte continua.
 */
export async function tick(d: TickDeps): Promise<TickResult> {
  const start = d.now().getTime();
  const elapsed = () => d.now().getTime() - start;
  const callsAtStart = d.api.calls;
  const out: TickResult = { calls: 0, ids: [], remaining: null, writes: [], failed: 0, errors: [], deferred: [] };
  const fail = (what: string, e: unknown) => {
    out.failed++;
    out.errors.push(`${what}: ${msg(e)}`);
    logger.warn(`liveTicker: ${what} falhou: ${msg(e)}`);
  };
  const finish = (): TickResult => ({ ...out, calls: d.api.calls - callsAtStart, remaining: d.api.remaining });

  const window = await listFootballWindow(d.db, new Date(start - LIVE_OWNERSHIP_MS), new Date(start + PREMATCH_LEAD_MS));
  const state = new Map(window.map((m) => [m.id, m]));

  // Marcas (ingestState/match_{id}.ticker): refrescos de fim de jogo e de ratings, lidas uma vez por jogo.
  const flags = new Map<string, Partial<Record<Flag, boolean>>>();
  const flagsOf = async (id: string) => {
    let f = flags.get(id);
    if (!f) {
      f = ((await d.db.doc(`ingestState/match_${id}`).get()).get("ticker") ?? {}) as Partial<Record<Flag, boolean>>;
      flags.set(id, f);
    }
    return f;
  };
  const setFlag = async (id: string, flag: Flag) => {
    await d.db.doc(`ingestState/match_${id}`).set({ ticker: { [flag]: true } }, { merge: true });
    (await flagsOf(id))[flag] = true;
  };
  const standingsDone = new Set<string>();

  /** Refresco de fim de jogo (standings + competição), uma vez por marca; a marca só fica com sucesso. */
  const endRefresh = async (m: MatchDoc) => {
    const kind = endKindFor(m, d.now());
    if (!kind || (await flagsOf(m.id))[kind]) return;
    if (elapsed() >= INLINE_REFRESH_MS) {
      out.deferred.push(m.id);
      logger.info(`liveTicker: ${kind} do jogo ${m.id} fica para o minuto seguinte (${elapsed()} ms)`);
      return;
    }
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
    if (ok) await setFlag(m.id, kind);
  };

  // Fase de cada jogo no início; ratings já feitos nesta janela contam como idle.
  const startNow = new Date(start);
  const startPhase = new Map<string, Phase>();
  const ratingsFlag = new Map<string, Flag>();
  for (const m of state.values()) {
    const p = phaseFor(m, startNow);
    if (p === "idle") continue;
    if (p === "ratings") {
      const flag: Flag = `ratings${ratingsSlot(m, startNow) ?? 0}`;
      if ((await flagsOf(m.id))[flag]) continue;
      ratingsFlag.set(m.id, flag);
    }
    startPhase.set(m.id, p);
  }

  // Jogos que não vão ser pedidos mas têm um refresco de fim de jogo por fazer (ex.: finishedAt + 25 min).
  const pendingIdle: MatchDoc[] = [];
  for (const m of state.values()) {
    if (startPhase.has(m.id)) continue;
    const kind = endKindFor(m, startNow);
    if (kind && !(await flagsOf(m.id))[kind]) pendingIdle.push(m);
  }
  if (startPhase.size === 0 && pendingIdle.length === 0) return finish();

  const anyFast = [...state.values()].some((m) => startPhase.get(m.id) === "live" && liveRate(m, startNow) === "fast");
  const iterations = startPhase.size === 0 ? 0 : anyFast ? LIVE_ITERATIONS : 1;
  const polled = new Set<string>();

  for (let i = 0; i < iterations; i++) {
    if (i > 0) {
      const begin = Math.max(d.now().getTime(), start + i * LIVE_INTERVAL_MS);
      if (begin - start + LIVE_REQUEST_TIMEOUT_MS > TICK_DEADLINE_MS) break;
      const wait = begin - d.now().getTime();
      if (wait > 0) await d.sleep(wait);
    }
    const now = d.now();
    const phaseNow = (m: MatchDoc) => (i === 0 ? (startPhase.get(m.id) ?? "idle") : phaseFor(m, now));
    const ids = [...state.values()].filter((m) => (i === 0 ? startPhase.has(m.id) : isFast(m, now))).map((m) => m.id);
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
          const rf = i === 0 ? ratingsFlag.get(id) : undefined;
          if (rf) await setFlag(id, rf);
        } catch (e) {
          fail(`jogo ${id}`, e);
        }
      }
    }
    out.writes.push(written);

    // Fim de jogo: na iteração em que passa a final (ou no postmatch, se ainda não correu ou ficou adiado).
    for (const m of saved) await endRefresh(m);

    // Classificação a cada 15 min de jogo, uma vez por competição (só jogos em curso a ritmo normal).
    if (i === 0 && startNow.getUTCMinutes() % 15 === 0) {
      for (const m of state.values()) {
        const prev = window.find((w) => w.id === m.id);
        if (!prev || startPhase.get(m.id) !== "live" || liveRate(prev, startNow) !== "fast") continue;
        if (m.competition.type === "friendly" || standingsDone.has(m.competition.key)) continue;
        standingsDone.add(m.competition.key);
        try {
          await refreshStandings(d, Number(m.competition.id), m.competition.season);
        } catch (e) {
          fail(`standings ${m.competition.id} (minuto ${startNow.getUTCMinutes()})`, e);
        }
      }
    }
  }

  // Depois do ciclo ao vivo, para nunca o atrasar; com o mesmo limite de tempo.
  for (const m of pendingIdle) await endRefresh(m);

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
