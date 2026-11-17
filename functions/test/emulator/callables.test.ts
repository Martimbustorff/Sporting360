import { initializeApp, getApps, deleteApp } from "firebase-admin/app";
import { getFirestore, Firestore, Timestamp } from "firebase-admin/firestore";
import { handleSubmitPrediction } from "../../src/callables/submitPrediction";
import { handleVoteMvp } from "../../src/callables/voteMvp";

let db: Firestore;
const KICKOFF = new Date("2026-11-17T20:00:00Z");
const MIN = 60_000;
const alice = { uid: "alice" };

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  const app = initializeApp({ projectId: "demo-scp360" }, "callables-test");
  db = getFirestore(app);
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});
beforeEach(async () => {
  for (const c of ["games", "players", "predictions", "mvpVotes", "pointEvents", "users"]) {
    const snap = await db.collection(c).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  const lbs = await db.collection("leaderboards").get();
  for (const lb of lbs.docs) await db.recursiveDelete(lb.ref);
});

const team = (api: number, name: string) => ({ api, name, logo: "x" });
async function seedGame(over: Record<string, unknown> = {}) {
  await db.collection("games").doc("doc1").set({
    api: "m1",
    startTime: KICKOFF.toISOString(),
    endTime: new Date(KICKOFF.getTime() + 150 * MIN).toISOString(),
    timestamp: Timestamp.fromDate(KICKOFF),
    elapsedTime: "",
    isActive: false,
    scorehome: "",
    scoreaway: "",
    teamhome: team(228, "Sporting CP"),
    teamaway: team(211, "Benfica"),
    ...over,
  });
}
async function seedPlayers() {
  await db.collection("players").doc("228_m1").set({
    GameId: "m1",
    teamId: 228,
    Players: [
      { playerId: 10, name: "Gyokeres", rating: "8.1", minutes: 90 },
      { playerId: 11, name: "Banco", rating: "", minutes: 0 },
    ],
  });
}
const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return { code: (e as { code?: string }).code, message: (e as Error).message };
  }
  return null;
};
const pts = async (id: string) => (await db.doc(`pointEvents/${id}`).get()).data()?.points;

describe("handleSubmitPrediction", () => {
  const before = new Date(KICKOFF.getTime() - 60 * MIN);

  it("sem sessão -> unauthenticated", async () => {
    await seedGame();
    expect((await code(handleSubmitPrediction(db, undefined, { gameId: "m1", home: 1, away: 0 }, before)))?.code).toBe("unauthenticated");
  });

  it("antes do kickoff -> ok, doc exato e 1 ponto", async () => {
    await seedGame();
    const r = await handleSubmitPrediction(db, alice, { gameId: "m1", home: 2, away: 1 }, before);
    expect(r).toEqual({ ok: true });
    const d = (await db.doc("predictions/m1_alice").get()).data()!;
    expect(Object.keys(d).sort()).toEqual(["away", "createdAt", "gameId", "home", "source", "userId"]);
    expect(d).toMatchObject({ gameId: "m1", userId: "alice", home: 2, away: 1, source: "v2027" });
    expect(await pts("alice_m1_prediction_participation")).toBe(1);
  });

  it("nao escreve scored/scorehome/scoreaway (compatibilidade com legacy/V2)", async () => {
    await seedGame();
    await handleSubmitPrediction(db, alice, { gameId: "m1", home: 0, away: 0 }, before);
    const d = (await db.doc("predictions/m1_alice").get()).data()!;
    for (const f of ["scored", "scorehome", "scoreaway"]) expect(d).not.toHaveProperty(f);
  });

  it("segunda submissão -> already-exists e pontos continuam em 1", async () => {
    await seedGame();
    await handleSubmitPrediction(db, alice, { gameId: "m1", home: 2, away: 1 }, before);
    expect((await code(handleSubmitPrediction(db, alice, { gameId: "m1", home: 3, away: 3 }, before)))?.code).toBe("already-exists");
    expect(await pts("alice_m1_prediction_participation")).toBe(1);
    expect((await db.doc("predictions/m1_alice").get()).data()!.home).toBe(2);
  });

  it("doc v2027 sem pointEvent (falha anterior) -> already-exists e o ponto é recuperado", async () => {
    await seedGame();
    await db.doc("predictions/m1_alice").set({ gameId: "m1", userId: "alice", home: 1, away: 0, source: "v2027" });
    expect((await code(handleSubmitPrediction(db, alice, { gameId: "m1", home: 2, away: 2 }, before)))?.code).toBe("already-exists");
    expect(await pts("alice_m1_prediction_participation")).toBe(1);
  });

  it("doc V2 já existente -> already-exists e sem pontos", async () => {
    await seedGame();
    await db.doc("predictions/m1_alice").set({ scorehome: "1", scoreaway: "0", scored: false, userName: "A", season: "2026" });
    expect((await code(handleSubmitPrediction(db, alice, { gameId: "m1", home: 1, away: 0 }, before)))?.code).toBe("already-exists");
    expect(await pts("alice_m1_prediction_participation")).toBeUndefined();
  });

  it("depois do kickoff -> PREDICTION_CLOSED", async () => {
    await seedGame();
    const r = await code(handleSubmitPrediction(db, alice, { gameId: "m1", home: 1, away: 0 }, new Date(KICKOFF.getTime() + MIN)));
    expect(r).toEqual({ code: "failed-precondition", message: "PREDICTION_CLOSED" });
  });

  it("jogo inexistente -> not-found", async () => {
    expect((await code(handleSubmitPrediction(db, alice, { gameId: "zzz", home: 1, away: 0 }, before)))?.code).toBe("not-found");
  });

  it.each([
    [{ gameId: "m1", home: 21, away: 0 }],
    [{ gameId: "m1", home: 1.5, away: 0 }],
    [{ gameId: "m1", home: -1, away: 0 }],
    [{ gameId: "m1", home: "1", away: 0 }],
    [{ gameId: "", home: 1, away: 0 }],
    [{ gameId: "a/b", home: 1, away: 0 }],
    [null],
    ["x"],
  ])("dados inválidos %j -> invalid-argument", async (data) => {
    await seedGame();
    expect((await code(handleSubmitPrediction(db, alice, data, before)))?.code).toBe("invalid-argument");
  });
});

describe("handleVoteMvp", () => {
  const live = (elapsed: string) => seedGame({ isActive: true, elapsedTime: elapsed });
  const now = new Date(KICKOFF.getTime() + 85 * MIN);

  it("sem sessão -> unauthenticated", async () => {
    await live("80");
    expect((await code(handleVoteMvp(db, undefined, { gameId: "m1", playerId: "10" }, now)))?.code).toBe("unauthenticated");
  });

  it("minuto 79 -> MVP_NOT_OPEN", async () => {
    await live("79");
    await seedPlayers();
    expect(await code(handleVoteMvp(db, alice, { gameId: "m1", playerId: "10" }, now))).toEqual({
      code: "failed-precondition",
      message: "MVP_NOT_OPEN",
    });
  });

  it("minuto 80 com candidato válido -> ok, doc exato e 1 ponto", async () => {
    await live("80");
    await seedPlayers();
    expect(await handleVoteMvp(db, alice, { gameId: "m1", playerId: "10" }, now)).toEqual({ ok: true });
    const d = (await db.doc("mvpVotes/m1_alice").get()).data()!;
    expect(Object.keys(d).sort()).toEqual(["createdAt", "gameId", "playerId", "source", "userId"]);
    expect(d).toMatchObject({ gameId: "m1", userId: "alice", playerId: "10", source: "v2027" });
    expect(await pts("alice_m1_mvp_participation")).toBe(1);
  });

  it("segundo voto -> already-exists, pontos continuam em 1", async () => {
    await live("85");
    await seedPlayers();
    await handleVoteMvp(db, alice, { gameId: "m1", playerId: "10" }, now);
    expect((await code(handleVoteMvp(db, alice, { gameId: "m1", playerId: "10" }, now)))?.code).toBe("already-exists");
    expect(await pts("alice_m1_mvp_participation")).toBe(1);
  });

  it("voto v2027 sem pointEvent (falha anterior) -> already-exists e o ponto é recuperado", async () => {
    await live("85");
    await seedPlayers();
    await db.doc("mvpVotes/m1_alice").set({ gameId: "m1", userId: "alice", playerId: "10", source: "v2027" });
    expect((await code(handleVoteMvp(db, alice, { gameId: "m1", playerId: "10" }, now)))?.code).toBe("already-exists");
    expect(await pts("alice_m1_mvp_participation")).toBe(1);
  });

  it("jogador que não jogou ou desconhecido -> invalid-argument", async () => {
    await live("85");
    await seedPlayers();
    expect((await code(handleVoteMvp(db, alice, { gameId: "m1", playerId: "11" }, now)))?.code).toBe("invalid-argument");
    expect((await code(handleVoteMvp(db, alice, { gameId: "m1", playerId: "999" }, now)))?.code).toBe("invalid-argument");
  });

  it("depois de finishedAt + 20 min -> MVP_CLOSED; dentro da janela -> ok", async () => {
    const fin = new Date(KICKOFF.getTime() + 110 * MIN);
    await seedGame({ status: "FT", finishedAt: fin.toISOString(), elapsedTime: "90" });
    await seedPlayers();
    expect(await code(handleVoteMvp(db, alice, { gameId: "m1", playerId: "10" }, new Date(fin.getTime() + 21 * MIN)))).toEqual({
      code: "failed-precondition",
      message: "MVP_CLOSED",
    });
    expect(await handleVoteMvp(db, alice, { gameId: "m1", playerId: "10" }, new Date(fin.getTime() + 19 * MIN))).toEqual({ ok: true });
  });

  it("jogo inexistente -> not-found; dados inválidos -> invalid-argument", async () => {
    expect((await code(handleVoteMvp(db, alice, { gameId: "zzz", playerId: "10" }, now)))?.code).toBe("not-found");
    expect((await code(handleVoteMvp(db, alice, { gameId: "m1", playerId: "" }, now)))?.code).toBe("invalid-argument");
    expect((await code(handleVoteMvp(db, alice, { gameId: "a/b", playerId: "10" }, now)))?.code).toBe("invalid-argument");
    expect((await code(handleVoteMvp(db, alice, { gameId: "m1", playerId: 10 }, now)))?.code).toBe("invalid-argument");
  });
});
