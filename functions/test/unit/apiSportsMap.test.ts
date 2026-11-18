import * as fs from "fs";
import * as path from "path";
import { SPORTING_CREST_URL } from "../../src/config/brand";
import { apiSportsDue, mapApiSportsGame, type ApiSportsGame } from "../../src/modalities/apiSportsSync";
import type { MatchDoc } from "../../src/model/types";

const fixture = (sport: string): ApiSportsGame[] =>
  JSON.parse(fs.readFileSync(path.join(__dirname, "..", "fixtures", "api-sports", sport, "games.json"), "utf8")).response;

// As fixtures são sintéticas: o Sporting é a equipa 0 e os nomes de liga trazem "(ID por confirmar)".
// Os nomes e os textos de ronda abaixo são os das fixtures; SUBSTITUIR pelos reais na gravação (Task 21).
const SPORTING = 0;
const named = (g: ApiSportsGame, name: string, week: string | null = null): ApiSportsGame => ({ ...g, week, league: { ...g.league, name } });

describe("mapApiSportsGame", () => {
  it("andebol: id hb_, estado, golos, competição em pt-PT, emblema novo só no Sporting", () => {
    const [ft, ns] = fixture("handball").map((g) => named(g, "Andebol 1"));
    const m = mapApiSportsGame("handball", ft, SPORTING);
    expect(m.id).toBe("hb_1");
    expect(m.sport).toBe("handball");
    expect(m.status).toBe("FT");
    expect(m.statusRaw).toBe("FT");
    expect(m.score).toMatchObject({ home: 30, away: 25 });
    expect(m.competition).toMatchObject({ name: "Andebol 1", type: "league", season: "2026", id: "0", key: "handball_0_2026" });
    expect(m.sportingSide).toBe("home");
    expect(m.home.logo).toBe(SPORTING_CREST_URL);
    expect(m.away.logo).toBeNull();
    expect(m.kickoff.toISOString()).toBe("2026-10-10T18:00:00.000Z");
    expect(m.source).toEqual({ provider: "api-handball", id: "1" });
    expect(m.finishedAt).not.toBeNull();
    expect(m.finishedAtSource).toBe("estimated");

    const n = mapApiSportsGame("handball", ns, SPORTING);
    expect(n.status).toBe("NS");
    expect(n.sportingSide).toBe("away");
    expect(n.away.logo).toBe(SPORTING_CREST_URL);
    expect(n.score).toMatchObject({ home: null, away: null });
    expect(n.finishedAt).toBeNull();
    expect(n.finishedAtSource).toBeNull();
  });

  it("basquetebol: id bb_ e pontos; total do objeto de pontos por período", () => {
    const [ft] = fixture("basketball");
    expect(mapApiSportsGame("basketball", ft, SPORTING)).toMatchObject({ id: "bb_1", score: { home: 30, away: 25 }, source: { provider: "api-basketball" }, competition: { season: "2026-2027" } });
    const quarters = { ...ft, scores: { home: { quarter_1: 20, quarter_2: 22, quarter_3: 18, quarter_4: 25, over_time: null, total: 85 }, away: { quarter_1: 18, quarter_2: 20, quarter_3: 21, quarter_4: 20, over_time: null, total: 79 } } };
    const m = mapApiSportsGame("basketball", quarters as unknown as ApiSportsGame, SPORTING);
    expect(m.score).toMatchObject({ home: 85, away: 79, halftime: { home: 42, away: 38 } });
  });

  it("voleibol 3-1: score = sets ganhos e sets = os 4 parciais", () => {
    const [ft] = fixture("volleyball");
    const g = {
      ...ft,
      scores: { home: 3, away: 1 },
      periods: {
        first: { home: 25, away: 20 },
        second: { home: 22, away: 25 },
        third: { home: 25, away: 18 },
        fourth: { home: 25, away: 23 },
        fifth: { home: null, away: null },
      },
    } as unknown as ApiSportsGame;
    const m = mapApiSportsGame("volleyball", g, SPORTING);
    expect(m.id).toBe("vb_1");
    expect(m.status).toBe("FT");
    expect(m.score.home).toBe(3);
    expect(m.score.away).toBe(1);
    expect(m.score.sets).toEqual([
      { home: 25, away: 20 },
      { home: 22, away: 25 },
      { home: 25, away: 18 },
      { home: 25, away: 23 },
    ]);
    expect(m.source.provider).toBe("api-volleyball");
  });

  it("roundLabel dos textos das fixtures (substituir pelos reais na gravação)", () => {
    const [g] = fixture("handball");
    expect(mapApiSportsGame("handball", named(g, "Andebol 1", "Regular Season - 7"), SPORTING).competition).toMatchObject({ round: "Regular Season - 7", roundLabel: "J7" });
    expect(mapApiSportsGame("handball", named(g, "Taça de Portugal", "Quarter-finals"), SPORTING).competition).toMatchObject({ name: "Taça de Portugal", type: "cup", roundLabel: "Quartos de final" });
    expect(mapApiSportsGame("handball", named(g, "Andebol 1", null), SPORTING).competition).toMatchObject({ round: null, roundLabel: null });
  });

  it("competições europeias com nome pt-PT", () => {
    const [g] = fixture("volleyball");
    expect(mapApiSportsGame("volleyball", named(g, "CEV Champions League"), SPORTING).competition).toMatchObject({ name: "Liga dos Campeões CEV", type: "europe" });
  });

  it("sem id do Sporting configurado ou equipa que não joga: erro", () => {
    const [g] = fixture("handball");
    expect(() => mapApiSportsGame("handball", g)).toThrow(/Sporting/);
    expect(() => mapApiSportsGame("handball", g, 77)).toThrow(/Sporting/);
  });
});

describe("apiSportsDue", () => {
  const now = new Date("2026-11-18T12:00:00Z");
  const min = 60_000;
  const game = (offsetMin: number) => ({ kickoff: new Date(now.getTime() + offsetMin * min) }) as MatchDoc;

  it("jogo a começar daqui a 10 min: devido, mesmo com execução recente", () => {
    expect(apiSportsDue({ lastRunAt: new Date(now.getTime() - 10 * min) }, [game(10)], now)).toBe(true);
  });
  it("jogo começou há 2 h 59 min: devido; há 3 h 1 min ou daqui a 16 min: não", () => {
    const recent = { lastRunAt: new Date(now.getTime() - min) };
    expect(apiSportsDue(recent, [game(-179)], now)).toBe(true);
    expect(apiSportsDue(recent, [game(-181)], now)).toBe(false);
    expect(apiSportsDue(recent, [game(16)], now)).toBe(false);
  });
  it("sem jogos: última execução há 2 h não; há 3 h 1 min sim; nunca correu sim", () => {
    expect(apiSportsDue({ lastRunAt: new Date(now.getTime() - 120 * min) }, [], now)).toBe(false);
    expect(apiSportsDue({ lastRunAt: new Date(now.getTime() - 181 * min) }, [], now)).toBe(true);
    expect(apiSportsDue({ lastRunAt: null }, [], now)).toBe(true);
  });
});
