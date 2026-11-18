import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, runTransaction, increment, deleteField,
} from "firebase/firestore";

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
  it.each(["pointEvents/x", "leaderboards/a", "leaderboards/a/entries/b", "settlements/x", "mvpVotes/x", "matchPredictions/x"])(
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
  it("anonymous can read users/alice (phase 1, closes in Plan 5)", async () => {
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
    "competitions/football_94_2026/data/bracket", "teams/football_228", "teams/football_228/data/squad",
    "venues/1", "config/app",
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
