import { initializeApp, getApps, deleteApp } from "firebase-admin/app";
import { getFirestore, Firestore, Timestamp } from "firebase-admin/firestore";
import { getGameState, getPlayerLines, listFinishedUnsettled } from "../../src/data/gamesRepo";

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
  for (const c of ["games", "players", "settlements"]) {
    const snap = await db.collection(c).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
});

const team = (api: number | string, name: string) => ({ api, name, logo: "x" });
function game(over: Record<string, unknown> = {}) {
  return {
    api: "1001",
    startTime: "2026-11-15T20:30:00+00:00",
    endTime: "2026-11-15T22:20:00+00:00",
    timestamp: Timestamp.fromDate(new Date("2026-11-15T20:30:00Z")),
    elapsedTime: "90",
    isActive: false,
    scorehome: "2",
    scoreaway: "1",
    teamhome: team(228, "Sporting CP"),
    teamaway: team(211, "Benfica"),
    competition: "Primeira Liga",
    journey: "12",
    season: "2026",
    ...over,
  };
}

describe("getGameState", () => {
  it("devolve null se o jogo não existe", async () => {
    expect(await getGameState(db, "nope", NOW)).toBeNull();
  });

  it("jogo terminado sem status: deriva FT com finishedAt = endTime", async () => {
    await db.collection("games").doc("x").set(game());
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

  it("sporting fora, kickoff por número em segundos, golos inválidos -> null", async () => {
    await db.collection("games").doc("x").set(
      game({
        teamhome: team("211", "Benfica"),
        teamaway: team("228", "Sporting CP"),
        timestamp: 1_794_000_000,
        scorehome: "",
        scoreaway: undefined,
      }),
    );
    const g = await getGameState(db, "1001", NOW);
    expect(g?.sportingSide).toBe("away");
    expect(g?.kickoff).toEqual(new Date(1_794_000_000 * 1000));
    expect(g?.goalsHome).toBeNull();
    expect(g?.goalsAway).toBeNull();
  });

  it("kickoff em milissegundos e sem timestamp (usa startTime)", async () => {
    await db.collection("games").doc("a").set(game({ timestamp: 1_794_000_000_000 }));
    expect((await getGameState(db, "1001", NOW))?.kickoff).toEqual(new Date(1_794_000_000_000));
    await db.collection("games").doc("a").set(game({ timestamp: undefined }));
    expect((await getGameState(db, "1001", NOW))?.kickoff).toEqual(new Date("2026-11-15T20:30:00Z"));
  });

  it("isActive -> LIVE com elapsed", async () => {
    await db.collection("games").doc("x").set(game({ isActive: true, elapsedTime: "67", endTime: null }));
    const g = await getGameState(db, "1001", NOW);
    expect(g?.status).toBe("LIVE");
    expect(g?.elapsed).toBe(67);
    expect(g?.finishedAt).toBeNull();
  });

  it("não ativo antes do kickoff -> NS", async () => {
    await db.collection("games").doc("x").set(
      game({ timestamp: Timestamp.fromDate(new Date("2026-11-20T20:00:00Z")), elapsedTime: "0", scorehome: "", scoreaway: "" }),
    );
    expect((await getGameState(db, "1001", NOW))?.status).toBe("NS");
  });

  it("não ativo, depois do kickoff, elapsed < 90 -> NS", async () => {
    await db.collection("games").doc("x").set(game({ elapsedTime: "45" }));
    expect((await getGameState(db, "1001", NOW))?.status).toBe("NS");
  });

  it("campo status explícito (e finishedAt Timestamp) tem prioridade", async () => {
    await db.collection("games").doc("x").set(
      game({ status: "AET", finishedAt: Timestamp.fromDate(new Date("2026-11-15T23:00:00Z")), isActive: true }),
    );
    const g = await getGameState(db, "1001", NOW);
    expect(g?.status).toBe("AET");
    expect(g?.finishedAt).toEqual(new Date("2026-11-15T23:00:00Z"));
  });

  it("mapeia códigos da API-Football", async () => {
    const cases: Array<[string, string]> = [
      ["TBD", "NS"], ["2H", "LIVE"], ["ET", "LIVE"], ["BT", "LIVE"], ["P", "LIVE"], ["LIVE", "LIVE"], ["INT", "LIVE"],
      ["HT", "HT"], ["PEN", "PEN"], ["SUSP", "PST"], ["PST", "PST"], ["ABD", "CANC"], ["AWD", "CANC"], ["WO", "CANC"], ["CANC", "CANC"],
    ];
    for (const [code, expected] of cases) {
      await db.collection("games").doc("x").set(game({ status: code }));
      expect((await getGameState(db, "1001", NOW))?.status).toBe(expected);
    }
  });
});

describe("getPlayerLines", () => {
  it("achata Players[] das duas equipas", async () => {
    await db.collection("players").doc("228_1001").set({
      GameId: "1001", teamId: 228,
      Players: [
        { playerId: 1, name: "Gyökeres", rating: "8.4", minutes: 90, substitute: false },
        { playerId: 2, name: "Suplente", rating: "", substitute: true },
      ],
    });
    await db.collection("players").doc("211_1001").set({
      GameId: "1001", teamId: 211,
      Players: [{ playerId: 9, name: "Rival", rating: "6.1", minutes: 70 }],
    });
    await db.collection("players").doc("228_2002").set({
      GameId: "2002", teamId: 228, Players: [{ playerId: 3, name: "Outro Jogo", rating: "7", minutes: 90 }],
    });
    const lines = await getPlayerLines(db, "1001");
    expect(lines).toHaveLength(3);
    const by = Object.fromEntries(lines.map((l) => [l.playerId, l]));
    expect(by["1"]).toEqual({ playerId: "1", name: "Gyökeres", teamIsSporting: true, minutes: 90, rating: 8.4 });
    expect(by["2"]).toEqual({ playerId: "2", name: "Suplente", teamIsSporting: true, minutes: null, rating: null });
    expect(by["9"].teamIsSporting).toBe(false);
  });
});

describe("listFinishedUnsettled", () => {
  const finished = (api: string, endIso: string, ts: Date) =>
    game({ api, endTime: endIso, timestamp: Timestamp.fromDate(ts) });

  it("devolve terminados há >= 2h e sem settledAt", async () => {
    // terminou há 3h -> elegível
    await db.collection("games").doc("a").set(finished("A", new Date(NOW.getTime() - 3 * H).toISOString(), new Date(NOW.getTime() - 5 * H)));
    // terminou há 1h -> cedo demais
    await db.collection("games").doc("b").set(finished("B", new Date(NOW.getTime() - 1 * H).toISOString(), new Date(NOW.getTime() - 3 * H)));
    // elegível mas já liquidado
    await db.collection("games").doc("c").set(finished("C", new Date(NOW.getTime() - 4 * H).toISOString(), new Date(NOW.getTime() - 6 * H)));
    await db.collection("settlements").doc("C").set({ settledAt: Timestamp.fromDate(NOW) });
    // settlements sem settledAt não conta como liquidado
    await db.collection("games").doc("d").set(finished("D", new Date(NOW.getTime() - 4 * H).toISOString(), new Date(NOW.getTime() - 6 * H)));
    await db.collection("settlements").doc("D").set({ other: 1 });
    // fora da janela de 7 dias
    await db.collection("games").doc("e").set(finished("E", "2026-11-01T22:00:00Z", new Date("2026-11-01T20:00:00Z")));
    // ainda em jogo
    await db.collection("games").doc("f").set(game({ api: "F", isActive: true, elapsedTime: "70", timestamp: Timestamp.fromDate(new Date(NOW.getTime() - 3 * H)) }));

    const res = await listFinishedUnsettled(db, NOW);
    expect(res.map((g) => g.gameId).sort()).toEqual(["A", "D"]);
  });
});
