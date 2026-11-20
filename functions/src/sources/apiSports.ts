import { API_SPORTS } from "../modalities/sourcesConfig";
import { type FetchFn, Quota, assertNoApiErrors, getJson, type ApiEnvelope } from "./http";

export type ApiSportsSport = "handball" | "volleyball" | "basketball";

export interface ApiSportsClient {
  readonly calls: number;
  readonly remaining: number | null;
  games(q: { team: number; season: string }): Promise<unknown[]>;
  standings(q: { league: number; season: string }): Promise<unknown[]>;
}

/**
 * Cliente fino da API-Sports direta (andebol, voleibol, basquetebol); `key` é a APISPORTS_KEY do painel da API-Sports.
 * 20/11: as três APIs deixaram de estar disponíveis na RapidAPI, por isso vão ao host `v1.<desporto>.api-sports.io`
 * com o cabeçalho `x-apisports-key` (mesmo formato de resposta). Os ids reais ficam em sourcesConfig.
 */
export function apiSports(o: { sport: ApiSportsSport; key: string; fetch?: FetchFn; host?: string; timeoutMs?: number }): ApiSportsClient {
  const f = o.fetch ?? fetch;
  const host = o.host ?? API_SPORTS[o.sport].host;
  const source = `api-sports-${o.sport}`;
  const quota = new Quota();

  async function get(path: string, params: Array<[string, string | number]>): Promise<unknown[]> {
    const qs = params.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
    const { body, headers } = await getJson<ApiEnvelope<unknown[]>>(f, `https://${host}/${path}?${qs}`, {
      source,
      headers: { "x-apisports-key": o.key },
      timeoutMs: o.timeoutMs,
    });
    quota.note(headers);
    assertNoApiErrors(source, body);
    return body.response;
  }

  return {
    get calls() {
      return quota.calls;
    },
    get remaining() {
      return quota.remaining;
    },
    games: (q) => get("games", [["team", q.team], ["season", q.season]]),
    standings: (q) => get("standings", [["league", q.league], ["season", q.season]]),
  };
}
