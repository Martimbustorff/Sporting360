import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { applyCrests, crestRefsOf } from "./teamCrests";
import { logger } from "firebase-functions";
import { roundLabel } from "../model/labels";
import { apiSportsSeason } from "../model/seasons";
import { FINAL_STATUSES } from "../model/status";
import type { MatchDoc, Sport } from "../model/types";
import type { FetchFn } from "../sources/http";
import { gameDurationMs, opponentSlug, seasonStartYear, type FetchContext, type MatchSource, type NormalizedMatch } from "../sources/free/common";
import { futsalPortugal } from "../sources/free/futsalportugal";
import { futsalPortugalGamesheet } from "../sources/free/futsalportugal_gamesheet";
import { hoqueipatins } from "../sources/free/hoqueipatins";
import { hpFpp } from "../sources/free/hp_fpp";
import { recordRun } from "../store/health";
import { fromFirestore, saveMatch } from "../store/writer";
import { API_SPORTS_GAPS, FREE_SOURCES, ROLLER_HOCKEY_EUROPE } from "./sourcesConfig";

export { opponentSlug, type MatchSource, type NormalizedMatch } from "../sources/free/common";

/**
 * Implementação de cada `FreeSourceRef.key` (sourcesConfig). `wse_schedule_post` (texto do calendário WSE, sem hora)
 * não tem implementação: não há amostra gravada; a Liga dos Campeões WSE corre só com o hoqueipatins.
 */
export const FREE_MATCH_SOURCES: Record<string, MatchSource> = {
  futsalportugal: futsalPortugal,
  futsalportugal_gamesheet: futsalPortugalGamesheet,
  hp_fpp: hpFpp,
  hoqueipatins,
};

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** "Mesmo jogo": a menos de 3 dias. */
const SAME_GAME_MS = 3 * DAY;
const BEFORE_MS = 15 * MIN;
const AFTER_MS = 3 * HOUR;
/** Em janela de jogo, a cada 15 min (o cron também é de 15 min; 1 min de folga para o atraso do agendador). */
const WINDOW_EVERY_MS = 14 * MIN;
const IDLE_EVERY_MS = 6 * HOUR;
const FAILURE_BACKOFF_MS = HOUR;

/** Setembro a junho em Lisboa: época em que as modalidades devem ter jogos. */
function inSeason(now: Date): boolean {
  const month = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", month: "numeric" }).format(now));
  return month >= 9 || month <= 6;
}

/** Jogo normalizado no modelo novo. Sem local não escreve `venue` (o merge preserva o que já existe). */
export function toMatchDoc(m: NormalizedMatch, id: string, now: Date): MatchDoc {
  void now;
  const final = FINAL_STATUSES.has(m.status);
  return {
    id,
    sport: m.sport,
    competition: {
      key: `${m.sport}_${m.competition.id}_${m.season}`,
      id: m.competition.id,
      name: m.competition.name,
      type: m.competition.type,
      season: m.season,
      round: m.competition.round,
      roundLabel: roundLabel(m.competition.round, m.competition.type),
    },
    home: m.home,
    away: m.away,
    sportingSide: m.sportingSide,
    kickoff: m.kickoff,
    status: m.status,
    statusRaw: m.statusRaw,
    elapsed: null,
    elapsedExtra: null,
    score: { home: m.score.home, away: m.score.away, halftime: null, extratime: null, penalty: m.penalty ?? null },
    finishedAt: final ? new Date(m.kickoff.getTime() + gameDurationMs(m.competition.type)) : null,
    finishedAtSource: final ? "estimated" : null,
    ...(m.venue ? { venue: { id: null, name: m.venue, city: null } } : {}),
    referee: null,
    // Todos os campos de `source` explícitos: o merge do saveMatch não pode deixar valores de uma execução anterior.
    source: { provider: m.sourceKey, id: m.sourceId, fallbackUsed: false, exactKickoff: m.kickoffExact === true, attribution: m.attribution ?? null },
  };
}

interface Key {
  competitionId: string;
  opponent: string;
  kickoff: number;
  roundLabel: string | null;
}

const keyOfNormalized = (m: NormalizedMatch): Key => ({
  competitionId: m.competition.id,
  opponent: opponentSlug((m.sportingSide === "home" ? m.away : m.home).name),
  kickoff: m.kickoff.getTime(),
  roundLabel: roundLabel(m.competition.round, m.competition.type),
});

const keyOfDoc = (d: MatchDoc): Key => ({
  competitionId: d.competition.id,
  opponent: opponentSlug((d.sportingSide === "home" ? d.away : d.home).name),
  kickoff: d.kickoff.getTime(),
  roundLabel: d.competition.roundLabel,
});

/**
 * C10: mesmo adversário, mesma competição, a menos de 3 dias e (mesma ronda, ou um único candidato).
 * `ambiguous`: há candidatos mas nenhum se distingue (série de play-off com rondas que não se comparam).
 */
function findSame<T>(target: Key, items: T[], keyOf: (t: T) => Key): { item: T | null; ambiguous: boolean } {
  const cands = items.filter((i) => {
    const k = keyOf(i);
    return k.competitionId === target.competitionId && k.opponent === target.opponent && Math.abs(k.kickoff - target.kickoff) < SAME_GAME_MS;
  });
  const byDistance = (a: T, b: T) => Math.abs(keyOf(a).kickoff - target.kickoff) - Math.abs(keyOf(b).kickoff - target.kickoff);
  const sameRound = target.roundLabel === null ? [] : cands.filter((c) => keyOf(c).roundLabel === target.roundLabel).sort(byDistance);
  if (sameRound.length > 0) return { item: sameRound[0], ambiguous: false };
  if (cands.length === 1) return { item: cands[0], ambiguous: false };
  if (cands.length > 1) return { item: null, ambiguous: true };
  // Nomes que não se comparam entre fontes ("SCT / UP TOMAR" e "Tomar"): uma ronda tem um só jogo do Sporting,
  // por isso a mesma competição e a mesma ronda (não nula) a menos de 3 dias, com um único candidato, é o mesmo jogo.
  if (target.roundLabel === null) return { item: null, ambiguous: false };
  const byRound = items.filter((i) => {
    const k = keyOf(i);
    return k.competitionId === target.competitionId && k.roundLabel === target.roundLabel && Math.abs(k.kickoff - target.kickoff) < SAME_GAME_MS;
  });
  if (byRound.length === 1) return { item: byRound[0], ambiguous: false };
  return { item: null, ambiguous: byRound.length > 1 };
}

const hasFinal = (d: MatchDoc) => FINAL_STATUSES.has(d.status) && d.score.home !== null && d.score.away !== null;

/**
 * Um resultado final gravado nunca desce: se a fonte traz o jogo sem estado final ou sem resultado, ficam o estado,
 * o resultado e `finishedAt` gravados, e sai um alerta.
 */
function keepFinal(doc: MatchDoc, ex: MatchDoc | null, alerts: string[]): void {
  if (!ex || !hasFinal(ex) || hasFinal(doc)) return;
  doc.status = ex.status;
  doc.statusRaw = ex.statusRaw;
  doc.score = { ...ex.score };
  doc.finishedAt = ex.finishedAt;
  doc.finishedAtSource = ex.finishedAtSource;
  alerts.push(`resultado final de ${ex.id} (${ex.score.home}-${ex.score.away}) não confirmado pela fonte (${doc.source.provider}: ${doc.status === ex.status ? "sem resultado" : "outro estado"}); mantido`);
}

const scoreText = (s: { home: number | null; away: number | null }) => `${s.home ?? "?"}-${s.away ?? "?"}`;

/** Completa só o que é nulo (resultado com o seu estado, local). Devolve verdadeiro se mudou alguma coisa. */
function fillNulls(doc: MatchDoc, fb: NormalizedMatch): boolean {
  let filled = false;
  if (doc.score.home === null && doc.score.away === null && fb.score.home !== null && fb.score.away !== null) {
    const final = FINAL_STATUSES.has(fb.status);
    doc.score = { ...doc.score, home: fb.score.home, away: fb.score.away, penalty: fb.penalty ?? null };
    doc.status = fb.status;
    doc.statusRaw = fb.statusRaw;
    doc.finishedAt = final ? new Date(doc.kickoff.getTime() + gameDurationMs(doc.competition.type)) : null;
    doc.finishedAtSource = final ? "estimated" : null;
    filled = true;
  }
  if (!doc.venue && fb.venue) {
    doc.venue = { id: null, name: fb.venue, city: null };
    filled = true;
  }
  if (filled && fb.attribution) doc.source = { ...doc.source, attribution: fb.attribution };
  return filled;
}

const clone = (d: MatchDoc): MatchDoc => ({ ...d, competition: { ...d.competition }, score: { ...d.score }, source: { ...d.source }, ...(d.venue ? { venue: { ...d.venue } } : {}) });

/**
 * Junta a fonte principal e a de recurso com os jogos já gravados. Campos da principal; a de recurso só preenche nulos
 * (resultado, local) ou dá o jogo quando a principal não o tem (`source.fallbackUsed: true`). Nunca devolve remoções:
 * um jogo gravado que deixou de aparecer não entra em `matches` e fica como está.
 */
export function reconcile(
  existing: MatchDoc[],
  primary: NormalizedMatch[] | Error,
  fallback: NormalizedMatch[] | Error,
  prefix: string,
  now: Date = new Date(),
): { matches: MatchDoc[]; used: "primary" | "fallback" | "merged" | "none"; alerts: string[] } {
  const alerts: string[] = [];
  const pList = Array.isArray(primary) ? primary : [];
  const fList = Array.isArray(fallback) ? fallback : [];
  if (primary instanceof Error) alerts.push(`principal falhou: ${primary.message}`);
  if (fallback instanceof Error) alerts.push(`recurso falhou: ${fallback.message}`);
  if (Array.isArray(primary) && pList.length === 0 && fList.length > 0) alerts.push(`principal devolveu 0 jogos e a recurso ${fList.length}`);
  if (pList.length === 0 && fList.length === 0 && inSeason(now)) alerts.push("0 jogos nas duas fontes em plena época");

  const out: MatchDoc[] = [];
  const usedExisting = new Set<string>();
  const findExisting = (m: NormalizedMatch): MatchDoc | null => {
    const free = existing.filter((e) => !usedExisting.has(e.id));
    const bySource = free.find((e) => e.source.provider === m.sourceKey && e.source.id === m.sourceId);
    if (bySource) return bySource;
    const r = findSame(keyOfNormalized(m), free, keyOfDoc);
    return r.item;
  };

  // 1. Principal: id do documento existente (mesma fonte e id, ou o mesmo jogo), senão um novo.
  const fromPrimary: { doc: MatchDoc; m: NormalizedMatch; merged: boolean; ex: MatchDoc | null }[] = [];
  for (const m of pList) {
    const ex = findExisting(m);
    if (ex) usedExisting.add(ex.id);
    const doc = toMatchDoc(m, ex?.id ?? `${prefix}_${m.sourceKey}_${m.sourceId}`, now);
    fromPrimary.push({ doc, m, merged: false, ex });
    out.push(doc);
  }

  // 2. Recurso: completa o jogo da principal; senão um jogo gravado; senão entra como jogo novo.
  for (const fb of fList) {
    const key = keyOfNormalized(fb);
    const hit = findSame(key, fromPrimary.filter((p) => !p.merged), (p) => keyOfNormalized(p.m));
    if (hit.item) {
      hit.item.merged = true;
      const p = hit.item;
      if (FINAL_STATUSES.has(p.m.status) && FINAL_STATUSES.has(fb.status) && (p.m.score.home !== fb.score.home || p.m.score.away !== fb.score.away)) {
        alerts.push(`resultado diferente entre fontes em ${p.doc.id}: principal ${scoreText(p.m.score)}, recurso ${scoreText(fb.score)}`);
      }
      fillNulls(p.doc, fb);
      continue;
    }
    if (hit.ambiguous) continue;

    const ex = findExisting(fb);
    if (ex) {
      usedExisting.add(ex.id);
      if (ex.source.provider === fb.sourceKey) {
        const doc = toMatchDoc(fb, ex.id, now);
        doc.source = { ...doc.source, fallbackUsed: true };
        keepFinal(doc, ex, alerts);
        out.push(doc);
      } else {
        const doc = clone(ex);
        if (fillNulls(doc, fb)) out.push({ ...doc, source: { ...doc.source, fallbackUsed: true } });
      }
      continue;
    }
    if (findSame(key, existing, keyOfDoc).ambiguous) continue;
    const doc = toMatchDoc(fb, `${prefix}_${fb.sourceKey}_${fb.sourceId}`, now);
    out.push({ ...doc, source: { ...doc.source, fallbackUsed: true } });
  }

  for (const p of fromPrimary) keepFinal(p.doc, p.ex, alerts);

  const used = pList.length > 0 && fList.length > 0 ? "merged" : pList.length > 0 ? "primary" : fList.length > 0 ? "fallback" : "none";
  return { matches: out, used, alerts };
}

export interface FreeSourcesDeps {
  db: Firestore;
  fetch: FetchFn;
  now: () => Date;
}

export interface FreeCompetitionRef {
  /** Chave do estado (`ingestState/free_{key}`) e da saúde (`ingestHealth/free_{key}`). */
  key: string;
  sport: Sport;
  primary: MatchSource;
  fallback: MatchSource | null;
  prefix: "fs" | "hq" | string;
  /** Jogos desta competição (o hóquei nacional e o europeu partilham o hoqueipatins e o prefixo). */
  filter?: (m: { competition: { type: MatchDoc["competition"]["type"] } }) => boolean;
}

/** Competições das fontes gratuitas. `API_SPORTS_GAPS` está vazio (Task 1): nenhuma lacuna da API-Sports tem fonte gratuita. */
export const FREE_COMPETITIONS: FreeCompetitionRef[] = [
  { key: "futsal", sport: "futsal", primary: FREE_MATCH_SOURCES[FREE_SOURCES.futsal.primary.key], fallback: FREE_MATCH_SOURCES[FREE_SOURCES.futsal.fallback.key], prefix: "fs" },
  {
    key: "roller_hockey",
    sport: "roller_hockey",
    primary: FREE_MATCH_SOURCES[FREE_SOURCES.roller_hockey.primary.key],
    fallback: FREE_MATCH_SOURCES[FREE_SOURCES.roller_hockey.fallback.key],
    prefix: "hq",
    filter: (m) => m.competition.type !== "europe",
  },
  {
    key: "roller_hockey_europe",
    sport: "roller_hockey",
    primary: FREE_MATCH_SOURCES[ROLLER_HOCKEY_EUROPE.primary.key],
    fallback: FREE_MATCH_SOURCES[ROLLER_HOCKEY_EUROPE.fallback.key] ?? null,
    prefix: "hq",
    filter: (m) => m.competition.type === "europe",
  },
];

/** Jogos desta competição gravados desde julho do início da época (índice sport + kickoff). */
async function knownMatches(db: Firestore, ref: FreeCompetitionRef, season: string, from?: Date, to?: Date): Promise<MatchDoc[]> {
  let q = db.collection("matches").where("sport", "==", ref.sport).where("kickoff", ">=", from ?? new Date(Date.UTC(seasonStartYear(season), 6, 1)));
  if (to) q = q.where("kickoff", "<=", to);
  const snap = await q.orderBy("kickoff", "asc").get();
  return snap.docs
    .map((s) => fromFirestore(s.data() as MatchDoc))
    .filter((m) => m.id.startsWith(`${ref.prefix}_`) && m.competition?.season === season && (!ref.filter || ref.filter(m)));
}

/** Janela de jogo só com hora confirmada (uma hora aproximada não abre janela, ex. linha sem hora à meia-noite). */
const inWindow = (m: MatchDoc, now: Date) =>
  m.source?.exactKickoff === true && now.getTime() >= m.kickoff.getTime() - BEFORE_MS && now.getTime() <= m.kickoff.getTime() + AFTER_MS;

const stateRef = (db: Firestore, key: string) => db.doc(`ingestState/free_${key}`);

/**
 * Uma competição: pede às duas fontes (a de recurso também, para completar nulos e comparar resultados), reconcilia
 * com o que está gravado e grava com `saveMatch` (merge, `locked`, hash por jogo; nunca apaga). Saúde e alertas em
 * `ingestHealth/free_{key}` (`INGEST_ALERT`). Só falha a execução (sem avançar `lastRunAt`) se a principal falhar e a
 * recurso não der nenhum jogo.
 */
export async function syncFreeCompetition(d: FreeSourcesDeps, ref: FreeCompetitionRef): Promise<{ count: number; ok: boolean; used: string; alerts: string[] }> {
  const now = d.now();
  const season = apiSportsSeason("span", now);
  const known = await knownMatches(d.db, ref, season);
  const ctx: FetchContext = { known, focus: known.filter((m) => inWindow(m, now)), alerts: [] };
  const keep = (ms: NormalizedMatch[]) => (ref.filter ? ms.filter(ref.filter) : ms);
  const run = async (s: MatchSource | null): Promise<NormalizedMatch[] | Error> => {
    if (!s) return [];
    try {
      return keep(await s.fetchMatches(d.fetch, season, now, ctx));
    } catch (e) {
      return e instanceof Error ? e : new Error(String(e));
    }
  };
  const primary = await run(ref.primary);
  const fallback = await run(ref.fallback);
  const r = reconcile(known, primary, fallback, ref.prefix, now);
  r.alerts.push(...new Set(ctx.alerts));
  await applyCrests({ db: d.db, fetch: d.fetch, now }, ref.sport, r.matches, crestRefsOf(ref.sport, [primary, fallback]));

  let count = 0;
  let failed = 0;
  for (const m of r.matches) {
    try {
      const w = await saveMatch(d.db, { match: m });
      if (!w.locked) count++;
    } catch (e) {
      failed++;
      logger.warn(`freeSourcesSync: ${m.id} não gravado: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const source = `free_${ref.key}`;
  // Falha = a principal falhou e a recurso não deu nenhum jogo (erro, inexistente ou vazia).
  const ok = !(primary instanceof Error && (!Array.isArray(fallback) || fallback.length === 0));
  // recordRun é o único que emite INGEST_ALERT: com sucesso leva os avisos da reconciliação; em falha o erro já
  // junta as fontes que falharam e os restantes avisos ficam como detalhe.
  if (ok) await recordRun(d.db, source, { ok: true, count, failed, alerts: r.alerts });
  else {
    const failures = r.alerts.filter((a) => /falhou/.test(a));
    await recordRun(d.db, source, { ok: false, error: failures.join("; ") });
    for (const a of r.alerts) if (!failures.includes(a)) logger.warn(`freeSourcesSync: ${source}: ${a}`);
  }
  // Principal em falha com a recurso a dar jogos: a execução conta, mas a saúde fica "degradada" (não verde).
  const degraded = ok && primary instanceof Error;
  await d.db.doc(`ingestHealth/${source}`).set({ lastUsed: r.used, lastAlerts: r.alerts, degraded }, { merge: true });

  await stateRef(d.db, ref.key).set(ok ? { lastRunAt: now, lastFailureAt: FieldValue.delete() } : { lastFailureAt: now }, { merge: true });
  return { count, ok, used: r.used, alerts: r.alerts };
}

/** Devida: em janela de jogo a cada 15 min; fora dela a cada 6 h; depois de uma falha fora de janela, só passada 1 h. */
export function freeDue(state: { lastRunAt: Date | null; lastFailureAt: Date | null }, windowNow: boolean, now: Date): boolean {
  const t = now.getTime();
  if (!windowNow && state.lastFailureAt !== null && t - state.lastFailureAt.getTime() < FAILURE_BACKOFF_MS) return false;
  if (state.lastRunAt === null) return true;
  return t - state.lastRunAt.getTime() >= (windowNow ? WINDOW_EVERY_MS : IDLE_EVERY_MS);
}

/** Cada URL no máximo uma vez por execução (as competições de hóquei partilham as páginas do hoqueipatins); sem novas tentativas. */
function memoFetch(f: FetchFn): FetchFn {
  const cache = new Map<string, Promise<{ status: number; headers: [string, string][]; body: string }>>();
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    let p = cache.get(url);
    if (!p) {
      p = (async () => {
        const res = await f(url, init);
        return { status: res.status, headers: [...res.headers.entries()], body: await res.text() };
      })();
      cache.set(url, p);
    }
    const r = await p;
    return new Response(r.status === 204 || r.status === 304 ? null : r.body, { status: r.status, headers: r.headers });
  }) as FetchFn;
}

/**
 * Futsal, hóquei nacional, hóquei europeu (e lacunas da API-Sports, hoje nenhuma). Cada competição só pede às fontes
 * quando é devida (`freeDue`, estado em `ingestState/free_{key}`). Uma competição que falha não trava as outras;
 * só lança se todas as que correram falharem. As falhas por competição já alertam em `ingestHealth/free_{key}`:
 * vão em `failedCompetitions` (não em `failed`) para a execução agregada `free_sources` não alertar outra vez.
 */
export async function syncFreeSources(d: FreeSourcesDeps): Promise<{ count: number; failedCompetitions: number }> {
  const now = d.now();
  const season = apiSportsSeason("span", now);
  const deps: FreeSourcesDeps = { ...d, fetch: memoFetch(d.fetch), now: () => now };
  if (API_SPORTS_GAPS.length > 0) logger.warn(`freeSourcesSync: ${API_SPORTS_GAPS.length} lacunas da API-Sports sem implementação (ver FREE_MATCH_SOURCES)`);

  let count = 0;
  let failed = 0;
  let attempted = 0;
  for (const ref of FREE_COMPETITIONS) {
    const snap = await stateRef(d.db, ref.key).get();
    const date = (k: string) => {
      const v = snap.get(k);
      return v ? fromFirestore(v as Date) : null;
    };
    const near = await knownMatches(d.db, ref, season, new Date(now.getTime() - AFTER_MS), new Date(now.getTime() + BEFORE_MS));
    if (!freeDue({ lastRunAt: date("lastRunAt"), lastFailureAt: date("lastFailureAt") }, near.some((m) => inWindow(m, now)), now)) continue;
    attempted++;
    const r = await syncFreeCompetition(deps, ref);
    count += r.count;
    if (!r.ok) failed++;
  }
  if (attempted > 0 && failed === attempted) throw new Error(`freeSourcesSync: as ${failed} competições falharam`);
  return { count, failedCompetitions: failed };
}
