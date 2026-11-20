import { logger } from "firebase-functions";
import { legacyFromFixture } from "../legacy/footballLegacy";
import { FINAL_STATUSES, LIVE_STATUSES } from "../model/status";
import type { MatchDoc } from "../model/types";
import { dispatchMatchPushes } from "../push/matchPush";
import { dispatchLiveActivity } from "../liveActivity/dispatch";
import type { LiveActivitySender } from "../liveActivity/sender";
import type { PushSender } from "../push/sender";
import { MAX_IDS } from "../sources/apiFootball";
import { recordRun, runJob } from "../store/health";
import { saveMatch } from "../store/writer";
import { refreshCompetition, refreshStandings } from "./competitionSync";
import { isLiveSportingLeagueMatch, isRecentlyFinishedSportingLeagueMatch, pruneLiveFixtures, refreshLiveFixtures } from "./liveFixtures";
import { LIVE_OWNERSHIP_MS, listFootballWindow, type FootballDeps } from "./fixturesSync";
import { mapFixture } from "./mapFixture";
import { loadTvOverridesSafe } from "./tvChannel";
import { POSTMATCH_TAIL_MS, PREMATCH_LEAD_MS, phaseFor, ratingsSlot, type Phase } from "./phase";

export { LATE_START_MS, POSTMATCH_TAIL_MS, PREMATCH_LEAD_MS, RATINGS_REFRESH_MIN, RATINGS_WINDOW_MS, phaseFor, ratingsSlot } from "./phase";
export type { Phase } from "./phase";

const MIN = 60_000;
const HOUR = 60 * MIN;

export const LIVE_INTERVAL_MS = 15_000;
export const LIVE_ITERATIONS = 4;

/** Timeout de cada pedido do ticker (o cliente em index.ts usa este valor). */
export const LIVE_REQUEST_TIMEOUT_MS = 5_000;
/** Nenhuma iteração começa se, com o timeout de um pedido, puder acabar depois disto (a invocação seguinte). */
export const TICK_DEADLINE_MS = 60_000;
/**
 * Refrescos de fim de jogo (7 pedidos seguidos: standings, rondas, calendário e 4 tops) só começam até aqui; depois
 * ficam para o minuto seguinte. Derivado para os 7 pedidos, cada um no limite do timeout, acabarem com 5 s de folga
 * antes do prazo do tick (≈20 s).
 */
export const INLINE_REFRESH_MS = TICK_DEADLINE_MS - 7 * LIVE_REQUEST_TIMEOUT_MS - 5_000;
/** NS atrasado (fase live até `LATE_START_MS`) só a 4 pedidos por minuto nos primeiros 20 min; depois 1 por minuto. */
export const LATE_START_FAST_MS = 20 * MIN;
/** LIVE/HT com kickoff há mais disto (interrompido, API presa) desce para 1 pedido por minuto. */
export const LIVE_FAST_MS = 4 * HOUR;
/** O segundo refresco de fim de jogo (finishedAt + 25 min) ainda se tenta até aqui, se falhou ou se ficou adiado. */
const POST_REFRESH_UNTIL_MS = 2 * HOUR;

/** Fonte em `ingestHealth`. */
export const LIVE_SOURCE = "football_live";
/** Saúde própria da classificação ao vivo: um pedido opcional a falhar não estraga a saúde do ticker. */
export const LIVE_STANDINGS_SOURCE = "football_live_standings";

export type TickDeps = FootballDeps & {
  sleep: (ms: number) => Promise<void>;
  /** Envio de push (início, golos, MVP). Sem ele, o ticker não envia nem grava marcas. */
  push?: PushSender;
  /** Jogo no ecrã de bloqueio do iPhone (Plano 10). Sem ele, nada arranca nem grava marcas. */
  liveActivity?: LiveActivitySender;
};

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
  /** Classificação ao vivo (opcional): pedidos/limpezas tentados e erros; não contam em `failed`. */
  liveStandings: { attempted: number; errors: string[] };
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
 * para o minuto seguinte. Os erros contam-se em `failed` e a iteração seguinte continua. No fim, 1 pedido
 * `liveFixtures` por liga com jogo do Sporting em direto: o seu erro não conta em `failed`, vai em
 * `liveStandings.errors` (saúde `football_live_standings`).
 */
export async function tick(d: TickDeps): Promise<TickResult> {
  const start = d.now().getTime();
  const elapsed = () => d.now().getTime() - start;
  const callsAtStart = d.api.calls;
  const out: TickResult = { calls: 0, ids: [], remaining: null, writes: [], failed: 0, errors: [], deferred: [], liveStandings: { attempted: 0, errors: [] } };
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
  // Exceções de canal de TV: lidas uma vez por execução, só quando há jogo a gravar.
  let tvOverrides: Record<string, string> | null | undefined; // null: leitura falhou; undefined: ainda por ler

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
          if (tvOverrides === undefined) tvOverrides = await loadTvOverridesSafe(d.db);
          const { match, details } = mapFixture(f, { now, previous, observedLive, tvOverrides: tvOverrides ?? {}, tvOverridesUnavailable: tvOverrides === null });
          const legacy = legacyFromFixture(f, match, null);
          const r = await saveMatch(d.db, { match, details, legacy }, { prefix: d.prefix, halftimeSnapshot: true });
          written += r.written;
          state.set(id, match);
          saved.push(match);
          const rf = i === 0 ? ratingsFlag.get(id) : undefined;
          if (rf) await setFlag(id, rf);
          // Push depois de guardar; uma falha aqui nunca conta como falha do tick.
          if (d.push) {
            await dispatchMatchPushes(d.db, d.push, match, details?.events?.items ?? [], now).catch((e) =>
              logger.warn(`liveTicker: push do jogo ${id} falhou: ${msg(e)}`),
            );
          }
          if (d.liveActivity) {
            await dispatchLiveActivity(d.db, d.liveActivity, match, details?.events?.items ?? [], now).catch((e) =>
              logger.warn(`liveTicker: live activity do jogo ${id} falhou: ${msg(e)}`),
            );
          }
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

  // Classificação ao vivo: 1 pedido por minuto e por liga, só com um jogo do Sporting em direto numa liga.
  const liveLeagues = new Map<string, MatchDoc>();
  for (const m of state.values()) if (isLiveSportingLeagueMatch(m) && !liveLeagues.has(m.competition.key)) liveLeagues.set(m.competition.key, m);
  const liveFail = (what: string, e: unknown) => {
    out.liveStandings.errors.push(`${what}: ${msg(e)}`);
    logger.warn(`liveTicker: ${what} falhou: ${msg(e)}`);
  };
  for (const [key, m] of liveLeagues) {
    if (elapsed() + LIVE_REQUEST_TIMEOUT_MS > TICK_DEADLINE_MS) break;
    out.liveStandings.attempted++;
    try {
      await refreshLiveFixtures(d, Number(m.competition.id), key);
    } catch (e) {
      liveFail(`liveFixtures ${m.competition.id}`, e);
    }
  }
  // Jogo do Sporting acabado há pouco (e nenhum em direto nessa liga): descarta o que a oficial já conta, sem pedidos.
  const cleared = new Set<string>();
  for (const m of state.values()) {
    const key = m.competition.key;
    if (liveLeagues.has(key) || cleared.has(key) || !isRecentlyFinishedSportingLeagueMatch(m, d.now(), POSTMATCH_TAIL_MS)) continue;
    cleared.add(key);
    out.liveStandings.attempted++;
    try {
      await pruneLiveFixtures(d, key);
    } catch (e) {
      liveFail(`liveFixtures ${m.competition.id} (descarte)`, e);
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
  let standings: TickResult["liveStandings"] | null = null;
  await runJob(
    d.db,
    LIVE_SOURCE,
    async () => {
      const r = await tick(d);
      standings = r.liveStandings;
      if (r.failed > 0) throw new Error(`${r.failed} falha(s) no tick (${r.calls} pedidos): ${r.errors.join(" | ")}`.slice(0, 1000));
      return { count: r.calls, remaining: r.remaining };
    },
    { minRemaining: o.minRemaining ?? 500 },
  );
  // Saúde própria da classificação ao vivo; só quando houve tentativa neste minuto. Nunca lança.
  const st = standings as TickResult["liveStandings"] | null;
  if (st && st.attempted > 0) {
    try {
      await recordRun(
        d.db,
        LIVE_STANDINGS_SOURCE,
        st.errors.length > 0 ? { ok: false, error: st.errors.join(" | ").slice(0, 1000) } : { ok: true, count: st.attempted },
        { alertOnce: true },
      );
    } catch (e) {
      logger.warn(`liveTicker: saúde de ${LIVE_STANDINGS_SOURCE} não registada: ${msg(e)}`);
    }
  }
}
