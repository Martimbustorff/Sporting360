import * as fs from "fs";
import * as path from "path";
import { logger } from "firebase-functions";
import { SPORTING_CREST_URL } from "../../src/config/brand";
import { estimateFinishedAt, mapFixture } from "../../src/football/mapFixture";
import type { AfFixture } from "../../src/sources/apiFootball.types";

function load(name: string): AfFixture {
  const file = path.join(__dirname, "../fixtures/api-football", `${name}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8")).response[0] as AfFixture;
}

const NOW = new Date("2026-11-22T22:41:00Z");
const noPrev = { now: NOW, previous: null, observedLive: false };

describe("mapFixture: jogo", () => {
  it("mapeia um jogo a decorrer na 2.ª parte", () => {
    const f = load("fixture-live-2h");
    const { match } = mapFixture(f, noPrev);
    expect(match.id).toBe("1500003");
    expect(match.sport).toBe("football");
    expect(match.status).toBe("LIVE");
    expect(match.statusRaw).toBe("2H");
    expect(match.elapsed).toBe(f.fixture.status.elapsed);
    expect(match.competition.key).toBe("football_94_2026");
    expect(match.competition.id).toBe("94");
    expect(match.competition.name).toBe("Liga Portugal");
    expect(match.competition.type).toBe("league");
    expect(match.competition.season).toBe("2026");
    expect(match.competition.round).toBe("Regular Season - 12");
    expect(match.competition.roundLabel).toBe("J12");
    expect(match.referee).toBe(f.fixture.referee);
    expect(match.venue?.name).toBe(f.fixture.venue.name);
    expect(match.venue?.city).toBe("Lisboa");
    expect(match.venue).not.toHaveProperty("capacity");
    expect(match.venue).not.toHaveProperty("image");
    expect(match.score.home).toBe(f.goals.home);
    expect(match.score.away).toBe(f.goals.away);
    expect(match.score.halftime).toEqual({ home: 1, away: 0 });
    expect(match.score.extratime).toBeNull();
    expect(match.score.penalty).toBeNull();
    expect(match.kickoff).toEqual(new Date(f.fixture.date));
    expect(match.source).toEqual({ provider: "api-football", id: "1500003" });
    expect(match.finishedAt).toBeNull();
    expect(match.finishedAtSource).toBeNull();
  });

  it("sportingSide e emblema novo do Sporting", () => {
    const f = load("fixture-live-2h");
    const home = mapFixture(f, noPrev).match;
    expect(home.sportingSide).toBe(f.teams.home.id === 228 ? "home" : "away");
    const sporting = home.sportingSide === "home" ? home.home : home.away;
    const other = home.sportingSide === "home" ? home.away : home.home;
    expect(sporting.logo).toBe(SPORTING_CREST_URL);
    expect(other.logo).toBe(home.sportingSide === "home" ? f.teams.away.logo : f.teams.home.logo);

    const swapped: AfFixture = { ...f, teams: { home: f.teams.away, away: f.teams.home } };
    const m = mapFixture(swapped, noPrev).match;
    expect(m.sportingSide).toBe("away");
    expect(m.away.logo).toBe(SPORTING_CREST_URL);
  });

  it("jogo sem ronda nem estádio conhecido não rebenta", () => {
    const f = load("fixture-ns");
    const g = { ...f, fixture: { ...f.fixture, venue: { id: null, name: null, city: null } } };
    expect(mapFixture(g, noPrev).match).not.toHaveProperty("venue");
  });
});

describe("mapFixture: fim do jogo", () => {
  const ft = () => load("fixture-ft");

  it("transição observada: estava LIVE e agora é FT", () => {
    const { match } = mapFixture(ft(), {
      now: NOW,
      previous: { status: "LIVE", finishedAt: null, finishedAtSource: null },
      observedLive: true,
    });
    expect(match.status).toBe("FT");
    expect(match.finishedAt).toEqual(NOW);
    expect(match.finishedAtSource).toBe("observed");
  });

  it("já final antes: mantém o finishedAt anterior", () => {
    const prev = new Date("2026-11-22T22:20:00Z");
    const { match } = mapFixture(ft(), {
      now: new Date("2026-11-23T09:00:00Z"),
      previous: { status: "FT", finishedAt: prev, finishedAtSource: "observed" },
      observedLive: false,
    });
    expect(match.finishedAt).toEqual(prev);
    expect(match.finishedAtSource).toBe("observed");
  });

  it("FT sem histórico: estima periods.second + 50 min", () => {
    const f = ft();
    const now = new Date("2026-11-23T09:00:00Z");
    const { match } = mapFixture(f, { now, previous: null, observedLive: false });
    expect(match.finishedAtSource).toBe("estimated");
    expect(match.finishedAt).toEqual(new Date((f.fixture.periods.second! + 50 * 60) * 1000));
  });

  it("estimateFinishedAt: PEN soma 35 min, sem periods.second usa kickoff + 110 min, nunca depois de now", () => {
    const pen = load("fixture-pen");
    const late = new Date("2026-11-23T09:00:00Z");
    expect(estimateFinishedAt(pen, late)).toEqual(new Date((pen.fixture.periods.second! + (50 + 35) * 60) * 1000));

    const noSecond: AfFixture = { ...pen, fixture: { ...pen.fixture, periods: { first: null, second: null } } };
    expect(estimateFinishedAt(noSecond, late)).toEqual(new Date(pen.fixture.timestamp * 1000 + (110 + 35) * 60_000));

    const ft = load("fixture-ft");
    expect(estimateFinishedAt(ft, late)).toEqual(new Date((ft.fixture.periods.second! + 50 * 60) * 1000));

    const early = new Date((ft.fixture.periods.second! + 10 * 60) * 1000);
    expect(estimateFinishedAt(ft, early)).toEqual(early);
  });

  it("não-final apaga finishedAt (jogo reaberto)", () => {
    const { match } = mapFixture(load("fixture-live-2h"), {
      now: NOW,
      previous: { status: "FT", finishedAt: new Date("2026-11-22T22:00:00Z"), finishedAtSource: "estimated" },
      observedLive: false,
    });
    expect(match.finishedAt).toBeNull();
    expect(match.finishedAtSource).toBeNull();
  });
});

describe("mapFixture: penáltis", () => {
  let warn: jest.SpyInstance;
  beforeEach(() => { warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined); });
  afterEach(() => warn.mockRestore());

  it("resultado contado inclui prolongamento e exclui penáltis", () => {
    const f = load("fixture-pen");
    const { match } = mapFixture(f, { now: NOW, previous: null, observedLive: false });
    expect(match.status).toBe("PEN");
    expect(match.score.home).toBe(2);
    expect(match.score.away).toBe(2);
    expect(warn).not.toHaveBeenCalled();
    expect(match.score.penalty).toEqual({ home: 4, away: 3 });
    expect(match.score.extratime).toEqual({ home: 0, away: 0 });
    expect(match.competition.roundLabel).toBe("Quartos de final");
  });
});

describe("mapFixture: resultado contado em AET e PEN", () => {
  let warn: jest.SpyInstance;
  beforeEach(() => { warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined); });
  afterEach(() => warn.mockRestore());

  it("AET: fulltime + extratime", () => {
    const f = load("fixture-et");
    const g: AfFixture = {
      ...f,
      fixture: { ...f.fixture, status: { ...f.fixture.status, short: "AET", elapsed: 120 } },
      goals: { home: 3, away: 2 },
      score: { ...f.score, fulltime: { home: 2, away: 2 }, extratime: { home: 1, away: 0 }, penalty: { home: null, away: null } },
    };
    const { match } = mapFixture(g, noPrev);
    expect(match.status).toBe("AET");
    expect(match.score).toMatchObject({ home: 3, away: 2 });
    expect(warn).not.toHaveBeenCalled();
  });

  it("PEN com goals a incluir o desempate: conta fulltime + extratime e avisa", () => {
    const f = load("fixture-pen");
    const g: AfFixture = {
      ...f,
      goals: { home: 6, away: 5 },
      score: { ...f.score, fulltime: { home: 1, away: 1 }, extratime: { home: 1, away: 1 }, penalty: { home: 4, away: 3 } },
    };
    const { match } = mapFixture(g, noPrev);
    expect(match.score).toMatchObject({ home: 2, away: 2, penalty: { home: 4, away: 3 } });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("PEN com resultado contado sem empate avisa mas grava", () => {
    const f = load("fixture-pen");
    const g: AfFixture = {
      ...f,
      goals: { home: 3, away: 2 },
      score: { ...f.score, fulltime: { home: 2, away: 2 }, extratime: { home: 1, away: 0 } },
    };
    expect(mapFixture(g, noPrev).match.score).toMatchObject({ home: 3, away: 2 });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("mapFixture: pormenores", () => {
  let warn: jest.SpyInstance;
  beforeEach(() => { warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined); });
  afterEach(() => warn.mockRestore());

  it("kickoff vem de timestamp; sem timestamp usa date", () => {
    const f = load("fixture-ns");
    expect(mapFixture(f, noPrev).match.kickoff).toEqual(new Date(f.fixture.timestamp * 1000));
    const g = { ...f, fixture: { ...f.fixture, timestamp: undefined as unknown as number } };
    expect(mapFixture(g, noPrev).match.kickoff).toEqual(new Date(f.fixture.date));
    const bad = { ...f, fixture: { ...f.fixture, timestamp: undefined as unknown as number, date: "lixo" } };
    expect(() => mapFixture(bad, noPrev)).toThrow(/data de início/);
  });

  it("aviso quando nenhuma equipa é a 228", () => {
    const f = load("fixture-ns");
    const g: AfFixture = { ...f, teams: { home: { ...f.teams.home, id: 1 }, away: { ...f.teams.away, id: 2 } } };
    expect(mapFixture(g, noPrev).match.sportingSide).toBe("away");
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("AET sem histórico: estimativa soma 35 min", () => {
    const f = load("fixture-et");
    const g: AfFixture = { ...f, fixture: { ...f.fixture, status: { ...f.fixture.status, short: "AET", elapsed: 120 } } };
    const { match } = mapFixture(g, { now: new Date("2026-11-23T09:00:00Z"), previous: null, observedLive: false });
    expect(match.finishedAt).toEqual(new Date((f.fixture.periods.second! + 85 * 60) * 1000));
    expect(match.finishedAtSource).toBe("estimated");
  });

  it("FT -> LIVE -> FT: nova observação define novo finishedAt", () => {
    const ft = load("fixture-ft");
    const live = mapFixture(load("fixture-live-2h"), {
      now: NOW,
      previous: { status: "FT", finishedAt: new Date("2026-11-22T22:00:00Z"), finishedAtSource: "estimated" },
      observedLive: false,
    }).match;
    expect(live.finishedAt).toBeNull();
    const again = mapFixture(ft, {
      now: NOW,
      previous: { status: live.status, finishedAt: live.finishedAt, finishedAtSource: live.finishedAtSource },
      observedLive: true,
    }).match;
    expect(again.finishedAt).toEqual(NOW);
    expect(again.finishedAtSource).toBe("observed");
  });

  it("rating não string não rebenta", () => {
    const f = load("fixture-ft");
    const p = f.players[0].players[0];
    const g: AfFixture = {
      ...f,
      players: [{ ...f.players[0], players: [{ ...p, statistics: [{ ...p.statistics[0], games: { ...p.statistics[0].games, rating: 7.1 as unknown as string } }] }] }],
    };
    expect(mapFixture(g, noPrev).details.players!.teams[0].players[0].rating).toBe(7.1);
  });
});

describe("mapFixture: eventos", () => {
  it("classifica os tipos e põe em assistId quem entra", () => {
    const f = load("fixture-ft");
    const ev = f.events.find((e) => e.type === "subst");
    expect(ev).toBeDefined();
    const items = mapFixture(f, noPrev).details.events!.items;
    expect(items).toHaveLength(f.events.length);
    expect(items.find((i) => i.type === "goal")).toMatchObject({ teamId: "228", playerId: "5010", playerName: "Gyökeres", assistId: "5009" });
    expect(items.find((i) => i.type === "card")).toMatchObject({ detail: "Yellow Card", comments: "Foul" });
    expect(items.find((i) => i.type === "var")).toMatchObject({ detail: "Goal cancelled", assistId: null });
    const sub = items.find((i) => i.type === "subst")!;
    expect(sub.assistId).toBe(String(ev!.assist.id));
    expect(sub.minute).toBe(ev!.time.elapsed);
    expect(sub.extra).toBe(ev!.time.extra);
  });

  it("tipo desconhecido vira other", () => {
    const f = load("fixture-ft");
    const g: AfFixture = { ...f, events: [{ ...f.events[0], type: "Whatever" }] };
    expect(mapFixture(g, noPrev).details.events!.items[0].type).toBe("other");
  });
});

describe("mapFixture: estatísticas", () => {
  it("lê expected_goals como número", () => {
    const f = load("fixture-ft");
    const withXg: AfFixture = {
      ...f,
      statistics: f.statistics.map((s, i) => ({
        ...s,
        statistics: [...s.statistics.filter((x) => x.type !== "expected_goals"), { type: "expected_goals", value: i === 0 ? "1.43" : "0.88" }],
      })),
    };
    const stats = mapFixture(withXg, noPrev).details.statistics!;
    expect(stats.xg).toEqual({ home: 1.43, away: 0.88 });
    expect(stats.teams.map((t) => t.teamId)).toEqual(f.statistics.map((s) => String(s.team.id)));
    expect(stats.teams[0].items["Ball Possession"]).toBe("56%");
  });

  it("xg ausente fica null", () => {
    const f = load("fixture-ft");
    const without: AfFixture = {
      ...f,
      statistics: f.statistics.map((s) => ({ ...s, statistics: s.statistics.filter((x) => x.type !== "expected_goals") })),
    };
    expect(mapFixture(without, noPrev).details.statistics!.xg).toBeNull();
  });

  it("xg segue o lado casa/fora da fixture, não a ordem do array", () => {
    const f = load("fixture-ft");
    const homeId = f.teams.home.id;
    const stats = f.statistics.map((s) => ({
      ...s,
      statistics: [...s.statistics.filter((x) => x.type !== "expected_goals"), { type: "expected_goals", value: s.team.id === homeId ? "2.10" : "0.50" }],
    }));
    const reversed: AfFixture = { ...f, statistics: [...stats].reverse() };
    expect(mapFixture(reversed, noPrev).details.statistics!.xg).toEqual({ home: 2.1, away: 0.5 });
  });
});

describe("mapFixture: jogadores e onzes", () => {
  it("rating em texto vira número; vazio ou null vira null", () => {
    const f = load("fixture-ft");
    const p = f.players[0].players;
    const g: AfFixture = {
      ...f,
      players: [
        {
          ...f.players[0],
          players: [
            { ...p[0], statistics: [{ ...p[0].statistics[0], games: { ...p[0].statistics[0].games, rating: "7.3" } }] },
            { ...p[1], statistics: [{ ...p[1].statistics[0], games: { ...p[1].statistics[0].games, rating: null } }] },
            { ...p[0], player: { ...p[0].player, id: 9999 }, statistics: [{ ...p[0].statistics[0], games: { ...p[0].statistics[0].games, rating: "" } }] },
          ],
        },
      ],
    };
    const lines = mapFixture(g, noPrev).details.players!.teams[0].players;
    expect(lines[0].rating).toBe(7.3);
    expect(lines[1].rating).toBeNull();
    expect(lines[2].rating).toBeNull();
    expect(lines[0]).toMatchObject({ playerId: String(p[0].player.id), name: p[0].player.name, goals: 0, minutes: 90, substitute: false });
  });

  it("texto só com espaços não vira 0 (rating e precisão de passes ficam null)", () => {
    const f = load("fixture-ft");
    const p = f.players[0].players;
    const g: AfFixture = {
      ...f,
      players: [
        {
          ...f.players[0],
          players: [
            { ...p[0], statistics: [{ ...p[0].statistics[0], games: { ...p[0].statistics[0].games, rating: "  " }, passes: { total: 10, key: 0, accuracy: "   " } }] },
          ],
        },
      ],
    };
    const line = mapFixture(g, noPrev).details.players!.teams[0].players[0];
    expect(line.rating).toBeNull();
    expect(line.passesAccuracy).toBeNull();
  });

  it("onzes", () => {
    const f = load("fixture-ft");
    const t = mapFixture(f, noPrev).details.lineups!.teams[0];
    expect(t.teamId).toBe(String(f.lineups[0].team.id));
    expect(t.formation).toBe("4-3-3");
    expect(t.startXI[0]).toEqual({ playerId: "5000", name: "Israel", number: 1, pos: "G", grid: "1:1" });
  });
});

describe("mapFixture: jogo por começar", () => {
  it("arrays vazios dão detalhes null", () => {
    const { details } = mapFixture(load("fixture-ns"), noPrev);
    expect(details).toEqual({ events: null, statistics: null, lineups: null, players: null });
  });
});

describe("mapFixture: exceções de TV indisponíveis", () => {
  const prev = (tv: string | null | undefined) => ({ status: "NS" as const, finishedAt: null, finishedAtSource: null, tv });
  it("com documento anterior mantém o tv guardado (exceção com outro canal ou texto vazio) em vez da regra", () => {
    const f = load("fixture-live-2h");
    const ctx = { now: NOW, observedLive: false, tvOverridesUnavailable: true };
    expect(mapFixture(f, { ...ctx, previous: prev("Canal 11") }).match.tv).toBe("Canal 11");
    expect(mapFixture(f, { ...ctx, previous: prev(null) }).match.tv).toBeNull();
  });
  it("sem documento anterior, ou anterior sem o campo tv, vale a regra", () => {
    const f = load("fixture-live-2h");
    const ctx = { now: NOW, observedLive: false, tvOverridesUnavailable: true };
    expect(mapFixture(f, { ...ctx, previous: null }).match.tv).toBe("SPORT TV");
    expect(mapFixture(f, { ...ctx, previous: prev(undefined) }).match.tv).toBe("SPORT TV");
  });
  it("com as exceções lidas, o tv anterior não pesa", () => {
    const f = load("fixture-live-2h");
    expect(mapFixture(f, { now: NOW, observedLive: false, previous: prev("Canal 11") }).match.tv).toBe("SPORT TV");
  });
});

describe("mapFixture: canal de TV", () => {
  it("grava tv com a regra e com as exceções, sem pedidos novos", () => {
    const f = load("fixture-live-2h");
    expect(mapFixture(f, noPrev).match.tv).toBe("SPORT TV");
    expect(mapFixture(f, { ...noPrev, tvOverrides: { [String(f.fixture.id)]: "Canal 11" } }).match.tv).toBe("Canal 11");
    expect(mapFixture(f, { ...noPrev, tvOverrides: { [String(f.fixture.id)]: "" } }).match.tv).toBeNull();
  });
});
