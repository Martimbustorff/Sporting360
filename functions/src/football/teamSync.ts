import { logger } from "firebase-functions";
import { SPORTING_TEAM_ID, crestFor } from "../config/brand";
import { footballApiSeason } from "../model/seasons";
import { MAX_IDS } from "../sources/apiFootball";
import { SourceError } from "../sources/http";
import type { AfTrophy } from "../sources/apiFootball.types";
import { writeDocs } from "../store/writer";
import { currentCompetitions, isQuotaError } from "./competitionSync";
import type { FootballDeps } from "./fixturesSync";

const TEAM = `teams/football_${SPORTING_TEAM_ID}`;
const DAY = 86_400_000;

type StepResult = { count: number; failed?: number };
type Step = { name: string; run: () => Promise<StepResult> };
type Out = { count: number; remaining: number | null; failed: number };

function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

/**
 * Corre os passos por ordem. Um passo que falha conta em `failed` mas não descarta os outros; num erro
 * de quota pára e os passos por correr contam como falhados. Só lança se todos falharem.
 */
async function runSteps(d: FootballDeps, job: string, steps: Step[]): Promise<Out> {
  let count = 0;
  let failed = 0;
  let allFailed = 0;
  for (let i = 0; i < steps.length; i++) {
    try {
      const r = await steps[i].run();
      count += r.count;
      failed += r.failed ?? 0;
    } catch (e) {
      failed++;
      allFailed++;
      logger.warn(`${job}: ${steps[i].name} falhou: ${e instanceof Error ? e.message : String(e)}`);
      if (isQuotaError(e)) {
        const rest = steps.length - i - 1;
        failed += rest;
        allFailed += rest;
        break;
      }
    }
  }
  if (steps.length > 0 && allFailed === steps.length) throw new Error(`${job}: todos os ${allFailed} passos falharam`);
  if (failed > 0) logger.warn(`${job}: ${failed} falhas em ${steps.length} passos`);
  return { count, remaining: d.api.remaining, failed };
}

/** A API recusou ids múltiplos (`errors.players`). */
function isMultiIdRejection(e: unknown): boolean {
  return e instanceof SourceError && e.kind === "api" && /players/i.test(e.message);
}

const write = (d: FootballDeps, name: string, path: string, data: Record<string, unknown>, merge = false) =>
  writeDocs(d.db, [{ path, data, merge }], { stateKey: `team_${name}` });

const sportingId = (id: number) => id === SPORTING_TEAM_ID;

async function squadIds(d: FootballDeps): Promise<string[]> {
  const snap = await d.db.doc(`${TEAM}/data/squad`).get();
  const stored = ((snap.get("players") ?? []) as { id: string }[]).map((p) => p.id);
  if (stored.length > 0) return stored;
  const res = await d.api.squad(SPORTING_TEAM_ID);
  return (res[0]?.players ?? []).map((p) => String(p.id));
}

async function coachId(d: FootballDeps): Promise<string | null> {
  const snap = await d.db.doc(`${TEAM}/data/coach`).get();
  const stored = snap.get("id") as string | undefined;
  if (stored) return stored;
  return currentCoach(await d.api.coachs(SPORTING_TEAM_ID))?.id.toString() ?? null;
}

const openStart = (c: { career: { team: { id: number }; start: string | null; end: string | null }[] }): string =>
  c.career.filter((k) => sportingId(k.team.id) && !k.end).reduce((m, k) => ((k.start ?? "") > m ? (k.start ?? "") : m), "");

/** Treinador com entrada aberta no 228; em caso de várias, a de `start` mais recente. */
function currentCoach<C extends { id: number; career: { team: { id: number }; start: string | null; end: string | null }[] }>(coachs: C[]): C | null {
  const open = coachs.filter((c) => c.career.some((k) => sportingId(k.team.id) && !k.end));
  if (open.length === 0) return null;
  return open.reduce((best, c) => (openStart(c) > openStart(best) ? c : best));
}

/** Plantel, treinador, estatísticas de jogadores e de equipa por competição, lesões. */
export async function syncTeamDaily(d: FootballDeps): Promise<Out> {
  const now = d.now();
  const season = footballApiSeason(now);
  const comps = await currentCompetitions(d.db, season);

  const steps: Step[] = [
    {
      name: "squad",
      run: async () => {
        const res = await d.api.squad(SPORTING_TEAM_ID);
        const players = (res[0]?.players ?? []).map((p) => ({
          id: String(p.id),
          name: p.name,
          age: p.age ?? null,
          number: p.number ?? null,
          position: p.position,
          photo: p.photo ?? null,
        }));
        if (players.length === 0) {
          logger.warn("syncTeamDaily: plantel vazio, documento existente mantido");
          return { count: 0, failed: 1 };
        }
        await write(d, "team", TEAM, { sport: "football", id: String(SPORTING_TEAM_ID), name: res[0].team.name, logo: crestFor(SPORTING_TEAM_ID, res[0].team.logo ?? null) }, true);
        await write(d, "squad", `${TEAM}/data/squad`, { players });
        return { count: players.length };
      },
    },
    {
      name: "coachs",
      run: async () => {
        const c = currentCoach(await d.api.coachs(SPORTING_TEAM_ID));
        if (!c) return { count: 0 };
        const since = c.career.find((k) => sportingId(k.team.id) && !k.end)?.start ?? null;
        await write(d, "coach", `${TEAM}/data/coach`, { id: String(c.id), name: c.name, age: c.age ?? null, nationality: c.nationality ?? null, photo: c.photo ?? null, since });
        return { count: 1 };
      },
    },
    {
      name: "playersBySeason",
      run: async () => {
        const res = await d.api.playersBySeason(SPORTING_TEAM_ID, season);
        const players = [];
        for (const p of res) {
          const stats = p.statistics.filter((s) => sportingId(s.team.id));
          if (stats.length === 0) continue;
          let appearances = 0, minutes = 0, goals = 0, assists = 0, yellow = 0, red = 0, rated = 0, ratedMinutes = 0, ratingSum = 0, ratingN = 0;
          for (const s of stats) {
            const m = s.games.minutes ?? 0;
            appearances += s.games.appearences ?? 0;
            minutes += m;
            goals += s.goals.total ?? 0;
            assists += s.goals.assists ?? 0;
            yellow += s.cards.yellow ?? 0;
            red += s.cards.red ?? 0;
            const r = s.games.rating === null ? NaN : Number(s.games.rating);
            if (Number.isFinite(r)) {
              rated += r * m;
              ratedMinutes += m;
              ratingSum += r;
              ratingN++;
            }
          }
          const rating = ratingN === 0 ? null : Math.round((ratedMinutes > 0 ? rated / ratedMinutes : ratingSum / ratingN) * 100) / 100;
          players.push({ id: String(p.player.id), name: p.player.name, photo: p.player.photo ?? null, appearances, minutes, goals, assists, rating, yellow, red });
        }
        if (players.length === 0) return { count: 0 };
        await write(d, `playerStats_${season}`, `${TEAM}/data/playerStats_${season}`, { players });
        return { count: players.length };
      },
    },
    ...comps.map<Step>((c) => ({
      name: `teamStatistics ${c.leagueId}`,
      run: async () => {
        const r = await d.api.teamStatistics(c.leagueId, c.season, SPORTING_TEAM_ID);
        if (!r || !r.league) return { count: 0 };
        const side = (k: "for" | "against") => {
          const g = r.goals[k] as { total: unknown; minute?: Record<string, { total: number | null; percentage: string | null }> };
          const minute: Record<string, { total: number; percentage: string | null }> = {};
          for (const [bucket, v] of Object.entries(g.minute ?? {})) minute[bucket] = { total: v.total ?? 0, percentage: v.percentage ?? null };
          return { total: g.total, minute };
        };
        await write(d, `teamStats_${c.leagueId}`, `${TEAM}/data/teamStats_${c.leagueId}_${c.season}`, {
          form: r.form ?? null,
          goals: { for: side("for"), against: side("against") },
          fixtures: r.fixtures,
          cleanSheet: r.clean_sheet,
          failedToScore: r.failed_to_score,
        });
        return { count: 1 };
      },
    })),
    {
      name: "injuries",
      run: async () => {
        const res = await d.api.injuries({ team: SPORTING_TEAM_ID, season });
        const from = now.getTime() - 3 * DAY;
        const to = now.getTime() + 14 * DAY;
        const items = res
          .filter((i) => {
            const t = Date.parse(i.fixture.date);
            return Number.isFinite(t) && t >= from && t <= to;
          })
          .map((i) => ({ playerId: String(i.player.id), name: i.player.name, photo: i.player.photo ?? null, type: i.player.type, reason: i.player.reason, fixtureId: String(i.fixture.id), date: i.fixture.date }));
        await write(d, "injuries", `${TEAM}/data/injuries`, { items });
        return { count: items.length };
      },
    },
  ];
  return runSteps(d, "syncTeamDaily", steps);
}

type Trophy = { league: string; country: string; season: string; place: string };
const toTrophy = (t: AfTrophy): Trophy => ({ league: t.league, country: t.country, season: t.season, place: t.place });
/** Id do jogador numa linha de troféus, quando a API o indica. */
const trophyOwner = (t: AfTrophy): string | null => {
  const p = (t as { player?: number | string | { id: number | string } }).player;
  if (p === undefined || p === null) return null;
  return String(typeof p === "object" ? p.id : p);
};

/** Transferências, troféus e paragens de longa duração. */
export async function syncTeamWeekly(d: FootballDeps): Promise<Out> {
  const season = Number(footballApiSeason(d.now()));
  const sinceTs = Date.UTC(season - 1, 7, 1);
  let ids: string[] | null = null;
  const getIds = async () => (ids ??= await squadIds(d));

  const steps: Step[] = [
    {
      name: "transfers",
      run: async () => {
        const res = await d.api.transfers(SPORTING_TEAM_ID);
        const items = [];
        for (const p of res) {
          for (const t of p.transfers) {
            if (!sportingId(t.teams.in.id) && !sportingId(t.teams.out.id)) continue;
            if (!(Date.parse(t.date) >= sinceTs)) continue;
            items.push({
              playerId: String(p.player.id),
              name: p.player.name,
              date: t.date,
              type: t.type ?? null,
              direction: sportingId(t.teams.in.id) ? "in" : "out",
              in: { id: String(t.teams.in.id), name: t.teams.in.name, logo: crestFor(t.teams.in.id, t.teams.in.logo ?? null) },
              out: { id: String(t.teams.out.id), name: t.teams.out.name, logo: crestFor(t.teams.out.id, t.teams.out.logo ?? null) },
            });
          }
        }
        items.sort((a, b) => b.date.localeCompare(a.date));
        if (items.length === 0) return { count: 0 };
        await write(d, "transfers", `${TEAM}/data/transfers`, { items });
        return { count: items.length };
      },
    },
    {
      name: "trophies",
      run: async () => {
        const all = await getIds();
        const coach = await coachId(d);
        if (all.length === 0) throw new Error("plantel indisponível");
        const prev = ((await d.db.doc(`${TEAM}/data/trophies`).get()).get("byPlayer") ?? {}) as Record<string, Trophy[]>;
        const byPlayer: Record<string, Trophy[]> = {};
        let failed = 0;
        let ok = 0;
        let calls = 0;
        const single = async (id: string) => {
          calls++;
          const r = await d.api.trophies({ players: [id] });
          byPlayer[id] = r.map(toTrophy);
        };
        for (const batch of chunk(all, MAX_IDS)) {
          try {
            calls++;
            const r = await d.api.trophies({ players: batch });
            const unknown = r.filter((t) => trophyOwner(t) === null);
            if (unknown.length > 0 && batch.length > 1) throw new SourceError("api-football", "parse", "troféus sem id de jogador num pedido múltiplo");
            for (const id of batch) byPlayer[id] = [];
            for (const t of r) (byPlayer[trophyOwner(t) ?? batch[0]] ??= []).push(toTrophy(t));
            ok++;
          } catch (e) {
            if (isQuotaError(e)) throw e;
            if (isMultiIdRejection(e) || (e instanceof SourceError && e.kind === "parse")) {
              logger.warn("syncTeamWeekly: troféus em lote recusados, um a um");
              for (const id of batch) {
                try {
                  await single(id);
                } catch (e2) {
                  if (isQuotaError(e2)) throw e2;
                  failed++;
                  if (prev[id]) byPlayer[id] = prev[id];
                }
              }
              logger.info(`syncTeamWeekly: troféus, ${calls} chamadas`);
              ok++;
            } else {
              failed++;
              for (const id of batch) if (prev[id]) byPlayer[id] = prev[id];
            }
          }
        }
        let coachTrophies: Trophy[] = [];
        if (coach) {
          try {
            coachTrophies = (await d.api.trophies({ coach })).map(toTrophy);
          } catch (e) {
            if (isQuotaError(e)) throw e;
            failed++;
            coachTrophies = ((await d.db.doc(`${TEAM}/data/trophies`).get()).get("coach") ?? []) as Trophy[];
          }
        }
        if (ok === 0) throw new Error("todos os pedidos de troféus falharam");
        await write(d, "trophies", `${TEAM}/data/trophies`, { byPlayer, coach: coachTrophies });
        return { count: Object.values(byPlayer).reduce((n, t) => n + t.length, 0) + coachTrophies.length, failed };
      },
    },
    {
      name: "sidelined",
      run: async () => {
        const all = await getIds();
        if (all.length === 0) throw new Error("plantel indisponível");
        const prev = ((await d.db.doc(`${TEAM}/data/sidelined`).get()).get("byPlayer") ?? {}) as Record<string, { type: string; start: string; end: string | null }[]>;
        const byPlayer: Record<string, { type: string; start: string; end: string | null }[]> = {};
        let failed = 0;
        let ok = 0;
        let calls = 0;
        const fill = (batch: string[], r: Awaited<ReturnType<typeof d.api.sidelined>>) => {
          for (const id of batch) byPlayer[id] = [];
          for (const row of r) {
            const id = row.id !== undefined ? String(row.id) : batch.length === 1 ? batch[0] : null;
            if (id === null || !batch.includes(id)) continue;
            byPlayer[id] = row.sidelined.map((s) => ({ type: s.type, start: s.start, end: s.end ?? null }));
          }
        };
        for (const batch of chunk(all, MAX_IDS)) {
          try {
            calls++;
            fill(batch, await d.api.sidelined(batch));
            ok++;
          } catch (e) {
            if (isQuotaError(e)) throw e;
            if (isMultiIdRejection(e)) {
              logger.warn("syncTeamWeekly: sidelined em lote recusado, um a um");
              for (const id of batch) {
                try {
                  calls++;
                  fill([id], await d.api.sidelined([id]));
                } catch (e2) {
                  if (isQuotaError(e2)) throw e2;
                  failed++;
                  if (prev[id]) byPlayer[id] = prev[id];
                }
              }
              logger.info(`syncTeamWeekly: sidelined, ${calls} chamadas`);
              ok++;
            } else {
              failed++;
              for (const id of batch) if (prev[id]) byPlayer[id] = prev[id];
            }
          }
        }
        if (ok === 0) throw new Error("todos os pedidos de sidelined falharam");
        for (const [id, v] of Object.entries(byPlayer)) if (v.length === 0) delete byPlayer[id];
        await write(d, "sidelined", `${TEAM}/data/sidelined`, { byPlayer });
        return { count: Object.keys(byPlayer).length, failed };
      },
    },
  ];
  return runSteps(d, "syncTeamWeekly", steps);
}
