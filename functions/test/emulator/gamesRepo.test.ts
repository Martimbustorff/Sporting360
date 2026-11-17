import { initializeApp, getApps, deleteApp } from "firebase-admin/app";
import { getFirestore, Firestore, Timestamp } from "firebase-admin/firestore";
import { getGameState, getPlayerLines, listFinishedUnsettled } from "../../src/data/gamesRepo";
import { clearAll } from "../helpers/emulatorDb";
import { seedFootballMatch, seedPlayers } from "../helpers/seedMatch";

let db: Firestore;
const NOW = new Date("2026-11-17T20:00:00Z");
const H = 3_600_000;

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  const app = initializeApp({ projectId: "demo-scp360" }, "gamesRepo-test");
  db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});
beforeEach(async () => {
  await clearAll(db);
});

describe("getGameState", () => {
  it("devolve null se o jogo não existe", async () => {
    expect(await getGameState(db, "nope", NOW)).toBeNull();
  });

  it("jogo FT com finishedAt -> GameState completo", async () => {
    await seedFootballMatch(db, {
      id: "1001",
      kickoff: new Date("2026-11-15T20:30:00Z"),
      finishedAt: new Date("2026-11-15T22:20:00Z"),
    });
    expect(await getGameState(db, "1001", NOW)).toEqual({
      gameId: "1001",
      kickoff: new Date("2026-11-15T20:30:00Z"),
      status: "FT",
      elapsed: 90,
      goalsHome: 2,
      goalsAway: 1,
      finishedAt: new Date("2026-11-15T22:20:00Z"),
      sportingSide: "home",
    });
  });

  it("LIVE com elapsed 67 e sem finishedAt", async () => {
    await seedFootballMatch(db, { id: "1001", status: "LIVE", statusRaw: "2H", elapsed: 67, finishedAt: null, finishedAtSource: null });
    const g = await getGameState(db, "1001", NOW);
    expect(g?.status).toBe("LIVE");
    expect(g?.elapsed).toBe(67);
    expect(g?.finishedAt).toBeNull();
  });

  it("sporting fora e golos nulos -> sportingSide away, goals null", async () => {
    await seedFootballMatch(db, {
      id: "1001",
      sportingSide: "away",
      home: { id: "211", name: "Benfica", logo: null },
      away: { id: "228", name: "Sporting CP", logo: null },
      score: { home: null, away: null, halftime: null, extratime: null, penalty: null },
    });
    const g = await getGameState(db, "1001", NOW);
    expect(g?.sportingSide).toBe("away");
    expect(g?.goalsHome).toBeNull();
    expect(g?.goalsAway).toBeNull();
  });

  it("estado real da API: AET e PEN lidos diretamente, NS antes do kickoff", async () => {
    for (const status of ["AET", "PEN", "HT", "PST", "CANC", "NS"] as const) {
      await seedFootballMatch(db, { id: "1001", status, statusRaw: status });
      expect((await getGameState(db, "1001", NOW))?.status).toBe(status);
    }
  });

  it("jogo de andebol hb_1 -> null", async () => {
    await seedFootballMatch(db, { id: "hb_1", sport: "handball" });
    expect(await getGameState(db, "hb_1", NOW)).toBeNull();
  });
});

describe("getPlayerLines", () => {
  it("sem documento de jogadores -> lista vazia", async () => {
    expect(await getPlayerLines(db, "1001")).toEqual([]);
  });

  it("achata as duas equipas e converte rating vazio em null", async () => {
    await seedPlayers(db, "1001", [
      {
        teamId: "228",
        players: [
          { playerId: "1", name: "Gyökeres", rating: 8.4, minutes: 90 },
          { playerId: "2", name: "Suplente", rating: null, minutes: null, substitute: true },
        ],
      },
      { teamId: "211", players: [{ playerId: "9", name: "Rival", rating: 6.1, minutes: 70 }] },
    ]);
    await seedPlayers(db, "2002", [{ teamId: "228", players: [{ playerId: "3", name: "Outro Jogo", rating: 7, minutes: 90 }] }]);
    const lines = await getPlayerLines(db, "1001");
    expect(lines).toHaveLength(3);
    const by = Object.fromEntries(lines.map((l) => [l.playerId, l]));
    expect(by["1"]).toEqual({ playerId: "1", name: "Gyökeres", teamIsSporting: true, minutes: 90, rating: 8.4 });
    expect(by["2"]).toEqual({ playerId: "2", name: "Suplente", teamIsSporting: true, minutes: null, rating: null });
    expect(by["9"].teamIsSporting).toBe(false);
  });
});

describe("listFinishedUnsettled", () => {
  const finished = (id: string, finishedAt: Date, kickoff: Date) =>
    seedFootballMatch(db, { id, kickoff, finishedAt });

  it("devolve terminados há >= 2h, sem settledAt e dentro de 7 dias", async () => {
    // A: terminou há 3h -> elegível
    await finished("A", new Date(NOW.getTime() - 3 * H), new Date(NOW.getTime() - 5 * H));
    // B: terminou há 1h -> cedo demais
    await finished("B", new Date(NOW.getTime() - 1 * H), new Date(NOW.getTime() - 3 * H));
    // C: elegível mas já liquidado
    await finished("C", new Date(NOW.getTime() - 4 * H), new Date(NOW.getTime() - 6 * H));
    await db.collection("settlements").doc("C").set({ settledAt: Timestamp.fromDate(NOW) });
    // D: settlements sem settledAt não conta como liquidado
    await finished("D", new Date(NOW.getTime() - 4 * H), new Date(NOW.getTime() - 6 * H));
    await db.collection("settlements").doc("D").set({ other: 1 });
    // E: fora da janela de 7 dias
    await finished("E", new Date("2026-11-01T22:00:00Z"), new Date("2026-11-01T20:00:00Z"));
    // F: ainda em jogo
    await seedFootballMatch(db, { id: "F", status: "LIVE", statusRaw: "2H", elapsed: 70, finishedAt: null, finishedAtSource: null, kickoff: new Date(NOW.getTime() - 3 * H) });

    const res = await listFinishedUnsettled(db, NOW);
    expect(res.map((g) => g.gameId).sort()).toEqual(["A", "D"]);
  });

  it("ignora outros desportos e estados não finais com finishedAt", async () => {
    await seedFootballMatch(db, { id: "hb_1", sport: "handball", finishedAt: new Date(NOW.getTime() - 3 * H) });
    await seedFootballMatch(db, { id: "P", status: "PST", statusRaw: "PST", finishedAt: new Date(NOW.getTime() - 3 * H) });
    await seedFootballMatch(db, { id: "ET", status: "AET", statusRaw: "AET", finishedAt: new Date(NOW.getTime() - 3 * H) });
    expect((await listFinishedUnsettled(db, NOW)).map((g) => g.gameId)).toEqual(["ET"]);
  });
});
