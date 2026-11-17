import * as fs from "fs";
import * as path from "path";
import { fakeFetch } from "../helpers/fakeFetch";
import { SourceError, type FetchFn } from "../../src/sources/http";
import { apiFootball } from "../../src/sources/apiFootball";
import { apiSports } from "../../src/sources/apiSports";
import { vsports, vsportsSeasonId } from "../../src/sources/vsports";
import { fetchFeed } from "../../src/sources/rss";
import { twitter } from "../../src/sources/twitter";

const HOST = "api-football-v1.p.rapidapi.com";
const KEY = "test-key-not-real";

const caught = async (p: Promise<unknown>): Promise<SourceError> => {
  try {
    await p;
  } catch (e) {
    return e as SourceError;
  }
  throw new Error("esperava uma falha");
};

describe("fakeFetch", () => {
  it("sem rota correspondente lança erro", async () => {
    const f = fakeFetch([[/foo/, { a: 1 }]]);
    await expect(f("https://x.test/bar")).rejects.toThrow("fakeFetch: sem rota para https://x.test/bar");
  });
  it("array serve por ordem e a última repete; função recebe (url, n)", async () => {
    const f = fakeFetch([
      [/seq/, [{ n: 1 }, { n: 2 }]],
      [/fn/, (_u, n) => ({ n })],
    ]);
    const j = async (u: string) => (await f(u)).json();
    expect(await j("https://x/seq")).toEqual({ n: 1 });
    expect(await j("https://x/seq")).toEqual({ n: 2 });
    expect(await j("https://x/seq")).toEqual({ n: 2 });
    expect(await j("https://x/fn")).toEqual({ n: 0 });
    expect(await j("https://x/fn")).toEqual({ n: 1 });
    expect(f.calls).toHaveLength(5);
  });
  it("string é um caminho de fixture e { status } é uma resposta crua", async () => {
    const f = fakeFetch([
      [/ok/, "api-football/venue.json"],
      [/bad/, { status: 503, body: "x", headers: { "x-a": "b" } }],
    ]);
    expect(((await (await f("https://x/ok")).json()) as { get: string }).get).toBe("venues");
    const r = await f("https://x/bad");
    expect(r.status).toBe(503);
    expect(r.headers.get("x-a")).toBe("b");
  });
});

describe("apiFootball", () => {
  it("fixturesByTeamSeason: URL, cabeçalhos, response, calls e remaining", async () => {
    const f = fakeFetch([
      [/fixtures\?team=228&season=2026$/, { status: 200, body: JSON.parse(fs.readFileSync(path.join(__dirname, "../fixtures/api-football/fixtures-team-season.json"), "utf8")), headers: { "x-ratelimit-requests-remaining": "7123" } }],
    ]);
    const api = apiFootball({ key: KEY, fetch: f });
    expect(api.calls).toBe(0);
    expect(api.remaining).toBeNull();
    const r = await api.fixturesByTeamSeason(228, "2026");
    expect(r).toHaveLength(4);
    expect(f.calls).toEqual([`https://${HOST}/v3/fixtures?team=228&season=2026`]);
    const h = f.inits[0].headers as Record<string, string>;
    expect(h["X-RapidAPI-Key"]).toBe(KEY);
    expect(h["X-RapidAPI-Host"]).toBe(HOST);
    expect(api.calls).toBe(1);
    expect(api.remaining).toBe(7123);
  });

  it("errors com conteúdo (200) → SourceError api; errors: [] → ok", async () => {
    const bad = apiFootball({ key: KEY, fetch: fakeFetch([[/./, "api-football/errors-ratelimit.json"]]) });
    const e = await caught(bad.fixturesByTeamSeason(228, "2026"));
    expect(e).toBeInstanceOf(SourceError);
    expect(e.kind).toBe("api");
    expect(e.source).toBe("api-football");
    const ok = apiFootball({ key: KEY, fetch: fakeFetch([[/./, "api-football/fixtures-team-season.json"]]) });
    await expect(ok.fixturesByTeamSeason(228, "2026")).resolves.toHaveLength(4);
  });

  it("HTTP 500 → kind http com status; nunca responde → kind timeout", async () => {
    const down = apiFootball({ key: KEY, fetch: fakeFetch([[/./, { status: 500, body: "boom" }]]) });
    const e = await caught(down.standings(94, "2026"));
    expect(e.kind).toBe("http");
    expect(e.status).toBe(500);

    const never: FetchFn = () => new Promise<Response>(() => undefined);
    const slow = apiFootball({ key: KEY, fetch: never, timeoutMs: 50 });
    const t = await caught(slow.standings(94, "2026"));
    expect(t.kind).toBe("timeout");
  });

  it("JSON inválido → kind parse", async () => {
    const api = apiFootball({ key: KEY, fetch: fakeFetch([[/./, { status: 200, body: "<html>" }]]) });
    expect((await caught(api.venue(1))).kind).toBe("parse");
  });

  it("fixturesByIds: máx. 20 e separador '-'", async () => {
    const f = fakeFetch([[/fixtures\?ids=/, "api-football/fixture-ft.json"]]);
    const api = apiFootball({ key: KEY, fetch: f });
    const ids21 = Array.from({ length: 21 }, (_, i) => String(i + 1));
    await expect(api.fixturesByIds(ids21)).rejects.toThrow(/20/);
    expect(f.calls).toHaveLength(0);
    await api.fixturesByIds(["a", "b", "c"]);
    expect(f.calls[0]).toBe(`https://${HOST}/v3/fixtures?ids=a-b-c`);
  });

  it("playersBySeason segue o paging e junta os arrays", async () => {
    const f = fakeFetch([
      [/players\?team=228&season=2026&page=1$/, "api-football/players-228-p1.json"],
      [/players\?team=228&season=2026&page=2$/, "api-football/players-228-p2.json"],
    ]);
    const api = apiFootball({ key: KEY, fetch: f });
    const all = await api.playersBySeason(228, "2026");
    expect(f.calls).toHaveLength(2);
    expect(all).toHaveLength(30);
    expect(api.calls).toBe(2);
  });

  it("restantes métodos usam os caminhos e parâmetros esperados", async () => {
    const f = fakeFetch([[/./, { get: "x", parameters: {}, errors: [], results: 1, paging: { current: 1, total: 1 }, response: [{ ok: true }] }]]);
    const api = apiFootball({ key: KEY, fetch: f });
    await api.rounds(94, "2026");
    await api.fixturesByLeague(94, "2026");
    await api.topPlayers("topassists", 94, "2026");
    await api.squad(228);
    await api.coachs(228);
    await api.injuries({ team: 228, season: "2026" });
    await api.injuries({ fixture: "9" });
    await api.predictions("9");
    await api.transfers(228);
    await api.trophies({ players: ["1", "2"] });
    await api.trophies({ coach: "7" });
    await api.sidelined(["1", "2"]);
    await api.venue(1);
    const base = `https://${HOST}/v3/`;
    expect(f.calls.map((u) => u.slice(base.length))).toEqual([
      "fixtures/rounds?league=94&season=2026",
      "fixtures?league=94&season=2026",
      "players/topassists?league=94&season=2026",
      "players/squads?team=228",
      "coachs?team=228",
      "injuries?team=228&season=2026",
      "injuries?fixture=9",
      "predictions?fixture=9",
      "transfers?team=228",
      "trophies?players=1-2",
      "trophies?coach=7",
      "sidelined?players=1-2",
      "venues?id=1",
    ]);
  });

  it("teamStatistics devolve o objeto response", async () => {
    const f = fakeFetch([[/teams\/statistics/, "api-football/team-stats-94.json"]]);
    const t = await apiFootball({ key: KEY, fetch: f }).teamStatistics(94, "2026", 228);
    expect(f.calls[0]).toBe(`https://${HOST}/v3/teams/statistics?league=94&season=2026&team=228`);
    expect(t.team.id).toBe(228);
    expect(Array.isArray(t)).toBe(false);
  });
});

describe("apiSports", () => {
  it("games e standings: host por omissão da config, calls e remaining", async () => {
    const f = fakeFetch([
      [/games\?team=10&season=2026$/, { status: 200, body: { errors: [], response: [{ id: 1 }] }, headers: { "x-ratelimit-requests-remaining": "88" } }],
      [/standings\?league=5&season=2026$/, { errors: [], response: [[{ position: 1 }]] }],
    ]);
    const api = apiSports({ sport: "handball", key: KEY, fetch: f });
    expect(await api.games({ team: 10, season: "2026" })).toEqual([{ id: 1 }]);
    expect(await api.standings({ league: 5, season: "2026" })).toEqual([[{ position: 1 }]]);
    expect(f.calls[0]).toBe("https://api-handball.p.rapidapi.com/games?team=10&season=2026");
    const h = f.inits[0].headers as Record<string, string>;
    expect(h["x-rapidapi-key"]).toBe(KEY);
    expect(h["x-rapidapi-host"]).toBe("api-handball.p.rapidapi.com");
    expect(api.calls).toBe(2);
    expect(api.remaining).toBe(88);
  });
  it("errors não vazio → SourceError api", async () => {
    const api = apiSports({ sport: "basketball", key: KEY, fetch: fakeFetch([[/./, { errors: { token: "Error/Missing application key" }, response: [] }]]) });
    expect((await caught(api.games({ team: 1, season: "2026-2027" }))).kind).toBe("api");
  });
});

describe("vsports", () => {
  it("vsportsSeasonId: época começa em agosto, override ganha", () => {
    expect(vsportsSeasonId(new Date("2026-11-17T12:00:00Z"))).toBe(31);
    expect(vsportsSeasonId(new Date("2026-07-31T12:00:00Z"))).toBe(30);
    expect(vsportsSeasonId(new Date("2026-08-02T12:00:00Z"))).toBe(31);
    expect(vsportsSeasonId(new Date("2026-11-17T12:00:00Z"), 40)).toBe(40);
  });
  it("rounds e videosByMatch: URLs e cabeçalho KEY", async () => {
    const f = fakeFetch([
      [/\/pesquisa-sec/, "vsports/rounds-1.json"],
      [/vdo-pesquisa-sec/, "vsports/videos-match.json"],
    ]);
    const v = vsports({ key: KEY, fetch: f });
    const r = await v.rounds("1", 31);
    expect(r.matches).toHaveLength(2);
    const vd = await v.videosByMatch("1500003");
    expect(vd.vdos).toHaveLength(3);
    expect(f.calls[0]).toBe("https://apism.vsports.pt/pesquisa-sec?scp&cp=1&ep=31&lst=match&pp=0&vp=310&eq=6");
    expect(f.calls[1]).toBe("https://apism.vsports.pt/vdo-pesquisa-sec?scp&gm=1500003");
    expect((f.inits[0].headers as Record<string, string>).KEY).toBe(KEY);
  });
});

describe("fetchFeed", () => {
  it("record.xml: tira o CDATA do título e lê a imagem do enclosure", async () => {
    const f = fakeFetch([[/record/, "rss/record.xml"]]);
    const items = await fetchFeed(f, { name: "Record", url: "https://www.record.pt/rss/sporting" });
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Sporting vence o dérbi em Alvalade");
    expect(items[0].summary).toBe("Golos de Gyökeres e Pedro Gonçalves decidem o jogo.");
    expect(items[0].image).toBe("https://cdn.record.pt/images/exemplo-1.jpg");
    expect(items[0].source).toBe("Record");
    expect(items[0].link).toContain("record.pt");
  });
  it("maisfutebol.xml: imagem do primeiro <img> do conteúdo", async () => {
    const f = fakeFetch([[/maisfutebol/, "rss/maisfutebol.xml"]]);
    const items = await fetchFeed(f, { name: "Maisfutebol", url: "https://maisfutebol.iol.pt/rss/sporting" });
    expect(items[0].image).toBe("https://cdn.iol.pt/img/exemplo-3.jpg");
  });
  it("HTTP 500 → SourceError http", async () => {
    const f = fakeFetch([[/./, { status: 500, body: "" }]]);
    const e = await caught(fetchFeed(f, { name: "X", url: "https://x.test/rss" }));
    expect(e.kind).toBe("http");
  });
});

describe("twitter", () => {
  it("userTweets: Bearer e params do código antigo", async () => {
    const f = fakeFetch([[/api\.twitter\.com\/2\/users\/21389998\/tweets/, "twitter/user-tweets.json"]]);
    const tw = twitter({ token: "tok-test", fetch: f });
    const r = await tw.userTweets("21389998");
    expect(r.data).toHaveLength(2);
    expect((f.inits[0].headers as Record<string, string>).Authorization).toBe("Bearer tok-test");
    const u = new URL(f.calls[0]);
    expect(Object.fromEntries(u.searchParams)).toEqual({
      max_results: "10",
      expansions: "attachments.media_keys,author_id",
      "user.fields": "profile_image_url,username,name",
      "media.fields": "url,preview_image_url",
      "tweet.fields": "created_at,public_metrics,note_tweet",
    });
  });
});

describe("fixtures gravadas", () => {
  const dir = path.join(__dirname, "../fixtures");
  const files: string[] = [];
  const walk = (d: string) => {
    for (const n of fs.readdirSync(d)) {
      const p = path.join(d, n);
      if (fs.statSync(p).isDirectory()) walk(p);
      else files.push(p);
    }
  };
  walk(dir);
  const CRED = /(X-RapidAPI-(Key|Host)|x-apisports-key|authorization\s*[:=]|Bearer\s+[A-Za-z0-9%._-]{16,}|AAAAAAAAAAAA[A-Za-z0-9%]{20,}|"(api[_-]?key|token|secret|password)"\s*:\s*"[^"]{8,})/i;
  it("nenhuma fixture contém padrões de credenciais", () => {
    expect(files.length).toBeGreaterThan(30);
    const bad = files.filter((f) => CRED.test(fs.readFileSync(f, "utf8"))).map((f) => path.relative(dir, f));
    expect(bad).toEqual([]);
  });
});
