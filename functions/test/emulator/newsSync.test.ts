import { deleteApp, getApps } from "firebase-admin/app";
import type { Firestore } from "firebase-admin/firestore";
import { NEWS_SOURCES, syncNews } from "../../src/news/newsSync";
import { clearAll, testDb } from "../helpers/emulatorDb";
import { fakeFetch } from "../helpers/fakeFetch";

const NOW = new Date("2026-11-23T12:00:00Z");
let db: Firestore;
beforeAll(() => {
  db = testDb("news-sync-test");
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});
beforeEach(async () => {
  await clearAll(db);
});

const ok = () =>
  fakeFetch([
    [/maisfutebol\.iol\.pt\/rss/, "rss/maisfutebol.xml"],
    [/record\.pt\/rss/, "rss/record.xml"],
  ]);
const deps = (f: ReturnType<typeof fakeFetch>, prefix?: string) => ({ db, fetch: f, now: () => NOW, prefix });

describe("syncNews", () => {
  it("fontes", () => {
    expect(NEWS_SOURCES.map((s) => s.name)).toEqual(["Maisfutebol", "Record"]);
  });

  it("grava news/{slug} com o contrato antigo + sport + publishedAt", async () => {
    const r = await syncNews(deps(ok()));
    expect(r).toEqual({ count: 3, failed: 0 });
    const snap = await db.collection("news").get();
    expect(snap.size).toBe(3);
    const d = (await db.doc("news/www-record-pt-futebol-sporting-exemplo-1").get()).data()!;
    expect(d).toMatchObject({
      id: "www-record-pt-futebol-sporting-exemplo-1",
      title: "Sporting vence o dérbi em Alvalade",
      source: "Record",
      url: "https://www.record.pt/futebol/sporting/exemplo-1",
      created_at: "2026-11-22T22:40:00.000Z",
      sport: "football",
    });
    expect(d.content).toBe(d.summary);
    expect(d.publishedAt.toDate().toISOString()).toBe("2026-11-22T22:40:00.000Z");
    expect(d).toHaveProperty("image");
    expect(d).not.toHaveProperty("updatedAt");
    const mf = (await db.doc("news/maisfutebol-iol-pt-sporting-exemplo-3").get()).data()!;
    expect(mf).toMatchObject({ source: "Maisfutebol", image: "https://cdn.iol.pt/img/exemplo-3.jpg" });
  });

  it("a mesma notícia duas vezes não duplica nem reescreve", async () => {
    await syncNews(deps(ok()));
    const f = ok();
    const r = await syncNews(deps(f));
    expect(r.count).toBe(3);
    expect((await db.collection("news").get()).size).toBe(3);
    const st = (await db.doc("ingestState/news_Record").get()).get("hashes");
    expect(Object.keys(st)).toHaveLength(2);
    // sem alterações: nada é reescrito (o doc não muda)
    const before = (await db.doc("news/www-record-pt-futebol-sporting-exemplo-1").get()).updateTime!.toMillis();
    await syncNews(deps(ok()));
    const after = (await db.doc("news/www-record-pt-futebol-sporting-exemplo-1").get()).updateTime!.toMillis();
    expect(after).toBe(before);
  });

  it("merge preserva campos extra do documento", async () => {
    await db.doc("news/maisfutebol-iol-pt-sporting-exemplo-3").set({ extra: 1 });
    await syncNews(deps(ok()));
    expect((await db.doc("news/maisfutebol-iol-pt-sporting-exemplo-3").get()).get("extra")).toBe(1);
  });

  it("Record a dar 500: o Maisfutebol grava na mesma e a saúde regista o erro", async () => {
    const f = fakeFetch([
      [/maisfutebol\.iol\.pt\/rss/, "rss/maisfutebol.xml"],
      [/record\.pt\/rss/, { status: 500, body: "boom" }],
    ]);
    const r = await syncNews(deps(f));
    expect(r).toEqual({ count: 1, failed: 1 });
    expect((await db.collection("news").get()).size).toBe(1);
    const rec = (await db.doc("ingestHealth/news_Record").get()).data()!;
    expect(rec.lastError).toEqual(expect.any(String));
    expect(rec.consecutiveFailures).toBe(1);
    expect((await db.doc("ingestHealth/news_Maisfutebol").get()).get("lastError")).toBeNull();
  });

  it("todas as fontes a falhar lança", async () => {
    const f = fakeFetch([[/rss/, { status: 500, body: "x" }]]);
    await expect(syncNews(deps(f))).rejects.toThrow();
  });

  it("modo sombra: escreve em _shadow_news", async () => {
    await syncNews(deps(ok(), "_shadow_"));
    expect((await db.collection("_shadow_news").get()).size).toBe(3);
    expect((await db.collection("news").get()).size).toBe(0);
  });
});
