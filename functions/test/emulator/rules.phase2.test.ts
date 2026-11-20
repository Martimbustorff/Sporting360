// Regras da FASE 2 (firestore.rules): a V2 da loja continua a funcionar e a app nova também.
// As regras finais (firestore.final.rules) têm os seus testes em rules.final.test.ts.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection, doc, getDoc, getDocs, query, setDoc, updateDoc, deleteDoc, runTransaction, increment, deleteField,
  serverTimestamp, where, collectionGroup,
} from "firebase/firestore";
import { NEW_APP_OPS, V2_OPS } from "../helpers/rulesOps";

let env: RulesTestEnvironment;

const anon = () => env.unauthenticatedContext().firestore();
const as = (uid: string) => env.authenticatedContext(uid).firestore();

async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-scp360",
    firestore: { rules: readFileSync(resolve(__dirname, "../../../firestore.rules"), "utf8") },
  });
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
});

describe("public-read data collections", () => {
  const cols = [
    "games", "news", "players", "standings", "videos", "lineups", "summaries",
    "stastistics", "manofmatch", "tweets", "predictions",
  ];
  it.each(cols)("anonymous can read %s/x", async (c) => {
    await assertSucceeds(getDoc(doc(anon(), `${c}/x`)));
  });
  it.each(["games", "news", "players", "standings", "videos", "lineups", "summaries", "stastistics", "tweets"])(
    "authenticated cannot write %s/x",
    async (c) => {
      await assertFails(setDoc(doc(as("alice"), `${c}/x`), { a: 1 }));
    },
  );
  it("authenticated cannot update or delete an existing games/x", async () => {
    await seed("games/x", { a: 1 });
    await assertFails(updateDoc(doc(as("alice"), "games/x"), { a: 2 }));
    await assertFails(deleteDoc(doc(as("alice"), "games/x")));
  });
});

describe("backend-owned collections", () => {
  it.each(["leaderboards/a", "leaderboards/a/entries/b", "settlements/x"])(
    "anonymous can read %s",
    async (p) => {
      await assertSucceeds(getDoc(doc(anon(), p)));
    },
  );
  it.each(["pointEvents/x", "leaderboards/a", "leaderboards/a/entries/b", "settlements/x", "mvpVotes/x", "matchPredictions/x"])(
    "authenticated cannot write %s",
    async (p) => {
      await assertFails(setDoc(doc(as("alice"), p), { a: 1 }));
    },
  );
  it("authenticated cannot update or delete leaderboards entries", async () => {
    await seed("leaderboards/a/entries/b", { a: 1 });
    await assertFails(updateDoc(doc(as("alice"), "leaderboards/a/entries/b"), { a: 2 }));
    await assertFails(deleteDoc(doc(as("alice"), "leaderboards/a/entries/b")));
  });
});

// Fase 2: só o dono lê. A V2 não lê estas coleções; a app nova só lê os do próprio.
// `byIdWhenMissing`: a app lê o próprio doc por id ({gameId}_{uid}) antes de ele existir (jogo sem palpite ou voto).
describe.each([
  ["matchPredictions", "userId", true],
  ["mvpVotes", "userId", true],
  ["pointEvents", "uid", false],
] as const)("%s: owner-only read", (col, field, byIdWhenMissing) => {
  const own = `${col}/m1_alice`;
  const data = { [field]: "alice", gameId: "m1" };
  it("owner reads their own doc", async () => {
    await seed(own, data);
    await assertSucceeds(getDoc(doc(as("alice"), own)));
  });
  it("bob and anonymous cannot read alice's doc", async () => {
    await seed(own, data);
    await assertFails(getDoc(doc(as("bob"), own)));
    await assertFails(getDoc(doc(anon(), own)));
  });
  it(`query where('${field}','==','alice') as alice passes; as bob or anonymous it fails`, async () => {
    await seed(own, data);
    await assertSucceeds(getDocs(query(collection(as("alice"), col), where(field, "==", "alice"))));
    await assertFails(getDocs(query(collection(as("bob"), col), where(field, "==", "alice"))));
    await assertFails(getDocs(query(collection(anon(), col), where(field, "==", "alice"))));
  });
  it("query without the owner filter fails", async () => {
    await seed(own, data);
    await assertFails(getDocs(collection(as("alice"), col)));
  });
  it("a missing doc: owner gets it as missing (only by {gameId}_{uid}), bob cannot probe it", async () => {
    if (byIdWhenMissing) await assertSucceeds(getDoc(doc(as("alice"), `${col}/m9_alice`)));
    else await assertFails(getDoc(doc(as("alice"), `${col}/m9_alice`)));
    await assertFails(getDoc(doc(as("bob"), `${col}/m9_alice`)));
    await assertFails(getDoc(doc(anon(), `${col}/m9_alice`)));
  });
  it("nobody can write, not even the owner", async () => {
    await assertFails(setDoc(doc(as("alice"), own), data));
    await seed(own, data);
    await assertFails(updateDoc(doc(as("alice"), own), { x: 1 }));
    await assertFails(deleteDoc(doc(as("alice"), own)));
  });
});

describe("mvpTallies", () => {
  it("anonymous can read mvpTallies/g1", async () => {
    await seed("mvpTallies/g1", { gameId: "g1", counts: { p10: 1 }, total: 1 });
    await assertSucceeds(getDoc(doc(anon(), "mvpTallies/g1")));
  });
  it("authenticated cannot create, update or delete mvpTallies/g1", async () => {
    await assertFails(setDoc(doc(as("alice"), "mvpTallies/g2"), { gameId: "g2", counts: {}, total: 0 }));
    await seed("mvpTallies/g1", { gameId: "g1", counts: { p10: 1 }, total: 1 });
    await assertFails(updateDoc(doc(as("alice"), "mvpTallies/g1"), { total: increment(1) }));
    await assertFails(deleteDoc(doc(as("alice"), "mvpTallies/g1")));
    await assertFails(setDoc(doc(anon(), "mvpTallies/g3"), { total: 1 }));
  });
  it("shards: no client read or write (anonymous or authenticated)", async () => {
    await seed("mvpTallies/g1/shards/3", { gameId: "g1", counts: { p10: 1 }, total: 1 });
    await assertFails(getDoc(doc(anon(), "mvpTallies/g1/shards/3")));
    await assertFails(getDoc(doc(as("alice"), "mvpTallies/g1/shards/3")));
    await assertFails(setDoc(doc(as("alice"), "mvpTallies/g1/shards/4"), { total: 1 }));
    await assertFails(updateDoc(doc(as("alice"), "mvpTallies/g1/shards/3"), { total: increment(1) }));
    await assertFails(deleteDoc(doc(as("alice"), "mvpTallies/g1/shards/3")));
    await assertFails(setDoc(doc(anon(), "mvpTallies/g1/shards/5"), { total: 1 }));
  });
});

describe("predictionTallies", () => {
  it("anonymous can read predictionTallies/g1", async () => {
    await seed("predictionTallies/g1", { gameId: "g1", total: 3 });
    await assertSucceeds(getDoc(doc(anon(), "predictionTallies/g1")));
  });
  it("nobody can write predictionTallies/g1", async () => {
    await assertFails(setDoc(doc(as("alice"), "predictionTallies/g2"), { total: 1 }));
    await seed("predictionTallies/g1", { gameId: "g1", total: 3 });
    await assertFails(updateDoc(doc(as("alice"), "predictionTallies/g1"), { total: increment(1) }));
    await assertFails(deleteDoc(doc(as("alice"), "predictionTallies/g1")));
  });
  it("private/split: no client read or write before or after kickoff", async () => {
    await seed("predictionTallies/g1/private/split", { home: 2, draw: 1 });
    await assertFails(getDoc(doc(anon(), "predictionTallies/g1/private/split")));
    await assertFails(getDoc(doc(as("alice"), "predictionTallies/g1/private/split")));
    await assertFails(setDoc(doc(as("alice"), "predictionTallies/g1/private/split"), { home: 9 }));
  });
});

describe("publicProfiles", () => {
  it("anonymous can read publicProfiles/u1", async () => {
    await assertSucceeds(getDoc(doc(anon(), "publicProfiles/u1")));
  });
  it("nobody can write publicProfiles, not even the owner", async () => {
    await assertFails(setDoc(doc(as("u1"), "publicProfiles/u1"), { displayName: "X" }));
    await assertFails(setDoc(doc(anon(), "publicProfiles/u1"), { displayName: "X" }));
    await seed("publicProfiles/u1", { displayName: "Y" });
    await assertFails(updateDoc(doc(as("u1"), "publicProfiles/u1"), { displayName: "X" }));
    await assertFails(deleteDoc(doc(as("u1"), "publicProfiles/u1")));
  });
});

describe("users displayName is server-only", () => {
  it("owner cannot create users/alice with displayName", async () => {
    await assertFails(setDoc(doc(as("alice"), "users/alice"), { name: "A", displayName: "Leão 77" }));
    await assertSucceeds(setDoc(doc(as("alice"), "users/alice"), { name: "A", email: "a@x.pt" }));
  });
  it("owner cannot update displayName but can update other fields (V2 compatible)", async () => {
    await seed("users/alice", { name: "A" });
    await assertFails(updateDoc(doc(as("alice"), "users/alice"), { displayName: "Leão 77" }));
    await assertSucceeds(updateDoc(doc(as("alice"), "users/alice"), { name: "B" }));
  });
  it("owner cannot write nameChangedAt (cooldown is server-only)", async () => {
    await assertFails(setDoc(doc(as("alice"), "users/alice"), { name: "A", nameChangedAt: 1 }));
    await seed("users/alice", { name: "A" });
    await assertFails(updateDoc(doc(as("alice"), "users/alice"), { nameChangedAt: 1 }));
  });
  it("owner can still update other fields when the server already set displayName", async () => {
    await seed("users/alice", { name: "A", displayName: "Leão 77" });
    await assertSucceeds(updateDoc(doc(as("alice"), "users/alice"), { name: "B" }));
    await assertFails(updateDoc(doc(as("alice"), "users/alice"), { displayName: "Outro" }));
    await assertFails(updateDoc(doc(as("alice"), "users/alice"), { displayName: deleteField() }));
  });
});

describe("users", () => {
  it("anonymous can read users/alice (phase 2, V2 PIN login; closes at launch)", async () => {
    await assertSucceeds(getDoc(doc(anon(), "users/alice")));
  });
  it("owner can create users/alice; others and anonymous cannot", async () => {
    await assertFails(setDoc(doc(as("bob"), "users/alice"), { n: 1 }));
    await assertFails(setDoc(doc(anon(), "users/alice"), { n: 1 }));
    await assertSucceeds(setDoc(doc(as("alice"), "users/alice"), { n: 1 }));
  });
  it("update by bob denied, by alice allowed", async () => {
    await seed("users/alice", { n: 1 });
    await assertFails(updateDoc(doc(as("bob"), "users/alice"), { n: 2 }));
    await assertSucceeds(updateDoc(doc(as("alice"), "users/alice"), { n: 2 }));
  });
  it("delete by bob denied, by alice allowed", async () => {
    await seed("users/alice", { n: 1 });
    await assertFails(deleteDoc(doc(as("bob"), "users/alice")));
    await assertSucceeds(deleteDoc(doc(as("alice"), "users/alice")));
  });
});

describe("gamebox", () => {
  it("anonymous can read", async () => {
    await assertSucceeds(getDoc(doc(anon(), "gamebox/g1")));
  });
  it("create: alice with userid alice ok; bob with userid alice denied; anonymous denied", async () => {
    await assertFails(setDoc(doc(as("bob"), "gamebox/g1"), { userid: "alice" }));
    await assertFails(setDoc(doc(anon(), "gamebox/g1"), { userid: "alice" }));
    await assertSucceeds(setDoc(doc(as("alice"), "gamebox/g1"), { userid: "alice" }));
  });
  it("update: alice ok, bob denied, changing userid denied", async () => {
    await seed("gamebox/g1", { userid: "alice", v: 1 });
    await assertFails(updateDoc(doc(as("bob"), "gamebox/g1"), { v: 2 }));
    await assertFails(updateDoc(doc(as("alice"), "gamebox/g1"), { userid: "bob" }));
    await assertSucceeds(updateDoc(doc(as("alice"), "gamebox/g1"), { v: 2 }));
  });
  it("delete: bob denied, alice ok", async () => {
    await seed("gamebox/g1", { userid: "alice" });
    await assertFails(deleteDoc(doc(as("bob"), "gamebox/g1")));
    await assertSucceeds(deleteDoc(doc(as("alice"), "gamebox/g1")));
  });
});

describe.each(["predictions", "manofmatch"])("%s", (col) => {
  it("create by alice with userId alice on m1_alice ok", async () => {
    await assertSucceeds(setDoc(doc(as("alice"), `${col}/m1_alice`), { userId: "alice" }));
  });
  it("create with a source field denied (reserved for the v2027 callables)", async () => {
    await assertFails(setDoc(doc(as("alice"), `${col}/m1_alice`), { userId: "alice", source: "v2027" }));
    await assertFails(setDoc(doc(as("alice"), `${col}/m1_alice`), { userId: "alice", source: "x" }));
  });
  it("V2-shaped create (no source) still ok", async () => {
    const v2 = col === "predictions"
      ? { gameId: "m1", userId: "alice", userName: "A", scorehome: "1", scoreaway: "0", scored: false, season: "2026-2027" }
      : { GameId: "m1", playerId: "10", userId: "alice", season: "2026-2027", id: "m1_alice" };
    await assertSucceeds(setDoc(doc(as("alice"), `${col}/m1_alice`), v2));
  });
  it("create with userId bob denied", async () => {
    await assertFails(setDoc(doc(as("alice"), `${col}/m1_alice`), { userId: "bob" }));
  });
  it("create with doc id not ending in _alice denied", async () => {
    await assertFails(setDoc(doc(as("alice"), `${col}/m1_bob`), { userId: "alice" }));
  });
  it("create by anonymous denied", async () => {
    await assertFails(setDoc(doc(anon(), `${col}/m1_alice`), { userId: "alice" }));
  });
  it("update and delete by alice denied", async () => {
    await seed(`${col}/m1_alice`, { userId: "alice" });
    await assertFails(updateDoc(doc(as("alice"), `${col}/m1_alice`), { x: 1 }));
    await assertFails(deleteDoc(doc(as("alice"), `${col}/m1_alice`)));
  });
});

describe("rankings", () => {
  const S = "2026-2027";
  const path = `rankings/alice_${S}`;
  const row = (over: Record<string, unknown> = {}) => ({
    userId: "alice", userName: "Alice", season: S, points: 1, ...over,
  });
  it("create by alice with points 1 ok (with extra fields)", async () => {
    await assertSucceeds(setDoc(doc(as("alice"), path), row()));
  });
  it("create with points other than 1 denied", async () => {
    await assertFails(setDoc(doc(as("alice"), path), row({ points: 50 })));
  });
  it("create with wrong userId denied", async () => {
    await assertFails(setDoc(doc(as("alice"), path), row({ userId: "bob" })));
  });
  it("create on another user's doc id denied", async () => {
    await assertFails(setDoc(doc(as("alice"), `rankings/bob_${S}`), row()));
    await assertFails(setDoc(doc(as("bob"), path), row()));
  });
  it("create with doc id not matching uid_season denied (fake leaderboard row)", async () => {
    await assertFails(setDoc(doc(as("alice"), "rankings/alice_x"), row({ userName: "Bob" })));
    await assertFails(setDoc(doc(as("alice"), "rankings/alice_2025-2026"), row()));
  });
  it("create with missing or malformed season denied", async () => {
    const { season: _s, ...noSeason } = row();
    await assertFails(setDoc(doc(as("alice"), "rankings/alice_"), noSeason));
    await assertFails(setDoc(doc(as("alice"), "rankings/alice_x"), row({ season: "x" })));
  });
  it("update points 5 -> 6 ok; 5 -> 9 denied; 5 -> 5 denied; by bob denied", async () => {
    await seed(path, row({ points: 5 }));
    await assertFails(updateDoc(doc(as("alice"), path), { points: 9 }));
    await assertFails(updateDoc(doc(as("alice"), path), { points: 5 }));
    await assertFails(updateDoc(doc(as("bob"), path), { points: 6 }));
    await assertSucceeds(updateDoc(doc(as("alice"), path), { points: 6 }));
  });
  it("update cannot change userId or season", async () => {
    await seed(path, row({ points: 5 }));
    await assertFails(updateDoc(doc(as("alice"), path), { points: 6, userId: "bob" }));
    await assertFails(updateDoc(doc(as("alice"), path), { points: 6, season: "2027-2028" }));
  });
  it("update denied when stored userId is not the caller", async () => {
    await seed(path, row({ userId: "bob", points: 5 }));
    await assertFails(updateDoc(doc(as("alice"), path), { points: 6 }));
  });
  it("delete denied", async () => {
    await seed(path, row({ points: 5 }));
    await assertFails(deleteDoc(doc(as("alice"), path)));
  });
  it("anonymous can read", async () => {
    await assertSucceeds(getDoc(doc(anon(), path)));
  });

  // Real V2 write: runTransaction(get prediction -> set prediction -> merge-set ranking +1).
  const v2Write = (uid: string, inc: number) => {
    const db = as(uid);
    const pRef = doc(db, `predictions/m1_${uid}`);
    const rRef = doc(db, `rankings/${uid}_${S}`);
    return runTransaction(db, async (tx) => {
      await tx.get(pRef);
      tx.set(pRef, { userId: uid, gameId: "m1" });
      tx.set(
        rRef,
        { points: increment(inc), userId: uid, userName: "Alice", season: S },
        { merge: true },
      );
    });
  };
  it("V2 transaction: create path (no ranking doc yet) succeeds", async () => {
    await assertSucceeds(v2Write("alice", 1));
  });
  it("V2 transaction: update path (existing ranking) succeeds", async () => {
    await seed(path, row({ points: 5 }));
    await assertSucceeds(v2Write("alice", 1));
  });
  it("V2 transaction with increment(2) denied (create and update)", async () => {
    await assertFails(v2Write("alice", 2));
    await seed(path, row({ points: 5 }));
    await assertFails(v2Write("alice", 2));
  });
});

describe("unlisted collections", () => {
  it("read and write denied on foo/x", async () => {
    await assertFails(getDoc(doc(as("alice"), "foo/x")));
    await assertFails(getDoc(doc(anon(), "foo/x")));
    await assertFails(setDoc(doc(as("alice"), "foo/x"), { a: 1 }));
  });
});

describe("new data model (Plan 2)", () => {
  const readable = [
    "matches/1001", "matches/1001/details/events", "matches/1001/videos/v1",
    "competitions/football_94_2026", "competitions/football_94_2026/data/standings",
    "competitions/football_94_2026/data/bracket", "competitions/football_94_2026/data/liveFixtures", "teams/football_228", "teams/football_228/data/squad",
    "venues/1", "config/app", "config/tvChannels",
  ];
  it.each(readable)("anonymous can read %s", async (p) => {
    await assertSucceeds(getDoc(doc(anon(), p)));
  });
  it.each(readable)("authenticated cannot create %s", async (p) => {
    await assertFails(setDoc(doc(as("alice"), p), { a: 1 }));
  });
  it.each(readable)("authenticated cannot update or delete %s", async (p) => {
    await seed(p, { a: 1 });
    await assertFails(updateDoc(doc(as("alice"), p), { a: 2 }));
    await assertFails(deleteDoc(doc(as("alice"), p)));
  });
  it.each(readable)("anonymous cannot write %s", async (p) => {
    await assertFails(setDoc(doc(anon(), p), { a: 1 }));
  });
  it.each(["ingestHealth/x", "ingestState/x", "ingestState/match_1", "_shadow_games/x", "_shadow_news/x", "point_events/x"])(
    "%s: no read, no write",
    async (p) => {
      await assertFails(getDoc(doc(anon(), p)));
      await assertFails(getDoc(doc(as("alice"), p)));
      await assertFails(setDoc(doc(as("alice"), p), { a: 1 }));
    },
  );
});

// Operações reais das duas apps (functions/test/helpers/rulesOps.ts): têm de passar todas na fase 2.
describe.each(V2_OPS)("V2: $name", (op) => {
  it("allowed", async () => {
    await assertSucceeds(op.run(env));
  });
});
describe.each(NEW_APP_OPS)("app nova: $name", (op) => {
  it("allowed", async () => {
    await assertSucceeds(op.run(env));
  });
});

describe("users/{uid}/devices", () => {
  const DEV = "users/alice/devices/tok-1";
  const dev = { token: "tok-1", platform: "ios", updatedAt: serverTimestamp() };

  it("o dono cria, lê, lista e apaga o seu dispositivo", async () => {
    await assertSucceeds(setDoc(doc(as("alice"), DEV), dev, { merge: true }));
    await assertSucceeds(setDoc(doc(as("alice"), DEV), { ...dev, platform: "android" }, { merge: true }));
    await assertSucceeds(getDoc(doc(as("alice"), DEV)));
    await assertSucceeds(getDocs(collection(as("alice"), "users/alice/devices")));
    await assertSucceeds(deleteDoc(doc(as("alice"), DEV)));
  });

  it("bob e anónimo não leem nem listam os dispositivos da alice (mesmo com users público na fase 2)", async () => {
    await seed(DEV, { token: "tok-1", platform: "ios" });
    await assertFails(getDoc(doc(as("bob"), DEV)));
    await assertFails(getDoc(doc(anon(), DEV)));
    await assertFails(getDocs(collection(as("bob"), "users/alice/devices")));
    await assertFails(getDocs(collection(anon(), "users/alice/devices")));
  });

  it("bob não escreve nem apaga o dispositivo da alice", async () => {
    await assertFails(setDoc(doc(as("bob"), DEV), dev));
    await assertFails(setDoc(doc(anon(), DEV), dev));
    await seed(DEV, { token: "tok-1", platform: "ios" });
    await assertFails(setDoc(doc(as("bob"), DEV), dev, { merge: true }));
    await assertFails(deleteDoc(doc(as("bob"), DEV)));
  });

  it("campos a mais, token diferente do id ou platform 'web': negado", async () => {
    await assertFails(setDoc(doc(as("alice"), DEV), { ...dev, email: "alice@example.pt" }));
    await assertFails(setDoc(doc(as("alice"), DEV), { ...dev, uid: "alice" }));
    await assertFails(setDoc(doc(as("alice"), DEV), { ...dev, token: "tok-2" }));
    await assertFails(setDoc(doc(as("alice"), DEV), { ...dev, platform: "web" }));
    await assertFails(setDoc(doc(as("alice"), "users/alice/devices/outro"), dev));
  });

  it("updatedAt tem de ser a hora do servidor", async () => {
    await assertFails(setDoc(doc(as("alice"), DEV), { ...dev, updatedAt: new Date("2020-01-01T00:00:00Z") }));
    await assertFails(setDoc(doc(as("alice"), DEV), { token: "tok-1", platform: "ios" }));
    await assertSucceeds(setDoc(doc(as("alice"), DEV), dev));
  });
});

describe("loans (empréstimo de GameBox)", () => {
  const L = "loans/L1";
  const S = "loans/L1/secret/number";
  const hora = 3600 * 1000;
  const loan = (extra: Record<string, unknown> = {}) => ({
    ownerUid: "alice", ownerName: "Alice", gameboxId: "g1", matchId: "m1", sport: "football",
    match: { homeName: "Sporting", awayName: "Benfica", homeLogo: null, awayLogo: null, competition: "Liga", kickoff: new Date(Date.now() + hora), venue: "stadium" },
    seat: { gate: "1", sector: "A", row: "2", seat: "3" },
    createdAt: new Date(), expiresAt: new Date(Date.now() + 4 * hora),
    recipientUid: "bob", recipientName: "Bob", openedAt: null, cancelledAt: null,
    ...extra,
  });
  const seedLoan = async (extra: Record<string, unknown> = {}) => {
    await seed(L, loan(extra));
    await seed(S, { number: "123456" });
  };

  it("o cliente não cria, altera nem apaga empréstimos nem segredos", async () => {
    await assertFails(setDoc(doc(as("alice"), L), loan()));
    await assertFails(setDoc(doc(as("alice"), S), { number: "1" }));
    await seedLoan();
    await assertFails(updateDoc(doc(as("alice"), L), { cancelledAt: new Date() }));
    await assertFails(updateDoc(doc(as("bob"), L), { openedAt: new Date() }));
    await assertFails(deleteDoc(doc(as("alice"), L)));
    await assertFails(updateDoc(doc(as("bob"), S), { number: "9" }));
    await assertFails(deleteDoc(doc(as("bob"), S)));
  });

  it("o dono e o destinatário leem o empréstimo; outra conta e anónimo não", async () => {
    await seedLoan();
    await assertSucceeds(getDoc(doc(as("alice"), L)));
    await assertSucceeds(getDoc(doc(as("bob"), L)));
    await assertFails(getDoc(doc(as("carol"), L)));
    await assertFails(getDoc(doc(anon(), L)));
  });

  it("o destinatário preso lê o segredo com o empréstimo ativo", async () => {
    await seedLoan();
    await assertSucceeds(getDoc(doc(as("bob"), S)));
  });

  it("o destinatário não lê o segredo com cancelledAt ou expiresAt no passado", async () => {
    await seedLoan({ cancelledAt: new Date() });
    await assertFails(getDoc(doc(as("bob"), S)));
    await seedLoan({ expiresAt: new Date(Date.now() - hora) });
    await assertFails(getDoc(doc(as("bob"), S)));
  });

  it("dono, outra conta e anónimo não leem o segredo; empréstimo sem destinatário também não", async () => {
    await seedLoan();
    await assertFails(getDoc(doc(as("alice"), S)));
    await assertFails(getDoc(doc(as("carol"), S)));
    await assertFails(getDoc(doc(anon(), S)));
    await seedLoan({ recipientUid: null, recipientName: null });
    await assertFails(getDoc(doc(as("bob"), S)));
  });

  it("consultas where ownerUid == eu e where recipientUid == eu são permitidas", async () => {
    await seedLoan();
    await assertSucceeds(getDocs(query(collection(as("alice"), "loans"), where("ownerUid", "==", "alice"))));
    await assertSucceeds(getDocs(query(collection(as("bob"), "loans"), where("recipientUid", "==", "bob"))));
    await assertFails(getDocs(query(collection(as("bob"), "loans"), where("ownerUid", "==", "alice"))));
    await assertFails(getDocs(collection(as("alice"), "loans")));
  });
  it("segredo sem empréstimo-mãe e consulta de grupo em secret: negados", async () => {
    await seed(S, { number: "123456" });
    await assertFails(getDoc(doc(as("bob"), S)));
    await seedLoan();
    await assertFails(getDocs(collectionGroup(as("bob"), "secret")));
  });
});
