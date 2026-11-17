import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { crestFor } from "../config/brand";
import { LEGACY_STANDINGS_LEAGUES, legacyStandings } from "../legacy/standingsLegacy";
import { competitionKey, competitionLabel, roundLabel } from "../model/labels";
import { footballApiSeason } from "../model/seasons";
import { FINAL_STATUSES, footballStatus } from "../model/status";
import type { CompetitionType } from "../model/types";
import type { AfFixtureCore, AfStandingsResponse, AfTopPlayer } from "../sources/apiFootball.types";
import { legacyCollection, writeDocs, type DocWrite } from "../store/writer";
import type { FootballDeps } from "./fixturesSync";

const TOP_KINDS = ["topscorers", "topassists", "topyellowcards", "topredcards"] as const;
type TopKind = (typeof TOP_KINDS)[number];

const keyOf = (leagueId: number, season: string) => competitionKey("football", leagueId, season);

/** Ligas distintas dos jogos de futebol de uma época, sem particulares (ordenadas por id). */
export async function currentCompetitions(db: Firestore, season: string): Promise<{ leagueId: number; season: string }[]> {
  const snap = await db.collection("matches").where("sport", "==", "football").where("competition.season", "==", season).get();
  const ids = new Set<number>();
  for (const s of snap.docs) {
    const c = s.get("competition") as { id: string; type: CompetitionType };
    const id = Number(c.id);
    if (c.type !== "friendly" && Number.isFinite(id)) ids.add(id);
  }
  return [...ids].sort((a, b) => a - b).map((leagueId) => ({ leagueId, season }));
}

function competitionDoc(leagueId: number, rawName: string, logo: string | null): DocumentData {
  const label = competitionLabel("football", leagueId, rawName);
  const data: DocumentData = { sport: "football", leagueId, name: label.name, type: label.type };
  if (logo) data.logo = logo;
  return data;
}

/**
 * 1 chamada. Escreve `competitions/{key}` e `data/standings` e, para as ligas que a V2 lê, `standings`
 * nas coleções antigas. Resposta vazia: não toca em nada e devolve count 0.
 */
export async function refreshStandings(d: FootballDeps, leagueId: number, season: string): Promise<{ count: number }> {
  const response = await d.api.standings(leagueId, season);
  const first = response[0];
  if (!first || first.league.standings.length === 0) return { count: 0 };

  const key = keyOf(leagueId, season);
  const groups = first.league.standings.map((rows) => ({
    name: rows[0]?.group ?? "",
    rows: rows.map((r) => ({
      rank: r.rank,
      teamId: String(r.team.id),
      name: r.team.name,
      logo: crestFor(r.team.id, r.team.logo ?? null),
      points: r.points,
      played: r.all.played,
      win: r.all.win,
      draw: r.all.draw,
      lose: r.all.lose,
      goalsFor: r.all.goals.for,
      goalsAgainst: r.all.goals.against,
      goalsDiff: r.goalsDiff,
      form: r.form ?? null,
      description: r.description ?? null,
    })),
  }));

  const writes: DocWrite[] = [
    { path: `competitions/${key}`, data: competitionDoc(leagueId, first.league.name, first.league.logo ?? null), merge: true },
    { path: `competitions/${key}/data/standings`, data: { groups } },
  ];
  if (LEGACY_STANDINGS_LEAGUES.includes(leagueId)) {
    for (const [id, data] of Object.entries(legacyStandings(response as AfStandingsResponse[], leagueId, season))) {
      writes.push({ path: `${legacyCollection("standings", d.prefix)}/${id}`, data, legacy: true });
    }
  }
  await writeDocs(d.db, writes, { stateKey: `standings_${key}` });
  return { count: groups.reduce((n, g) => n + g.rows.length, 0) };
}

/** Todas as competições atuais: um pedido de classificação por competição. Falha só se todas falharem. */
export async function syncStandings(d: FootballDeps): Promise<{ count: number; remaining: number | null }> {
  const comps = await currentCompetitions(d.db, footballApiSeason(d.now()));
  let count = 0;
  let failed = 0;
  for (const c of comps) {
    try {
      count += (await refreshStandings(d, c.leagueId, c.season)).count;
    } catch (e) {
      failed++;
      logger.warn(`syncStandings: liga ${c.leagueId} ignorada: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (failed > 0 && failed === comps.length) throw new Error(`syncStandings: todas as ${failed} competições falharam`);
  return { count, remaining: d.api.remaining };
}

/** Primeira ronda (pela ordem da API) com um jogo por terminar; `null` se não houver. */
function currentRound(rounds: string[], fixtures: AfFixtureCore[]): string | null {
  const open = new Set<string>();
  for (const f of fixtures) {
    const st = footballStatus(f.fixture.status.short);
    if (!FINAL_STATUSES.has(st) && st !== "CANC") open.add(f.league.round);
  }
  return rounds.find((r) => open.has(r)) ?? null;
}

function topItems(kind: TopKind, players: AfTopPlayer[]) {
  const items = [];
  for (const p of players) {
    const s = p.statistics[0];
    if (!s) continue;
    const value = kind === "topscorers" ? s.goals.total : kind === "topassists" ? s.goals.assists : kind === "topyellowcards" ? s.cards.yellow : s.cards.red;
    items.push({
      playerId: String(p.player.id),
      name: p.player.name,
      photo: p.player.photo ?? null,
      teamId: String(s.team.id),
      teamName: s.team.name,
      teamLogo: crestFor(s.team.id, s.team.logo ?? null),
      value: value ?? 0,
    });
  }
  return items;
}

/**
 * Para cada competição atual: rondas, calendário e (ligas e europeias) os 4 tops. Respostas vazias
 * não tocam no documento existente. Uma competição que falha não aborta as outras.
 */
export async function syncCompetitions(d: FootballDeps): Promise<{ count: number; remaining: number | null }> {
  const comps = await currentCompetitions(d.db, footballApiSeason(d.now()));
  let count = 0;
  let failed = 0;
  for (const { leagueId, season } of comps) {
    try {
      count += await syncOne(d, leagueId, season);
    } catch (e) {
      failed++;
      logger.warn(`syncCompetitions: liga ${leagueId} ignorada: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (failed > 0 && failed === comps.length) throw new Error(`syncCompetitions: todas as ${failed} competições falharam`);
  return { count, remaining: d.api.remaining };
}

async function syncOne(d: FootballDeps, leagueId: number, season: string): Promise<number> {
  const key = keyOf(leagueId, season);
  const rawRounds = await d.api.rounds(leagueId, season);
  const fixtures = await d.api.fixturesByLeague(leagueId, season);
  const rawName = fixtures[0]?.league.name ?? "";
  const label = competitionLabel("football", leagueId, rawName);
  const writes: DocWrite[] = [];
  let count = 0;

  if (fixtures.length > 0) {
    writes.push({ path: `competitions/${key}`, data: competitionDoc(leagueId, rawName, fixtures[0].league.logo ?? null), merge: true });
    const items = fixtures.map((f) => ({
      id: String(f.fixture.id),
      kickoff: new Date(f.fixture.date),
      round: f.league.round,
      roundLabel: roundLabel(f.league.round, label.type),
      home: { id: String(f.teams.home.id), name: f.teams.home.name, logo: crestFor(f.teams.home.id, f.teams.home.logo ?? null) },
      away: { id: String(f.teams.away.id), name: f.teams.away.name, logo: crestFor(f.teams.away.id, f.teams.away.logo ?? null) },
      status: footballStatus(f.fixture.status.short),
      score: { home: f.goals.home, away: f.goals.away },
    }));
    writes.push({ path: `competitions/${key}/data/fixtures`, data: { items } });
    count += items.length;
  }

  if (rawRounds.length > 0) {
    writes.push({
      path: `competitions/${key}/data/rounds`,
      data: { items: rawRounds.map((raw) => ({ raw, label: roundLabel(raw, label.type) ?? raw })), current: currentRound(rawRounds, fixtures) },
    });
  }

  if (label.type === "league" || label.type === "europe") {
    for (const kind of TOP_KINDS) {
      const items = topItems(kind, await d.api.topPlayers(kind, leagueId, season));
      if (items.length > 0) writes.push({ path: `competitions/${key}/data/${kind}`, data: { items } });
    }
  }

  await writeDocs(d.db, writes, { stateKey: `competition_${key}` });
  return count;
}
