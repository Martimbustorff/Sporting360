import * as fs from "fs";
import * as path from "path";
import { Timestamp } from "firebase-admin/firestore";
import { SPORTING_CREST_URL } from "../../src/config/brand";
import { mapFixture } from "../../src/football/mapFixture";
import { legacyFromFixture, legacyGame } from "../../src/legacy/footballLegacy";
import type { AfFixture } from "../../src/sources/apiFootball.types";

function load(name: string): AfFixture {
  const file = path.join(__dirname, "../fixtures/api-football", `${name}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8")).response[0] as AfFixture;
}

const NOW = new Date("2026-11-22T22:41:00Z");
const ctx = { now: NOW, previous: null, observedLive: false };
const FX = "1500003";

function build(f: AfFixture, existing: { channel?: string } | null = null) {
  const { match } = mapFixture(f, ctx);
  return { match, docs: legacyFromFixture(f, match, existing) };
}

function walk(v: unknown, where: string, bad: string[]): void {
  if (v === undefined) bad.push(where);
  else if (v instanceof Timestamp || v instanceof Date) return;
  else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${where}[${i}]`, bad));
  else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => walk(x, `${where}.${k}`, bad));
}

describe("legacy games/{id}", () => {
  it("jogo terminado: campos e tipos do contrato", () => {
    const f = load("fixture-ft");
    const { match, docs } = build(f, { channel: "SPTV" });
    expect(Object.keys(docs.games)).toEqual([FX]);
    expect(docs.games[FX]).toEqual({
      api: FX,
      timestamp: Timestamp.fromDate(new Date(f.fixture.timestamp * 1000)),
      teamhome: { name: "Sporting CP", logo: SPORTING_CREST_URL, api: "228" },
      teamaway: { name: "Benfica", logo: "https://media.api-sports.io/football/teams/211.png", api: "211" },
      scorehome: "2",
      scoreaway: "1",
      competition: f.league.name,
      season: "2026",
      channel: "SPTV",
      elapsedTime: "90",
      journey: " 12",
      isActive: false,
      startTime: new Date(f.fixture.timestamp * 1000).toISOString(),
      endTime: match.finishedAt!.toISOString(),
      _ingest: "v2027",
    });
    expect(docs.games[FX].timestamp).toBeInstanceOf(Timestamp);
  });

  it("competition é o nome da API, não o rótulo pt-PT", () => {
    const f = load("fixture-ft");
    f.league = { ...f.league, id: 94, name: "Liga Portugal" };
    expect(build(f).docs.games[FX].competition).toBe("Liga Portugal");
    f.league = { ...f.league, name: "Primeira Liga" };
    expect(build(f).docs.games[FX].competition).toBe("Primeira Liga");
  });

  it("jogo por começar: golos e minuto a '0', canal vazio sem existente, endTime = kickoff + 150 min", () => {
    const f = load("fixture-ns");
    const { match, docs } = build(f, null);
    const g = docs.games[FX];
    expect(g.scorehome).toBe("0");
    expect(g.scoreaway).toBe("0");
    expect(g.elapsedTime).toBe("0");
    expect(g.channel).toBe("");
    expect(g.isActive).toBe(false);
    expect(g.endTime).toBe(new Date(match.kickoff.getTime() + 150 * 60_000).toISOString());
  });

  it("channel: existente preserva-se; existente sem canal dá ''", () => {
    const f = load("fixture-ns");
    expect(build(f, { channel: "Sport TV 1" }).docs.games[FX].channel).toBe("Sport TV 1");
    expect(build(f, {}).docs.games[FX].channel).toBe("");
  });

  it("isActive é true em HT e em jogo a decorrer; false em FT e NS", () => {
    expect(build(load("fixture-ht")).docs.games[FX].isActive).toBe(true);
    expect(build(load("fixture-live-2h")).docs.games[FX].isActive).toBe(true);
    expect(build(load("fixture-ft")).docs.games[FX].isActive).toBe(false);
    expect(build(load("fixture-ns")).docs.games[FX].isActive).toBe(false);
  });

  it("journey: só o que vem depois do primeiro '-' (com espaço), senão a ronda, senão ''", () => {
    const f = load("fixture-ft");
    expect(build(f).docs.games[FX].journey).toBe(" 12");
    expect(build({ ...f, league: { ...f.league, round: "Regular Season - 11" } }).docs.games[FX].journey).toBe(" 11");
    expect(build({ ...f, league: { ...f.league, round: "Final" } }).docs.games[FX].journey).toBe("Final");
    expect(build({ ...f, league: { ...f.league, round: "" } }).docs.games[FX].journey).toBe("");
  });

  it("legacyGame devolve o mesmo que o mapa 'games'", () => {
    const f = load("fixture-ft");
    const { match, docs } = build(f, { channel: "X" });
    expect(legacyGame(f, match, { channel: "X" })).toEqual(docs.games[FX]);
  });

  it("PEN: endTime é finishedAt e o resultado é o contado", () => {
    const f = load("fixture-pen");
    const { match, docs } = build(f);
    expect(docs.games[FX].endTime).toBe(match.finishedAt!.toISOString());
    expect(docs.games[FX].scorehome).toBe(String(match.score.home));
  });
});

describe("legacy summaries", () => {
  it("golo com assistência", () => {
    const f = load("fixture-ft");
    const { docs } = build(f);
    const id = `5010_Sporting CP_${FX}_Normal Goal_12`;
    expect(docs.summaries[id]).toEqual({
      api: id,
      detail: "Normal Goal",
      GameId: FX,
      type: "Goal",
      time: "12",
      player: { name: "Gyökeres", api: "5010", logo: "" },
      playerSub: { name: "Luis Suárez", api: "5009", logo: "" },
      team: { name: "Sporting CP", api: "228", logo: SPORTING_CREST_URL },
    });
  });

  it("sem assistência: playerSub vazio; logo da equipa adversária é o da API", () => {
    const f = load("fixture-ft");
    const { docs } = build(f);
    const id = `6008_Benfica_${FX}_Goal cancelled_20`;
    expect(docs.summaries[id].playerSub).toEqual({ name: "", api: "", logo: "" });
    expect(docs.summaries[id].team.logo).toBe("https://media.api-sports.io/football/teams/211.png");
    expect(docs.summaries[id].type).toBe("Var");
  });

  it("um documento por evento e sem eventos dá mapa vazio", () => {
    const f = load("fixture-ft");
    expect(Object.keys(build(f).docs.summaries)).toHaveLength(f.events.length);
    expect(build(load("fixture-ns")).docs.summaries).toEqual({});
  });
});

describe("legacy stastistics", () => {
  it("um documento por equipa e tipo, value em string", () => {
    const f = load("fixture-ft");
    const f2: AfFixture = {
      ...f,
      statistics: [
        {
          ...f.statistics[0],
          statistics: [
            { type: "Ball Possession", value: "55%" },
            { type: "Total Shots", value: 13 },
            { type: "Corner Kicks", value: null },
          ],
        },
        f.statistics[1],
      ],
    };
    const { docs } = build(f2);
    const id = `228_${FX}_Ball Possession`;
    expect(docs.stastistics[id]).toEqual({
      api: id,
      GameId: FX,
      team: { name: "Sporting CP", logo: SPORTING_CREST_URL, api: "228" },
      type: "Ball Possession",
      value: "55%",
    });
    expect(docs.stastistics[`228_${FX}_Total Shots`].value).toBe("13");
    expect(docs.stastistics[`228_${FX}_Corner Kicks`].value).toBe("null");
    expect(docs.stastistics[`211_${FX}_Total Shots`].team.api).toBe("211");
  });

  it("sem estatísticas dá mapa vazio", () => {
    expect(build(load("fixture-ns")).docs.stastistics).toEqual({});
  });
});

describe("legacy lineups", () => {
  it("onze, suplentes e formação", () => {
    const f = load("fixture-ft");
    const { docs } = build(f);
    const d = docs.lineups[`228_${FX}`];
    expect(d.GameId).toBe(FX);
    expect(d.id).toBe(`228_${FX}`);
    expect(d.teamId).toBe("228");
    expect(d.formation).toBe("4-3-3");
    expect(d.startXI).toHaveLength(11);
    expect(d.startXI[0]).toEqual({ playerId: "5000", number: 1, name: "Israel", grid: "1:1", position: "G" });
    expect(d.substitutes[0]).toEqual({ playerId: "5011", number: 12, name: "Debast", grid: null, position: "D" });
    expect(Object.keys(docs.lineups).sort()).toEqual([`211_${FX}`, `228_${FX}`]);
  });

  it("formation vazia quando null; position sempre string", () => {
    const f = load("fixture-ft");
    const g: AfFixture = { ...f, lineups: [{ ...f.lineups[0], formation: null }, f.lineups[1]] };
    const d = build(g).docs.lineups[`228_${FX}`];
    expect(d.formation).toBe("");
    for (const p of [...d.startXI, ...d.substitutes]) expect(typeof p.position).toBe("string");
  });
});

describe("legacy players", () => {
  it("teamId é número no documento e em cada jogador; grid do suplente é o do titular que saiu", () => {
    const f = load("fixture-ft");
    // 5008 (grid 3:1) sai, entra 5013 (suplente)
    const g: AfFixture = {
      ...f,
      events: [
        ...f.events.filter((e) => e.type.toLowerCase() !== "subst"),
        { time: { elapsed: 60, extra: null }, team: f.events[0].team, player: { id: 5008, name: "Pedro Gonçalves" }, assist: { id: 5013, name: "Catamo" }, type: "subst", detail: "Substitution 1", comments: null },
      ],
    };
    const { docs } = build(g);
    const d = docs.players[`228_${FX}`];
    expect(d.GameId).toBe(FX);
    expect(d.id).toBe(`228_${FX}`);
    expect(d.teamId).toBe(228);
    expect(typeof d.teamId).toBe("number");
    expect(d.Players).toHaveLength(14);
    for (const p of d.Players) expect(p.teamId).toBe(228);
    const byId = (id: string) => d.Players.find((p: { playerId: string }) => p.playerId === id);
    expect(byId("5013").grid).toBe("3:1");
    expect(byId("5013").substitute).toBe(true);
    expect(byId("5008").grid).toBe("3:1");
    expect(byId("5011").grid).toBe("");
    expect(byId("5000")).toEqual({
      playerId: "5000",
      number: 1,
      name: "Israel",
      photo: "https://media.api-sports.io/football/players/5000.png",
      position: "G",
      rating: "6.5",
      goals: 0,
      assists: 0,
      saves: 2,
      passesAccuracy: "30",
      tackles: 2,
      foulsCommitted: 1,
      cardsYellow: 0,
      cardsRed: 0,
      teamId: 228,
      grid: "1:1",
      minutes: 90,
      substitute: false,
    });
    expect(byId("5003").rating).toBeNull();
  });

  it("goals/assists e restantes contadores a 0 quando null; minutos null → 0", () => {
    const f = load("fixture-ft");
    const p = f.players[0].players[0];
    const s = p.statistics[0];
    const g: AfFixture = {
      ...f,
      players: [
        {
          ...f.players[0],
          players: [
            {
              ...p,
              statistics: [
                {
                  ...s,
                  games: { ...s.games, minutes: null },
                  goals: { total: null, conceded: null, assists: null, saves: null },
                  cards: { yellow: null, red: null },
                  tackles: { total: null },
                  fouls: { committed: null },
                },
              ],
            },
          ],
        },
      ],
    };
    const row = build(g).docs.players[`228_${FX}`].Players[0];
    expect(row).toMatchObject({ goals: 0, assists: 0, saves: 0, tackles: 0, foulsCommitted: 0, cardsYellow: 0, cardsRed: 0, minutes: 0 });
  });

  it("sem players mas com lineups: plantel mínimo", () => {
    const f = load("fixture-ns-lineups");
    const { docs } = build(f);
    const d = docs.players[`228_${FX}`];
    expect(d.teamId).toBe(228);
    const l = f.lineups[0];
    expect(d.Players).toHaveLength(l.startXI.length + l.substitutes.length);
    expect(d.Players[0]).toEqual({
      playerId: String(l.startXI[0].player.id),
      number: l.startXI[0].player.number,
      name: l.startXI[0].player.name,
      photo: "",
      position: l.startXI[0].player.pos,
      rating: "",
      goals: 0,
      assists: 0,
      saves: 0,
      passesAccuracy: "",
      tackles: 0,
      foulsCommitted: 0,
      cardsYellow: 0,
      cardsRed: 0,
      teamId: 228,
      grid: l.startXI[0].player.grid,
      minutes: 0,
      substitute: false,
    });
    const sub = d.Players[l.startXI.length];
    expect(sub.substitute).toBe(true);
    expect(sub.grid).toBe("");
    expect(Object.keys(docs.lineups)).toHaveLength(2);
  });

  it("sem players e sem lineups: mapa vazio", () => {
    expect(build(load("fixture-ns")).docs.players).toEqual({});
  });
});

describe("legacy: todos os documentos", () => {
  it.each(["fixture-ns", "fixture-ns-lineups", "fixture-live-1h", "fixture-ht", "fixture-ft", "fixture-et", "fixture-pen", "fixture-pst"])(
    "%s não tem valores undefined",
    (name) => {
      const f = load(name);
      const { docs } = build(f);
      const bad: string[] = [];
      walk(docs, "docs", bad);
      expect(bad).toEqual([]);
    },
  );

  it("campos em falta na resposta não geram undefined", () => {
    const f = load("fixture-ft");
    const g = JSON.parse(JSON.stringify(f)) as AfFixture;
    delete (g.events[0] as unknown as Record<string, unknown>).comments;
    (g.lineups[0].startXI[0].player as unknown as Record<string, unknown>).grid = undefined;
    (g.players[0].players[0] as unknown as Record<string, unknown>).photo = undefined;
    (g.players[0].players[0].statistics[0].games as unknown as Record<string, unknown>).number = undefined;
    (g.events[0].assist as unknown as Record<string, unknown>) = undefined as never;
    const bad: string[] = [];
    walk(build(g).docs, "docs", bad);
    expect(bad).toEqual([]);
  });
});
