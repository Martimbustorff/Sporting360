import { initializeApp, getApps, deleteApp } from "firebase-admin/app";
import { getFirestore, Firestore, Timestamp } from "firebase-admin/firestore";
import type { MatchDoc } from "../../src/model/types";
import { clearAll } from "../helpers/emulatorDb";
import { seedFootballMatch, seedPlayers as seedPlayerLines } from "../helpers/seedMatch";
import { handleSubmitPrediction } from "../../src/callables/submitPrediction";
import { handleVoteMvp } from "../../src/callables/voteMvp";
import { aggregateMvpTallies } from "../../src/scheduled/mvpTallyAggregator";
import { sumShards } from "../../src/game/mvpTally";

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
  await clearAll(db);
});

async function seedGame(over: Partial<MatchDoc> = {}) {
  await seedFootballMatch(db, {
    id: "m1",
    kickoff: KICKOFF,
    status: "NS",
    statusRaw: "NS",
    elapsed: null,
    score: { home: null, away: null, halftime: null, extratime: null, penalty: null },
    finishedAt: null,
    finishedAtSource: null,
    ...over,
  });
}
async function seedPlayers() {
  await seedPlayerLines(db, "m1", [
    {
      teamId: "228",
      players: [
        { playerId: "10", name: "Gyokeres", rating: 8.1, minutes: 90 },
        { playerId: "11", name: "Banco", rating: null, minutes: 0 },
      ],
    },
  ]);
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
    const d = (await db.doc("matchPredictions/m1_alice").get()).data()!;
    expect(Object.keys(d).sort()).toEqual(["away", "createdAt", "gameId", "home", "source", "userId"]);
    expect(d).toMatchObject({ gameId: "m1", userId: "alice", home: 2, away: 1, source: "v2027" });
    expect(await pts("alice_m1_prediction_participation")).toBe(1);
  });

  it("nao escreve scored/scorehome/scoreaway (compatibilidade com legacy/V2)", async () => {
    await seedGame();
    await handleSubmitPrediction(db, alice, { gameId: "m1", home: 0, away: 0 }, before);
    const d = (await db.doc("matchPredictions/m1_alice").get()).data()!;
    for (const f of ["scored", "scorehome", "scoreaway"]) expect(d).not.toHaveProperty(f);
  });

  it("segunda submissão -> already-exists e pontos continuam em 1", async () => {
    await seedGame();
    await handleSubmitPrediction(db, alice, { gameId: "m1", home: 2, away: 1 }, before);
    expect((await code(handleSubmitPrediction(db, alice, { gameId: "m1", home: 3, away: 3 }, before)))?.code).toBe("already-exists");
    expect(await pts("alice_m1_prediction_participation")).toBe(1);
    expect((await db.doc("matchPredictions/m1_alice").get()).data()!.home).toBe(2);
  });

  it("doc v2027 sem pointEvent (falha anterior) -> already-exists e o ponto é recuperado", async () => {
    await seedGame();
    await db.doc("matchPredictions/m1_alice").set({ gameId: "m1", userId: "alice", home: 1, away: 0, source: "v2027" });
    expect((await code(handleSubmitPrediction(db, alice, { gameId: "m1", home: 2, away: 2 }, before)))?.code).toBe("already-exists");
    expect(await pts("alice_m1_prediction_participation")).toBe(1);
  });

  it("um doc V2 em predictions não bloqueia a submissão v2027", async () => {
    await seedGame();
    await db.doc("predictions/m1_alice").set({ scorehome: "1", scoreaway: "0", scored: false, userName: "A", season: "2026" });
    expect(await handleSubmitPrediction(db, alice, { gameId: "m1", home: 1, away: 0 }, before)).toEqual({ ok: true });
    expect((await db.doc("matchPredictions/m1_alice").get()).data()).toMatchObject({ source: "v2027", home: 1, away: 0 });
    expect((await db.doc("predictions/m1_alice").get()).data()!.scorehome).toBe("1");
    expect(await pts("alice_m1_prediction_participation")).toBe(1);
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
  const live = (elapsed: number) => seedGame({ status: "LIVE", statusRaw: "2H", elapsed });
  const now = new Date(KICKOFF.getTime() + 85 * MIN);

  it("sem sessão -> unauthenticated", async () => {
    await live(80);
    expect((await code(handleVoteMvp(db, undefined, { gameId: "m1", playerId: "10" }, now)))?.code).toBe("unauthenticated");
  });

  it("minuto 79 -> MVP_NOT_OPEN", async () => {
    await live(79);
    await seedPlayers();
    expect(await code(handleVoteMvp(db, alice, { gameId: "m1", playerId: "10" }, now))).toEqual({
      code: "failed-precondition",
      message: "MVP_NOT_OPEN",
    });
  });

  it("minuto 80 com candidato válido -> ok, doc exato e 1 ponto", async () => {
    await live(80);
    await seedPlayers();
    expect(await handleVoteMvp(db, alice, { gameId: "m1", playerId: "10" }, now)).toEqual({ ok: true });
    const d = (await db.doc("mvpVotes/m1_alice").get()).data()!;
    expect(Object.keys(d).sort()).toEqual(["createdAt", "gameId", "playerId", "source", "userId"]);
    expect(d).toMatchObject({ gameId: "m1", userId: "alice", playerId: "10", source: "v2027" });
    expect(await pts("alice_m1_mvp_participation")).toBe(1);
  });

  it("segundo voto -> already-exists, pontos continuam em 1", async () => {
    await live(85);
    await seedPlayers();
    await handleVoteMvp(db, alice, { gameId: "m1", playerId: "10" }, now);
    expect((await code(handleVoteMvp(db, alice, { gameId: "m1", playerId: "10" }, now)))?.code).toBe("already-exists");
    expect(await pts("alice_m1_mvp_participation")).toBe(1);
  });

  it("voto v2027 sem pointEvent (falha anterior) -> already-exists e o ponto é recuperado", async () => {
    await live(85);
    await seedPlayers();
    await db.doc("mvpVotes/m1_alice").set({ gameId: "m1", userId: "alice", playerId: "10", source: "v2027" });
    expect((await code(handleVoteMvp(db, alice, { gameId: "m1", playerId: "10" }, now)))?.code).toBe("already-exists");
    expect(await pts("alice_m1_mvp_participation")).toBe(1);
  });

  it("jogador que não jogou ou desconhecido -> invalid-argument", async () => {
    await live(85);
    await seedPlayers();
    expect((await code(handleVoteMvp(db, alice, { gameId: "m1", playerId: "11" }, now)))?.code).toBe("invalid-argument");
    expect((await code(handleVoteMvp(db, alice, { gameId: "m1", playerId: "999" }, now)))?.code).toBe("invalid-argument");
  });

  it("depois de finishedAt + 20 min -> MVP_CLOSED; dentro da janela -> ok", async () => {
    const fin = new Date(KICKOFF.getTime() + 110 * MIN);
    await seedGame({ status: "FT", statusRaw: "FT", finishedAt: fin, elapsed: 90 });
    await seedPlayers();
    expect(await code(handleVoteMvp(db, alice, { gameId: "m1", playerId: "10" }, new Date(fin.getTime() + 21 * MIN)))).toEqual({
      code: "failed-precondition",
      message: "MVP_CLOSED",
    });
    expect(await handleVoteMvp(db, alice, { gameId: "m1", playerId: "10" }, new Date(fin.getTime() + 19 * MIN))).toEqual({ ok: true });
  });

  describe("mvpTallies", () => {
    // Soma dos shards escritos pelo voto (o pai só é escrito pelo agregador).
    const shardDocs = async () => (await db.collection("mvpTallies/m1/shards").get()).docs;
    const tally = async () => {
      const docs = await shardDocs();
      return docs.length === 0 ? undefined : { gameId: docs[0].get("gameId"), ...sumShards(docs.map((d) => d.data())) };
    };
    const parent = async () => (await db.doc("mvpTallies/m1").get()).data();
    async function seedTwoCandidates() {
      await seedPlayerLines(db, "m1", [
        {
          teamId: "228",
          players: [
            { playerId: "p10", name: "Gyokeres", rating: 8.1, minutes: 90 },
            { playerId: "p7", name: "Trincao", rating: 7.4, minutes: 90 },
          ],
        },
      ]);
    }

    it("vote creates mvpTallies with counts and total", async () => {
      await live(85);
      await seedTwoCandidates();
      await handleVoteMvp(db, alice, { gameId: "m1", playerId: "p10" }, now);
      const docs = await shardDocs();
      expect(docs).toHaveLength(1);
      expect(Number(docs[0].id)).toBeGreaterThanOrEqual(0);
      expect(Number(docs[0].id)).toBeLessThan(20);
      expect(docs[0].get("updatedAt")).toBeInstanceOf(Timestamp);
      const t = (await tally())!;
      expect(t.gameId).toBe("m1");
      expect(t.counts).toEqual({ p10: 1 });
      expect(t.total).toBe(1);
      expect(await parent()).toBeUndefined();
    });

    it("second voter adds to the same tally", async () => {
      await live(85);
      await seedTwoCandidates();
      await handleVoteMvp(db, alice, { gameId: "m1", playerId: "p10" }, now);
      await handleVoteMvp(db, { uid: "bob" }, { gameId: "m1", playerId: "p7" }, now);
      const t = (await tally())!;
      expect(t.counts).toEqual({ p10: 1, p7: 1 });
      expect(t.total).toBe(2);
    });

    it("repeated call after saved vote does not count twice", async () => {
      await live(85);
      await seedTwoCandidates();
      await handleVoteMvp(db, alice, { gameId: "m1", playerId: "p10" }, now);
      expect((await code(handleVoteMvp(db, alice, { gameId: "m1", playerId: "p7" }, now)))?.code).toBe("already-exists");
      const t = (await tally())!;
      expect(t.counts).toEqual({ p10: 1 });
      expect(t.total).toBe(1);
      expect((await db.doc("mvpVotes/m1_alice").get()).data()?.playerId).toBe("p10");
    });

    it("rejected vote does not touch the tally (before, closed, invalid player)", async () => {
      await live(79);
      await seedTwoCandidates();
      expect((await code(handleVoteMvp(db, alice, { gameId: "m1", playerId: "p10" }, now)))?.message).toBe("MVP_NOT_OPEN");
      expect(await tally()).toBeUndefined();

      const fin = new Date(KICKOFF.getTime() + 110 * MIN);
      await seedGame({ status: "FT", statusRaw: "FT", finishedAt: fin, elapsed: 90 });
      const late = new Date(fin.getTime() + 21 * MIN);
      expect((await code(handleVoteMvp(db, alice, { gameId: "m1", playerId: "p10" }, late)))?.message).toBe("MVP_CLOSED");
      expect(await tally()).toBeUndefined();

      await live(85);
      expect((await code(handleVoteMvp(db, alice, { gameId: "m1", playerId: "999" }, now)))?.code).toBe("invalid-argument");
      expect(await tally()).toBeUndefined();
    });

    // Emulador: prova que os incrementos são exatos com concorrência, não a capacidade de produção.
    it("50 parallel votes then the aggregator give total 50 with exact counts", async () => {
      await live(85);
      await seedTwoCandidates();
      const uids = Array.from({ length: 50 }, (_, i) => `u${i}`);
      const results = await Promise.all(
        uids.map((uid, i) => handleVoteMvp(db, { uid }, { gameId: "m1", playerId: i % 5 === 0 ? "p7" : "p10" }, now)),
      );
      expect(results.every((r) => r.ok)).toBe(true);
      expect(await tally()).toMatchObject({ counts: { p10: 40, p7: 10 }, total: 50 });

      expect(await aggregateMvpTallies(db, now)).toEqual({ count: 1 });
      const p = (await parent())!;
      expect(Object.keys(p).sort()).toEqual(["counts", "gameId", "total", "updatedAt"]);
      expect(p).toMatchObject({ gameId: "m1", counts: { p10: 40, p7: 10 }, total: 50 });
    }, 60_000);

    it("aggregator only rewrites the parent when the sum changes", async () => {
      await live(85);
      await seedTwoCandidates();
      await handleVoteMvp(db, alice, { gameId: "m1", playerId: "p10" }, now);
      expect(await aggregateMvpTallies(db, now)).toEqual({ count: 1 });
      expect(await aggregateMvpTallies(db, now)).toEqual({ count: 0 });
      await handleVoteMvp(db, { uid: "bob" }, { gameId: "m1", playerId: "p7" }, now);
      expect(await aggregateMvpTallies(db, now)).toEqual({ count: 1 });
      expect(await parent()).toMatchObject({ counts: { p10: 1, p7: 1 }, total: 2 });
    });

    it("aggregator skips games with no shards and games outside the window", async () => {
      await live(85);
      await seedTwoCandidates();
      expect(await aggregateMvpTallies(db, now)).toEqual({ count: 0 });
      expect(await parent()).toBeUndefined();

      await handleVoteMvp(db, alice, { gameId: "m1", playerId: "p10" }, now);
      const fin = new Date(KICKOFF.getTime() + 110 * MIN);
      await seedGame({ status: "FT", statusRaw: "FT", finishedAt: fin, elapsed: 90 });
      // Fechou em fin+20; até fin+30 ainda agrega, depois não.
      expect(await aggregateMvpTallies(db, new Date(fin.getTime() + 31 * MIN))).toEqual({ count: 0 });
      expect(await parent()).toBeUndefined();
      expect(await aggregateMvpTallies(db, new Date(fin.getTime() + 29 * MIN))).toEqual({ count: 1 });
      expect(await parent()).toMatchObject({ counts: { p10: 1 }, total: 1 });
    });
  });

  it("jogo inexistente -> not-found; dados inválidos -> invalid-argument", async () => {
    expect((await code(handleVoteMvp(db, alice, { gameId: "zzz", playerId: "10" }, now)))?.code).toBe("not-found");
    expect((await code(handleVoteMvp(db, alice, { gameId: "m1", playerId: "" }, now)))?.code).toBe("invalid-argument");
    expect((await code(handleVoteMvp(db, alice, { gameId: "a/b", playerId: "10" }, now)))?.code).toBe("invalid-argument");
    expect((await code(handleVoteMvp(db, alice, { gameId: "m1", playerId: 10 }, now)))?.code).toBe("invalid-argument");
  });
});
