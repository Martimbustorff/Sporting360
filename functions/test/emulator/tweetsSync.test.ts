import { deleteApp, getApps } from "firebase-admin/app";
import type { Firestore } from "firebase-admin/firestore";
import { syncTweets } from "../../src/social/tweetsSync";
import { twitter } from "../../src/sources/twitter";
import { clearAll, testDb } from "../helpers/emulatorDb";
import { fakeFetch } from "../helpers/fakeFetch";

let db: Firestore;
beforeAll(() => {
  db = testDb("tweets-sync-test");
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});
beforeEach(async () => {
  await clearAll(db);
});

const client = (f: ReturnType<typeof fakeFetch>) => twitter({ token: "t", fetch: f });
const ok = () => fakeFetch([[/users\/21389998\/tweets/, "twitter/user-tweets.json"], [/users\/60026862\/tweets/, { data: [], includes: {} }]]);

describe("syncTweets", () => {
  it("consulta os dois utilizadores e grava tweets/{id} com o contrato antigo", async () => {
    const f = ok();
    const r = await syncTweets({ db, tw: client(f) });
    expect(r).toEqual({ count: 2, failed: 0 });
    expect(f.calls.map((u) => /users\/(\d+)\//.exec(u)![1]).sort()).toEqual(["21389998", "60026862"]);
    const t1 = (await db.doc("tweets/1860000000000000001").get()).data()!;
    expect(t1).toEqual({
      id: "1860000000000000001",
      text: "VITÓRIA! Sporting 2-1 Benfica https://t.co/abc",
      created_at: "2026-11-22T22:35:00.000Z",
      username: "SportingCP",
      name: "Sporting Clube de Portugal",
      profile_image_url: "https://pbs.example/profile/a_normal.jpg",
      media: [{ url: "https://pbs.example/media/a.jpg", type: "photo" }],
      metrics: { retweet_count: 120, reply_count: 30, like_count: 2400, quote_count: 15, bookmark_count: 40, impression_count: 90000 },
    });
    const t2 = (await db.doc("tweets/1860000000000000002").get()).data()!;
    expect(t2.text).toBe("Dia de jogo em Alvalade. Texto completo do tweet longo, acima de 280 caracteres, sem truncatura.");
    expect(t2.media).toEqual([]);
  });

  it("media usa preview_image_url quando não há url", async () => {
    const body = {
      data: [{ id: "9", author_id: "21389998", created_at: "2026-11-22T10:00:00.000Z", text: "v", attachments: { media_keys: ["3_1"] }, public_metrics: { retweet_count: 1, reply_count: 1, like_count: 1, quote_count: 1, bookmark_count: 1, impression_count: 1 } }],
      includes: { media: [{ media_key: "3_1", type: "video", preview_image_url: "https://pbs.example/p.jpg" }], users: [{ id: "21389998", username: "SportingCP", name: "S", profile_image_url: "u" }] },
    };
    const f = fakeFetch([[/users\/21389998\//, body], [/users\/60026862\//, { data: [], includes: {} }]]);
    await syncTweets({ db, tw: client(f) });
    expect((await db.doc("tweets/9").get()).get("media")).toEqual([{ url: "https://pbs.example/p.jpg", type: "video" }]);
  });

  it("um utilizador a falhar não impede o outro", async () => {
    const f = fakeFetch([[/users\/21389998\//, { status: 500, body: "x" }], [/users\/60026862\//, "twitter/user-tweets.json"]]);
    const r = await syncTweets({ db, tw: client(f) });
    expect(r).toEqual({ count: 2, failed: 1 });
    expect((await db.collection("tweets").get()).size).toBe(2);
  });

  it("todos a falhar lança", async () => {
    const f = fakeFetch([[/tweets/, { status: 500, body: "x" }]]);
    await expect(syncTweets({ db, tw: client(f) })).rejects.toThrow();
  });

  it("sem alterações não reescreve; modo sombra usa _shadow_tweets", async () => {
    await syncTweets({ db, tw: client(ok()) });
    const before = (await db.doc("tweets/1860000000000000001").get()).updateTime!.toMillis();
    await syncTweets({ db, tw: client(ok()) });
    expect((await db.doc("tweets/1860000000000000001").get()).updateTime!.toMillis()).toBe(before);
    await syncTweets({ db, tw: client(ok()), prefix: "_shadow_" });
    expect((await db.collection("_shadow_tweets").get()).size).toBe(2);
  });
});
