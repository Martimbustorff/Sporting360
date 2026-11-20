import { type FetchFn, Quota, assertNoApiErrors, getJson, type ApiEnvelope } from "./http";
import type {
  AfCoach,
  AfFixture,
  AfFixtureCore,
  AfInjury,
  AfPlayerSeason,
  AfPrediction,
  AfSidelined,
  AfSquad,
  AfStandingsResponse,
  AfTeamSeasonStats,
  AfTopPlayer,
  AfTransfer,
  AfTrophy,
  AfVenue,
} from "./apiFootball.types";

const SOURCE = "api-football";
export const API_FOOTBALL_HOST = "api-football-v1.p.rapidapi.com";
export const MAX_IDS = 20;

export interface ApiFootballClient {
  readonly calls: number;
  readonly remaining: number | null;
  fixturesByTeamSeason(team: number, season: string): Promise<AfFixtureCore[]>;
  /** Últimos `n` jogos de uma equipa em qualquer competição (`fixtures?team=&last=`): 1 pedido. */
  lastFixtures(team: number, n: number): Promise<AfFixtureCore[]>;
  fixturesByIds(ids: string[]): Promise<AfFixture[]>;
  /** Jogos ao vivo de uma liga (`fixtures?live=all&league=`): 1 pedido, conta na quota como os outros. */
  liveFixtures(league: number): Promise<AfFixtureCore[]>;
  rounds(league: number, season: string): Promise<string[]>;
  fixturesByLeague(league: number, season: string): Promise<AfFixtureCore[]>;
  standings(league: number, season: string): Promise<AfStandingsResponse[]>;
  topPlayers(kind: "topscorers" | "topassists" | "topyellowcards" | "topredcards", league: number, season: string): Promise<AfTopPlayer[]>;
  squad(team: number): Promise<AfSquad[]>;
  coachs(team: number): Promise<AfCoach[]>;
  playersBySeason(team: number, season: string): Promise<AfPlayerSeason[]>;
  teamStatistics(league: number, season: string, team: number): Promise<AfTeamSeasonStats>;
  injuries(q: { team: number; season: string } | { fixture: string }): Promise<AfInjury[]>;
  predictions(fixture: string): Promise<AfPrediction[]>;
  transfers(team: number): Promise<AfTransfer[]>;
  trophies(q: { players: string[] } | { coach: string }): Promise<AfTrophy[]>;
  sidelined(players: string[]): Promise<AfSidelined[]>;
  venue(id: number): Promise<AfVenue[]>;
}

export function apiFootball(o: { key: string; fetch?: FetchFn; host?: string; timeoutMs?: number }): ApiFootballClient {
  const f = o.fetch ?? fetch;
  const host = o.host ?? API_FOOTBALL_HOST;
  const base = `https://${host}/v3`;
  const headers = { "X-RapidAPI-Key": o.key, "X-RapidAPI-Host": host };
  const quota = new Quota();

  async function envelope<T>(path: string, params: Array<[string, string | number]>): Promise<ApiEnvelope<T>> {
    const qs = params.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
    const { body, headers: h } = await getJson<ApiEnvelope<T>>(f, `${base}/${path}${qs ? `?${qs}` : ""}`, {
      source: SOURCE,
      headers,
      timeoutMs: o.timeoutMs,
    });
    quota.note(h);
    assertNoApiErrors(SOURCE, body);
    return body;
  }
  const get = async <T>(path: string, params: Array<[string, string | number]> = []): Promise<T> =>
    (await envelope<T>(path, params)).response;

  return {
    get calls() {
      return quota.calls;
    },
    get remaining() {
      return quota.remaining;
    },
    fixturesByTeamSeason: (team, season) => get("fixtures", [["team", team], ["season", season]]),
    lastFixtures: (team, n) => get("fixtures", [["team", team], ["last", n]]),
    fixturesByIds: (ids) => {
      if (ids.length > MAX_IDS) return Promise.reject(new Error(`fixturesByIds: máximo ${MAX_IDS} ids por pedido (recebeu ${ids.length})`));
      return get("fixtures", [["ids", ids.join("-")]]);
    },
    liveFixtures: (league) => get("fixtures", [["live", "all"], ["league", league]]),
    rounds: (league, season) => get("fixtures/rounds", [["league", league], ["season", season]]),
    fixturesByLeague: (league, season) => get("fixtures", [["league", league], ["season", season]]),
    standings: (league, season) => get("standings", [["league", league], ["season", season]]),
    topPlayers: (kind, league, season) => get(`players/${kind}`, [["league", league], ["season", season]]),
    squad: (team) => get("players/squads", [["team", team]]),
    coachs: (team) => get("coachs", [["team", team]]),
    async playersBySeason(team, season) {
      const all: AfPlayerSeason[] = [];
      let page = 1;
      let total = 1;
      do {
        const body = await envelope<AfPlayerSeason[]>("players", [["team", team], ["season", season], ["page", page]]);
        all.push(...body.response);
        total = body.paging?.total ?? 1;
        page += 1;
      } while (page <= total);
      return all;
    },
    teamStatistics: (league, season, team) => get("teams/statistics", [["league", league], ["season", season], ["team", team]]),
    injuries: (q) => get("injuries", "fixture" in q ? [["fixture", q.fixture]] : [["team", q.team], ["season", q.season]]),
    predictions: (fixture) => get("predictions", [["fixture", fixture]]),
    transfers: (team) => get("transfers", [["team", team]]),
    trophies: (q) => get("trophies", "players" in q ? [["players", q.players.join("-")]] : [["coach", q.coach]]),
    sidelined: (players) => get("sidelined", [["players", players.join("-")]]),
    venue: (id) => get("venues", [["id", id]]),
  };
}
