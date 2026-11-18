import { SPORTING_CREST_URL } from "../../src/config/brand";
import type { MatchDoc } from "../../src/model/types";
import { SourceError } from "../../src/sources/http";
import { isSporting, opponentSlug } from "../../src/sources/free/common";
import { futsalPortugal, parseFutsalSchedule } from "../../src/sources/free/futsalportugal";
import { futsalPortugalGamesheet, parseGamesheetJsonLd } from "../../src/sources/free/futsalportugal_gamesheet";
import { hoqueipatins } from "../../src/sources/free/hoqueipatins";
import { hpFpp, parseHpPhase, parsePhaseList } from "../../src/sources/free/hp_fpp";
import { fakeFetch } from "../helpers/fakeFetch";
import * as fs from "fs";
import * as path from "path";

const NOW = new Date("2026-11-18T12:00:00Z");
const SEASON = "2026-2027";
const fixture = (p: string) => fs.readFileSync(path.join(__dirname, "..", "fixtures", "free", p), "utf8");

/** Resposta inline (uma string simples no fakeFetch é um caminho de fixture). */
const html = (body: string) => ({ status: 200, body });

const caught = async (p: Promise<unknown>): Promise<SourceError> => {
  try {
    await p;
  } catch (e) {
    return e as SourceError;
  }
  throw new Error("esperava uma falha");
};

/** JSON-LD de uma ficha de jogo, com o formato real (gamesheet-31773). */
const gamesheet = (o: { comp?: string; round?: string; home: string; away: string; start: string; venue?: string }) =>
  `<!doctype html><html lang="pt"><head><script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${o.comp ?? "UEFA FUTSAL CHAMPIONS LEAGUE"} - ${o.round ?? "Oitavos-De-Final"}: ${o.home} vs ${o.away}`,
    sport: "Futsal",
    homeTeam: { "@type": "SportsTeam", name: o.home },
    awayTeam: { "@type": "SportsTeam", name: o.away },
    startDate: o.start,
    location: { "@type": "Place", name: o.venue ?? "Pavilhão João Rocha" },
  })}</script></head><body></body></html>`;

const known = (o: Partial<MatchDoc> & { id: string; source: MatchDoc["source"] }): MatchDoc => ({
  sport: "futsal",
  competition: { key: "k", id: "liga-placard", name: "Liga Placard", type: "league", season: SEASON, round: null, roundLabel: null },
  home: { id: "sporting", name: "Sporting CP", logo: null },
  away: { id: "x", name: "X", logo: null },
  sportingSide: "home",
  kickoff: NOW,
  status: "NS",
  statusRaw: "",
  elapsed: null,
  elapsedExtra: null,
  score: { home: null, away: null, halftime: null, extratime: null, penalty: null },
  finishedAt: null,
  finishedAtSource: null,
  referee: null,
  ...o,
});

describe("opponentSlug", () => {
  it.each([
    ["SL Benfica", "benfica"],
    ["Benfica", "benfica"],
    ["Sporting CP", "sporting"],
    ["Sporting Clube de Portugal", "sporting portugal"],
    ["FC Porto ", "porto"],
    ["Candelária SC", "candelaria"],
    ["AD Valongo / Colquímica", "valongo"],
    ["Riba d&#8217;Ave", "riba d ave"],
    ["Riba d'Ave HC", "riba d ave"],
    ["OC Barcelos SAD ", "barcelos"],
  ])("%s → %s", (name, slug) => {
    expect(opponentSlug(name)).toBe(slug);
  });
  it("só o Sporting é o Sporting (marcadores de eliminatória e outros 'Sporting' não)", () => {
    expect(isSporting("Sporting CP")).toBe(true);
    expect(isSporting("Sporting")).toBe(true);
    expect(isSporting("Beitar / Sporting")).toBe(false);
    expect(isSporting("Royal Sporting Anderlecht Futsal")).toBe(false);
    expect(isSporting("Sporting CP B")).toBe(false);
  });
});

describe("futsalportugal (lista)", () => {
  const routes = (gs: (url: string) => object | string = () => ({ status: 404 })) =>
    fakeFetch([
      [/schedule\/3\/26$/, "free/futsalportugal/schedule-liga-placard-26.html"],
      [/schedule\/3\/45$/, "free/futsalportugal/schedule-taca-de-portugal-45.html"],
      [/schedule\/3\/43$/, "free/futsalportugal/schedule-taca-da-liga-43.html"],
      [/schedule\/3\/40$/, "free/futsalportugal/schedule-supertaca-40.html"],
      [/schedule\/3\/57$/, "free/futsalportugal/schedule-champions-league-57.html"],
      [/gamesheet\/\d+$/, (url) => { const r = gs(url); return (typeof r === "string" ? html(r) : r) as never; }],
    ]);

  it("amostras: 14 jogos do Sporting (8 Liga, 3 Taça da Liga, 1 Supertaça, 2 Champions; marcadores 'Beitar / Sporting' fora)", async () => {
    const f = routes();
    const ms = await futsalPortugal.fetchMatches(f, SEASON, NOW);
    expect(ms).toHaveLength(14);
    expect(ms.every((m) => m.sport === "futsal" && m.sourceKey === "futsalportugal" && m.season === SEASON)).toBe(true);
    expect(ms.filter((m) => m.competition.id === "liga-placard")).toHaveLength(8);
    expect(ms.filter((m) => m.competition.id === "liga-dos-campeoes-uefa-de-futsal")).toHaveLength(2);
    expect(ms.map((m) => m.sourceId)).not.toContain("66628");
    // Uma lista por competição.
    expect(f.calls.filter((u) => u.includes("/schedule/"))).toHaveLength(5);
    // Fichas (hora com fuso): no máximo 4 por execução, os jogos futuros mais próximos primeiro.
    expect(f.calls.filter((u) => u.includes("/gamesheet/"))).toEqual(["66614", "66622", "31813", "33023"].map((id) => `https://futsalportugal.com/pt/gamesheet/${id}`));
  });

  it("jogo passado com resultado: competição, ronda, lados e emblema", async () => {
    const ms = await futsalPortugal.fetchMatches(routes(), SEASON, NOW);
    const m = ms.find((x) => x.sourceId === "31776")!;
    expect(m).toMatchObject({
      competition: { id: "liga-placard", name: "Liga Placard", round: "1ª Jornada", type: "league" },
      status: "FT",
      score: { home: 1, away: 0 },
      sportingSide: "home",
      home: { id: "sporting", name: "Sporting CP", logo: SPORTING_CREST_URL },
      away: { id: "portimonense", name: "Portimonense SC", logo: null },
      kickoffExact: false,
    });
    // Sem ficha: dia da lista (ano pela época) e hora da lista tomada como hora de Lisboa.
    expect(m.kickoff.toISOString()).toBe("2026-09-11T14:15:00.000Z");
  });

  it("jogo futuro: hora e local da ficha (JSON-LD com fuso)", async () => {
    const f = routes((url) =>
      url.endsWith("66614")
        ? gamesheet({ home: "TFK Beitar", away: "Sporting CP", start: "2026-11-23T18:00:00+00:00", venue: "Beitar Arena" })
        : gamesheet({ home: "Sporting CP", away: "TFK Beitar", start: "2026-12-04T20:00:00+00:00" }),
    );
    const ms = await futsalPortugal.fetchMatches(f, SEASON, NOW);
    const m = ms.find((x) => x.sourceId === "66614")!;
    expect(m).toMatchObject({
      competition: { name: "Liga dos Campeões UEFA de Futsal", round: "Oitavos-De-Final", type: "europe" },
      status: "NS",
      score: { home: null, away: null },
      sportingSide: "away",
      venue: "Beitar Arena",
      kickoffExact: true,
    });
    expect(m.kickoff.toISOString()).toBe("2026-11-23T18:00:00.000Z");
  });

  it("resultado num jogo ainda por jogar (anomalia da Taça da Liga) não é final", async () => {
    const ms = await futsalPortugal.fetchMatches(routes(), SEASON, NOW);
    const m = ms.find((x) => x.sourceId === "33027")!;
    expect(m.kickoff.toISOString()).toBe("2027-01-09T18:00:00.000Z");
    expect(m).toMatchObject({ status: "NS", score: { home: null, away: null } });
  });

  it("hora já confirmada e mesmo dia: reutiliza a hora gravada sem pedir a ficha", async () => {
    const f = routes();
    const exact = new Date("2026-12-16T20:00:00Z");
    const ctx = { known: [known({ id: "fs_futsalportugal_31813", kickoff: exact, source: { provider: "futsalportugal", id: "31813", exactKickoff: true } })], focus: [] };
    const ms = await futsalPortugal.fetchMatches(f, SEASON, NOW, ctx);
    expect(ms.find((x) => x.sourceId === "31813")!.kickoff).toEqual(exact);
    expect(f.calls).not.toContain("https://futsalportugal.com/pt/gamesheet/31813");
  });

  it("em janela de jogo pede só a lista da competição desse jogo", async () => {
    const f = routes();
    const focus = [known({ id: "fs_futsalportugal_31813", competition: { key: "k", id: "liga-placard", name: "Liga Placard", type: "league", season: SEASON, round: null, roundLabel: null }, source: { provider: "futsalportugal", id: "31813" } })];
    const ms = await futsalPortugal.fetchMatches(f, SEASON, NOW, { known: focus, focus });
    expect(f.calls.filter((u) => u.includes("/schedule/"))).toEqual(["https://futsalportugal.com/pt/schedule/3/26"]);
    expect(ms).toHaveLength(8);
  });

  it("prolongamento e penáltis (Taça de Portugal, todos os jogos)", () => {
    const rows = parseFutsalSchedule(fixture("futsalportugal/schedule-taca-de-portugal-45.html"), { page: 45, raw: "Taça de Portugal" }, SEASON, NOW, { all: true });
    expect(rows.find((r) => r.sourceId === "58702")).toMatchObject({ status: "AET", score: { home: 4, away: 7 } });
    expect(rows.find((r) => r.sourceId === "66601")).toMatchObject({ status: "PEN", score: { home: 4, away: 4 }, penalty: { home: 3, away: 4 } });
    expect(rows.find((r) => r.sourceId === "58712")).toMatchObject({ status: "FT", competition: { round: "1ª Eliminatória", type: "cup" } });
  });

  it("página vazia → []", async () => {
    const f = fakeFetch([[/schedule/, "free/futsalportugal/schedule-empty.html"]]);
    expect(await futsalPortugal.fetchMatches(f, SEASON, NOW)).toEqual([]);
  });

  it("HTML sem a estrutura esperada → SourceError parse", async () => {
    const f = fakeFetch([[/schedule/, html("<html><body><h1>Em manutenção</h1></body></html>")]]);
    const e = await caught(futsalPortugal.fetchMatches(f, SEASON, NOW));
    expect(e).toBeInstanceOf(SourceError);
    expect(e.kind).toBe("parse");
    const broken = `<div class="sc-body"><section class="sc-comp"><article class="sc-round"><h3>1ª Jornada</h3><div class="sc-day">Sexta-feira, 11 setembro</div><div class="sc-item"><span class="sc-time">15:00</span><span class="mcm-name">Sporting CP</span></div></article></section></div>`;
    const e2 = await caught(futsalPortugal.fetchMatches(fakeFetch([[/schedule/, html(broken)]]), SEASON, NOW));
    expect(e2.kind).toBe("parse");
  });
});

describe("futsalportugal_gamesheet (recurso)", () => {
  it("JSON-LD real: competição, ronda, equipas, hora com fuso e local", () => {
    expect(parseGamesheetJsonLd(fixture("futsalportugal/gamesheet-31773-jsonld.html"))).toEqual({
      competition: "LIGA PLACARD",
      round: "1ª Jornada",
      home: "AD Fundão",
      away: "SC Braga",
      start: new Date("2026-09-11T18:30:00Z"),
      venue: "Pavilhao Municipal Fundão",
    });
  });

  it("pede só as fichas dos jogos conhecidos próximos (−1 dia a +2 dias) e devolve-os normalizados", async () => {
    const f = fakeFetch([[/gamesheet\/66614$/, html(gamesheet({ home: "TFK Beitar", away: "Sporting CP", start: "2026-11-23T18:00:00+00:00", venue: "Beitar Arena" }))]]);
    const ctx = {
      known: [
        known({ id: "fs_futsalportugal_66614", kickoff: new Date("2026-11-19T10:00:00Z"), source: { provider: "futsalportugal", id: "66614" } }),
        known({ id: "fs_futsalportugal_66622", kickoff: new Date("2026-11-23T10:00:00Z"), source: { provider: "futsalportugal", id: "66622" } }),
        known({ id: "fs_futsalportugal_31776", kickoff: new Date("2026-09-11T14:15:00Z"), source: { provider: "futsalportugal", id: "31776" } }),
      ],
      focus: [],
    };
    const ms = await futsalPortugalGamesheet.fetchMatches(f, SEASON, NOW, ctx);
    expect(f.calls).toEqual(["https://futsalportugal.com/pt/gamesheet/66614"]);
    expect(ms).toHaveLength(1);
    expect(ms[0]).toMatchObject({
      sourceKey: "futsalportugal_gamesheet",
      sourceId: "66614",
      competition: { id: "liga-dos-campeoes-uefa-de-futsal", round: "Oitavos-De-Final", type: "europe" },
      sportingSide: "away",
      status: "NS",
      venue: "Beitar Arena",
      kickoffExact: true,
    });
  });

  it("sem jogos conhecidos → [] sem pedidos; sem JSON-LD → SourceError parse", async () => {
    const f = fakeFetch([[/gamesheet/, html("<html><body>sem dados</body></html>")]]);
    expect(await futsalPortugalGamesheet.fetchMatches(f, SEASON, NOW, { known: [], focus: [] })).toEqual([]);
    expect(f.calls).toHaveLength(0);
    const ctx = { known: [known({ id: "fs_futsalportugal_66614", kickoff: new Date("2026-11-19T10:00:00Z"), source: { provider: "futsalportugal", id: "66614" } })], focus: [] };
    const e = await caught(futsalPortugalGamesheet.fetchMatches(f, SEASON, NOW, ctx));
    expect(e.kind).toBe("parse");
  });
});

describe("hp_fpp (FPP)", () => {
  const EMPTY_LIST = `<div id="principal"><h1>Lista</h1></div>`;
  const routes = () =>
    fakeFetch([
      [/hp\.fpp\.pt\/136\/12$/, "free/hp_fpp/competicoes-136-12-lista-fases.html"],
      [/hp\.fpp\.pt\/136\/\d+$/, html(EMPTY_LIST)],
      [/Competicao\/493$/, "free/hp_fpp/competicao-493-campeonato-fase-regular.html"],
      [/Competicao\/496$/, "free/hp_fpp/competicao-496-supertaca.html"],
      [/Competicao\/508$/, "free/hp_fpp/competicao-508-taca-pre-eliminatoria.html"],
      [/Competicao\/509$/, "free/hp_fpp/competicao-509-elite-cup.html"],
    ]);

  it("lista de fases", () => {
    expect(parsePhaseList(fixture("hp_fpp/competicoes-136-12-lista-fases.html"))).toEqual([{ id: 493, name: "Campeonato Placard HP - Fase Regular" }]);
    expect(parsePhaseList(fixture("hp_fpp/epoca-54-54-12-fases-2025-26.html")).map((p) => p.id)).toEqual([486, 473, 468, 406]);
  });

  it("amostras: 5 jogos do Sporting nas fases da época (3 Campeonato, 1 Supertaça, 1 Elite Cup)", async () => {
    const f = routes();
    const ms = await hpFpp.fetchMatches(f, SEASON, NOW);
    expect(ms).toHaveLength(5);
    expect(new Set(f.calls).size).toBe(f.calls.length);
    expect(ms.filter((m) => m.competition.id === "campeonato-placard")).toHaveLength(3);
    expect(ms.every((m) => m.sport === "roller_hockey" && m.season === SEASON && m.venue === null)).toBe(true);
  });

  it("jogo passado (Supertaça) e futuro (J3 com o Benfica)", async () => {
    const ms = await hpFpp.fetchMatches(routes(), SEASON, NOW);
    expect(ms.find((m) => m.competition.id === "supertaca")).toMatchObject({
      sourceId: "496_1",
      competition: { name: "Supertaça", round: "Final", type: "supercup" },
      status: "FT",
      score: { home: 3, away: 2 },
      sportingSide: "away",
      home: { id: "benfica", name: "SL Benfica" },
      kickoff: new Date("2026-11-07T12:00:00Z"),
    });
    expect(ms.find((m) => m.sourceId === "493_20")).toMatchObject({
      competition: { name: "Campeonato Placard", round: "3ª Jornada", type: "league" },
      status: "NS",
      score: { home: null, away: null },
      sportingSide: "home",
      kickoff: new Date("2026-11-22T19:30:00Z"),
      kickoffExact: true,
    });
  });

  it("play-off: a fase entra na ronda (série de jogos com o mesmo adversário)", () => {
    const ms = parseHpPhase(fixture("hp_fpp/competicao-473-playoff-meias-2025-26.html"), 473, "2025-2026", NOW);
    expect(ms.map((m) => m.competition.round)).toEqual(["1/2 Final - Jornada 1", "1/2 Final - Jornada 2", "1/2 Final - Jornada 3"]);
    expect(ms[0].competition).toMatchObject({ id: "campeonato-placard", type: "league" });
    expect(parseHpPhase(fixture("hp_fpp/competicao-438-taca-4-avos-2025-26.html"), 438, "2025-2026", NOW)[0].competition).toMatchObject({ id: "taca-de-portugal", type: "cup" });
  });

  it("fase sem calendário → []; HTML sem a estrutura esperada → SourceError parse", async () => {
    expect(parseHpPhase(`<div id="principal"><h1>Campeonato Placard Play Off - Final</h1></div>`, 999, SEASON, NOW)).toEqual([]);
    const f = fakeFetch([[/./, html("<html><body>Erro 500</body></html>")]]);
    const e = await caught(hpFpp.fetchMatches(f, SEASON, NOW));
    expect(e).toBeInstanceOf(SourceError);
    expect(e.kind).toBe("parse");
  });

  it("em janela de jogo pede só a fase desse jogo", async () => {
    const f = routes();
    const focus = [known({ id: "hq_hp_fpp_493_20", sport: "roller_hockey", source: { provider: "hp_fpp", id: "493_20" } })];
    const ms = await hpFpp.fetchMatches(f, SEASON, NOW, { known: focus, focus });
    expect(f.calls).toEqual(["https://hp.fpp.pt/Competicao/493"]);
    expect(ms).toHaveLength(3);
  });
});

describe("hoqueipatins", () => {
  const routes = () =>
    fakeFetch([
      [/events\?.*page=1$/, { status: 200, body: fixture("hoqueipatins/events-league230-season1122-page1.json"), headers: { "X-WP-TotalPages": "2" } }],
      [/events\?.*page=2$/, { status: 200, body: fixture("hoqueipatins/events-sporting-europe-cups.json"), headers: { "X-WP-TotalPages": "2" } }],
    ]);

  it("amostras: 23 jogos do Sporting (15 Campeonato, 6 WSE, Elite Cup e Supertaça), 2 páginas", async () => {
    const f = routes();
    const ms = await hoqueipatins.fetchMatches(f, SEASON, NOW);
    expect(ms).toHaveLength(23);
    expect(f.calls).toHaveLength(2);
    expect(f.calls[0]).toMatch(/seasons=1122&leagues=230,233,535,538,1123&per_page=100/);
    expect(ms.filter((m) => m.competition.type === "europe")).toHaveLength(6);
    expect(ms.every((m) => m.attribution === "hoqueipatins.pt")).toBe(true);
  });

  it("jogo passado e futuro (WSE)", async () => {
    const ms = await hoqueipatins.fetchMatches(routes(), SEASON, NOW);
    expect(ms.find((m) => m.sourceId === "110370")).toMatchObject({
      competition: { id: "campeonato-placard", round: "0001-Jornada 1", type: "league" },
      status: "FT",
      score: { home: 5, away: 0 },
      sportingSide: "home",
      away: { id: "candelaria", name: "Candelaria" },
      kickoff: new Date("2026-11-10T20:30:00Z"),
    });
    expect(ms.find((m) => m.sourceId === "109732")).toMatchObject({
      competition: { id: "liga-dos-campeoes-wse", name: "Liga dos Campeões WSE", round: "0002-Jornada 2", type: "europe" },
      status: "NS",
      score: { home: null, away: null },
      sportingSide: "away",
      home: { name: "Braga" },
      kickoff: new Date("2026-12-10T19:00:00Z"),
    });
    expect(ms.find((m) => m.sourceId === "110424")!.home.name).toBe("Riba d’Ave");
    expect(ms.find((m) => m.sourceId === "112841")).toMatchObject({ home: { name: "Benfica" }, away: { name: "Sporting" }, competition: { type: "supercup" } });
  });

  it("página vazia → []; resposta que não é lista → SourceError parse; época sem id → SourceError", async () => {
    expect(await hoqueipatins.fetchMatches(fakeFetch([[/events/, "free/hoqueipatins/events-empty.json"]]), SEASON, NOW)).toEqual([]);
    const e = await caught(hoqueipatins.fetchMatches(fakeFetch([[/events/, { code: "rest_no_route" }]]), SEASON, NOW));
    expect(e.kind).toBe("parse");
    const e2 = await caught(hoqueipatins.fetchMatches(fakeFetch([[/events/, []]]), "2031-2032", NOW));
    expect(e2).toBeInstanceOf(SourceError);
  });
});
