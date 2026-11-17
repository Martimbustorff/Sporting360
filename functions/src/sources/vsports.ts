import { type FetchFn, getJson } from "./http";

const BASE = "https://apism.vsports.pt";
const SOURCE = "vsports";

// A VSports numera as épocas por conta própria: 30 = 2025/2026, +1 por época. A época começa em agosto.
const BASE_ID = 30;
const BASE_YEAR = 2025;

export function vsportsSeasonId(now: Date, override?: number): number {
  if (override !== undefined && Number.isFinite(override)) return override;
  const startYear = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return BASE_ID + (startYear - BASE_YEAR);
}

export interface VsportsTeam {
  id: string;
  name: string;
  abbrv?: string;
  emblem?: string;
}

export interface VsportsRoundsResponse {
  pp: string;
  cp: { id: string; slug: string; name: string; emblem?: string };
  season: { id: string; name: string };
  matches: {
    id: string;
    dt: string;
    hr: string;
    n_vdos: string;
    status: { id: string; name: string };
    mday: { id: string; index: string; name: string };
    hteam: VsportsTeam;
    ateam: VsportsTeam;
  }[];
}

export interface VsportsVideosResponse {
  pp: number;
  match: { id: string; dt: string; hr: string; htgoal: string; atgoal: string; name: string; hteam: { id: string; name: string }; ateam: { id: string; name: string } };
  n_vdos: number;
  vdos: {
    id: string;
    dt: string;
    type: string;
    minute: string;
    title: string;
    bigpic: string;
    vdo: string;
    res?: string;
    links: { video: string; embed: string };
  }[];
}

export interface VsportsClient {
  rounds(cp: string, seasonId: number): Promise<VsportsRoundsResponse>;
  videosByMatch(matchId: string): Promise<VsportsVideosResponse>;
}

export function vsports(o: { key: string; fetch?: FetchFn; timeoutMs?: number }): VsportsClient {
  const f = o.fetch ?? fetch;
  const opts = { source: SOURCE, headers: { KEY: o.key }, timeoutMs: o.timeoutMs };
  return {
    async rounds(cp, seasonId) {
      const url = `${BASE}/pesquisa-sec?scp&cp=${encodeURIComponent(cp)}&ep=${seasonId}&lst=match&pp=0&vp=310&eq=6`;
      return (await getJson<VsportsRoundsResponse>(f, url, opts)).body;
    },
    async videosByMatch(matchId) {
      const url = `${BASE}/vdo-pesquisa-sec?scp&gm=${encodeURIComponent(matchId)}`;
      return (await getJson<VsportsVideosResponse>(f, url, opts)).body;
    },
  };
}
