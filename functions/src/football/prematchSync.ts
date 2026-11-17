import { logger } from "firebase-functions";
import { crestFor } from "../config/brand";
import type { MatchDoc } from "../model/types";
import type { AfFixtureCore, AfPrediction } from "../sources/apiFootball.types";
import { writeDocs } from "../store/writer";
import { isQuotaError } from "./competitionSync";
import { listFootballWindow, type FootballDeps } from "./fixturesSync";

const HOUR = 3_600_000;
const AHEAD_MS = 48 * HOUR;
const REFRESH_MS = 12 * HOUR;

type Out = { count: number; remaining: number | null; failed: number };
type SideTeam = { league?: { form?: string | null }; last_5?: Record<string, unknown> };

const pct = (s: string | null | undefined): number => {
  const n = Number.parseFloat(s ?? "");
  return Number.isFinite(n) ? n : 0;
};

function last5(t: SideTeam | undefined) {
  const l = t?.last_5 as { played?: number; form?: string; att?: string; def?: string; goals?: { for?: { total?: number; average?: string }; against?: { total?: number; average?: string } } } | undefined;
  if (!l) return null;
  return {
    played: l.played ?? null,
    form: l.form ?? null,
    att: l.att ?? null,
    def: l.def ?? null,
    goalsFor: l.goals?.for?.total ?? null,
    goalsAgainst: l.goals?.against?.total ?? null,
  };
}

function h2hEntry(f: AfFixtureCore) {
  const kickoff = Date.parse(f.fixture.date);
  if (!Number.isFinite(kickoff)) return null;
  const side = (t: AfFixtureCore["teams"]["home"]) => ({ id: String(t.id), name: t.name, logo: crestFor(t.id, t.logo ?? null) });
  return { id: String(f.fixture.id), kickoff: new Date(kickoff), home: side(f.teams.home), away: side(f.teams.away), score: { home: f.goals.home ?? null, away: f.goals.away ?? null } };
}

function prematchDoc(p: AfPrediction, now: Date) {
  const w = p.predictions.winner;
  const home = p.teams.home as SideTeam;
  const away = p.teams.away as SideTeam;
  return {
    fetchedAt: now,
    advice: p.predictions.advice ?? "",
    winner: w && w.id !== null ? { id: String(w.id), name: w.name ?? "", comment: w.comment ?? "" } : null,
    percent: { home: pct(p.predictions.percent.home), draw: pct(p.predictions.percent.draw), away: pct(p.predictions.percent.away) },
    form: { home: home.league?.form ?? "", away: away.league?.form ?? "" },
    last5: { home: last5(home), away: last5(away) },
    h2h: (p.h2h ?? []).map(h2hEntry).filter((e): e is NonNullable<typeof e> => e !== null),
  };
}

async function needsRefresh(d: FootballDeps, id: string, nowMs: number): Promise<boolean> {
  const at = (await d.db.doc(`matches/${id}/details/prematch`).get()).get("fetchedAt") as { toMillis(): number } | undefined;
  return !at || nowMs - at.toMillis() > REFRESH_MS;
}

const write = (d: FootballDeps, id: string, path: string, data: Record<string, unknown>, merge = false) =>
  writeDocs(d.db, [{ path, data, merge }], { stateKey: `prematch_${id}` });

/** Estádio: usa `venues/{id}` se existir (sem chamada); senão 1 chamada. Só toca em venue.capacity e image. */
async function syncVenue(d: FootballDeps, m: MatchDoc): Promise<void> {
  const vid = m.venue?.id;
  if (!vid) return;
  const ref = d.db.doc(`venues/${vid}`);
  let v = (await ref.get()).data() as { capacity?: number | null; image?: string | null } | undefined;
  if (!v) {
    const res = await d.api.venue(Number(vid));
    const x = res[0];
    if (!x) return;
    v = { capacity: x.capacity ?? null, image: x.image ?? null };
    await write(d, `venue_${vid}`, `venues/${vid}`, { name: x.name, city: x.city ?? null, address: x.address ?? null, capacity: x.capacity ?? null, surface: x.surface ?? null, image: x.image ?? null });
  }
  const capacity = v.capacity ?? null;
  const image = v.image ?? null;
  if (m.venue?.capacity === capacity && m.venue?.image === image) return;
  // Merge só dos campos aninhados: saveMatch/mapFixture nunca os escrevem, por isso sobrevivem.
  await write(d, m.id, `matches/${m.id}`, { venue: { capacity, image } }, true);
}

/**
 * Jogos NS nas próximas 48 h cujo `details/prematch` tem mais de 12 h (ou não existe): previsões
 * (inclui h2h), lesões do jogo e estádio. Um jogo que falha não bloqueia os outros; quota pára o lote.
 */
export async function syncPrematch(d: FootballDeps): Promise<Out> {
  const now = d.now();
  const window = await listFootballWindow(d.db, now, new Date(now.getTime() + AHEAD_MS));
  const due: MatchDoc[] = [];
  for (const m of window) if (m.status === "NS" && (await needsRefresh(d, m.id, now.getTime()))) due.push(m);

  let count = 0;
  let failed = 0;
  for (let i = 0; i < due.length; i++) {
    const m = due[i];
    let bad = false;
    let quota = false;
    const step = async (name: string, fn: () => Promise<void>) => {
      if (quota) return;
      try {
        await fn();
      } catch (e) {
        bad = true;
        logger.warn(`syncPrematch: ${name} do jogo ${m.id} falhou: ${e instanceof Error ? e.message : String(e)}`);
        if (isQuotaError(e)) quota = true;
      }
    };
    await step("previsões", async () => {
      const p = (await d.api.predictions(m.id))[0];
      if (p) await write(d, m.id, `matches/${m.id}/details/prematch`, prematchDoc(p, now));
    });
    await step("lesões", async () => {
      const res = await d.api.injuries({ fixture: m.id });
      const items = res.map((x) => ({ teamId: String(x.team.id), playerId: String(x.player.id), name: x.player.name, photo: x.player.photo ?? null, type: x.player.type, reason: x.player.reason }));
      if (items.length > 0) await write(d, m.id, `matches/${m.id}/details/injuries`, { items });
    });
    await step("estádio", () => syncVenue(d, m));
    if (bad) failed++;
    else count++;
    if (quota) {
      failed += due.length - i - 1;
      break;
    }
  }
  if (due.length > 0 && failed >= due.length) throw new Error(`syncPrematch: todos os ${failed} jogos falharam`);
  if (failed > 0) logger.error("INGEST_ALERT", { source: "football_prematch", reason: `${failed} falhas em ${due.length} jogos` });
  return { count, remaining: d.api.remaining, failed };
}
