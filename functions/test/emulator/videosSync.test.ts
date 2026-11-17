import { deleteApp, getApps } from "firebase-admin/app";
import type { Firestore } from "firebase-admin/firestore";
import { syncVideos, type VideosDeps } from "../../src/videos/videosSync";
import { vsports } from "../../src/sources/vsports";
import { clearAll, testDb } from "../helpers/emulatorDb";
import { fakeFetch } from "../helpers/fakeFetch";
import { seedFootballMatch } from "../helpers/seedMatch";

const HOUR = 3_600_000;
// 2026-11-17 12:07 UTC (inverno: Lisboa = UTC); jogo às 11:00 UTC = 17/11 em Lisboa.
const NOW = new Date("2026-11-17T12:00:00Z");
const NOW_M7 = new Date("2026-11-17T12:07:00Z");
const ago = (h: number, from = NOW) => new Date(from.getTime() - h * HOUR);

let db: Firestore;
beforeAll(() => {
  db = testDb("videos-sync-test");
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});
beforeEach(async () => {
  await clearAll(db);
});

const vm = (id: string, dt: string, home = "6", away = "11") => ({ id, dt, hteam: { id: home, name: "Sporting CP" }, ateam: { id: away, name: "SL Benfica" } });
const round1 = (matches: object[]) => ({ pp: "0", cp: {}, season: {}, matches });
const IFRAME = '<div><iframe src="https://x.pt/e/9001?a=1&amp;b=2"></iframe></div>';
const vdo = (id: string, type: string, embed: string, minute = "") => ({ id, dt: "2026-11-17 12:30:00", type, minute, title: `t${id}`, bigpic: `https://x.pt/p/${id}.jpg`, vdo: "", links: { video: "", embed } });
const videosBody = (vdos: object[]) => ({ pp: 0, match: { id: "55", dt: "17/11/2026", hr: "11:00", htgoal: "1", atgoal: "0", name: "x", hteam: { id: "6", name: "Sporting CP" }, ateam: { id: "11", name: "SL Benfica" } }, n_vdos: vdos.length, vdos });

const standardVdos = () => [vdo("9001", "goal", IFRAME, "12"), vdo("9002", "resume", "https://x.pt/e/9002"), vdo("9003", "flash", "https://x.pt/e/9003"), vdo("9004", "pressconf", "https://x.pt/e/9004")];

function routes(o: { rounds?: object; videos?: object } = {}) {
  return [
    [/apism\.vsports\.pt\/pesquisa-sec/, o.rounds ?? round1([vm("55", "17/11/2026")])],
    [/vdo-pesquisa-sec/, o.videos ?? videosBody(standardVdos())],
  ] as Array<[RegExp, string | object]>;
}
const deps = (f: ReturnType<typeof fakeFetch>, now: Date = NOW, prefix?: string): VideosDeps => ({ db, vs: vsports({ key: "k", fetch: f }), now: () => now, prefix });
const seed = (id: string, hoursAgo: number, over: object = {}, now = NOW) => seedFootballMatch(db, { id, kickoff: ago(hoursAgo, now), ...over } as never);

describe("syncVideos", () => {
  it("jogo há 1 h: 3 rounds + 1 vídeos; novo modelo com todos, antigo só com os 3 tipos", async () => {
    await seed("1500003", 1);
    const f = fakeFetch(routes());
    const r = await syncVideos(deps(f));
    expect(r).toEqual({ count: 4, failed: 0 });
    expect(f.calls).toHaveLength(4);
    expect(f.calls.filter((u) => /\/pesquisa-sec/.test(u) && /cp=(1|7|9)&/.test(u))).toHaveLength(3);
    expect(f.calls[3]).toMatch(/gm=55/);
    expect(f.inits[0].headers).toBeDefined();

    const nm = await db.collection("matches/1500003/videos").get();
    expect(nm.docs.map((x) => x.id).sort()).toEqual(["9001", "9002", "9003", "9004"]);
    const g = nm.docs.find((x) => x.id === "9001")!.data();
    expect(g).toMatchObject({ id: "9001", title: "t9001", minute: "12", type: "golo", thumbnail: "https://x.pt/p/9001.jpg", embedSrc: "https://x.pt/e/9001?a=1&b=2", videoUrl: IFRAME, teams: { home: "Sporting CP", away: "SL Benfica" } });
    expect(g!.publishedAt.toDate().toISOString()).toBe("2026-11-17T12:30:00.000Z");
    expect(nm.docs.find((x) => x.id === "9002")!.data()).toMatchObject({ type: "resumo", minute: null });
    expect(nm.docs.find((x) => x.id === "9004")!.data().type).toBe("outro");

    const old = await db.collection("videos").get();
    expect(old.docs.map((x) => x.id).sort()).toEqual(["9001", "9002", "9003"]);
    expect(old.docs.find((x) => x.id === "9001")!.data()).toEqual({ title: "t9001", videoUrl: IFRAME, minute: "12", GameId: "1500003", bigpicture: "https://x.pt/p/9001.jpg", id: "9001" });
  });

  it("dt da VSports em ISO também casa", async () => {
    await seed("1500003", 1);
    const f = fakeFetch(routes({ rounds: round1([vm("55", "2026-11-17")]) }));
    expect((await syncVideos(deps(f))).count).toBe(4);
  });

  it("jogo da Champions é ignorado", async () => {
    await seed("1500003", 1, { competition: { key: "ucl", id: "2", name: "Champions League", type: "cup", season: "2026", round: null, roundLabel: null } });
    const f = fakeFetch(routes());
    expect(await syncVideos(deps(f))).toEqual({ count: 0, failed: 0 });
    expect(f.calls).toHaveLength(0);
  });

  it("nenhum jogo nas 48 h: 0 chamadas", async () => {
    await seed("1500003", 60);
    await seed("1500004", -2);
    const f = fakeFetch(routes());
    expect(await syncVideos(deps(f))).toEqual({ count: 0, failed: 0 });
    expect(f.calls).toHaveLength(0);
  });

  it("jogo há 10 h: no minuto 7 não chama; no minuto 0 chama", async () => {
    await seed("1500003", 10, {}, NOW_M7);
    const f = fakeFetch(routes());
    await syncVideos(deps(f, NOW_M7));
    expect(f.calls).toHaveLength(0);
    await seed("1500003", 10);
    const f2 = fakeFetch(routes());
    await syncVideos(deps(f2, NOW));
    expect(f2.calls).toHaveLength(4);
  });

  it("legado: jogo com id abaixo de 1210619 só escreve o novo modelo", async () => {
    await seed("1210000", 1);
    await syncVideos(deps(fakeFetch(routes())));
    expect((await db.collection("matches/1210000/videos").get()).size).toBe(4);
    expect((await db.collection("videos").get()).size).toBe(0);
  });

  it("vídeo sem embed https: não entra no novo modelo, entra no antigo (como o legado)", async () => {
    await seed("1500003", 1);
    const f = fakeFetch(routes({ videos: videosBody([vdo("9001", "goal", "http://x.pt/e/1"), vdo("9002", "goal", "<div></div>"), vdo("9003", "goal", "https://x.pt/e/3")]) }));
    const r = await syncVideos(deps(f));
    expect(r.count).toBe(1);
    expect((await db.collection("matches/1500003/videos").get()).docs.map((x) => x.id)).toEqual(["9003"]);
    expect((await db.collection("videos").get()).size).toBe(3);
  });

  it("modo sombra: o antigo vai para _shadow_videos", async () => {
    await seed("1500003", 1);
    await syncVideos(deps(fakeFetch(routes()), NOW, "_shadow_"));
    expect((await db.collection("_shadow_videos").get()).size).toBe(3);
    expect((await db.collection("videos").get()).size).toBe(0);
    expect((await db.collection("matches/1500003/videos").get()).size).toBe(4);
  });

  it("resposta igual: segunda execução escreve 0 documentos", async () => {
    await seed("1500003", 1);
    await syncVideos(deps(fakeFetch(routes())));
    const before = (await db.doc("matches/1500003/videos/9001").get()).updateTime!.toMillis();
    const oldBefore = (await db.doc("videos/9001").get()).updateTime!.toMillis();
    await new Promise((r) => setTimeout(r, 20));
    await syncVideos(deps(fakeFetch(routes())));
    expect((await db.doc("matches/1500003/videos/9001").get()).updateTime!.toMillis()).toBe(before);
    expect((await db.doc("videos/9001").get()).updateTime!.toMillis()).toBe(oldBefore);
  });

  it("um round que falha não descarta os outros; falha contada", async () => {
    await seed("1500003", 1);
    const f = fakeFetch([
      [/cp=1&/, { status: 500, body: "boom" }],
      [/cp=7&/, round1([vm("55", "17/11/2026")])],
      [/cp=9&/, round1([])],
      [/vdo-pesquisa-sec/, videosBody(standardVdos())],
    ]);
    const r = await syncVideos(deps(f));
    expect(r.count).toBe(4);
    expect(r.failed).toBe(1);
    expect((await db.collection("matches/1500003/videos").get()).size).toBe(4);
  });

  it("todos os rounds falham: lança", async () => {
    await seed("1500003", 1);
    const f = fakeFetch([[/apism\.vsports\.pt\/pesquisa-sec/, { status: 500, body: "boom" }]]);
    await expect(syncVideos(deps(f))).rejects.toThrow(/rounds falharam/);
  });

  it("vídeos do jogo falham: conta failed e não escreve", async () => {
    await seed("1500003", 1);
    const f = fakeFetch([
      [/apism\.vsports\.pt\/pesquisa-sec/, round1([vm("55", "17/11/2026")])],
      [/vdo-pesquisa-sec/, { status: 500, body: "boom" }],
    ]);
    expect(await syncVideos(deps(f))).toEqual({ count: 0, failed: 1 });
  });

  it("jogo da VSports sem o Sporting ou de outro dia é ignorado", async () => {
    await seed("1500003", 1);
    const f = fakeFetch(routes({ rounds: round1([vm("56", "17/11/2026", "10", "11"), vm("57", "16/11/2026")]) }));
    expect((await syncVideos(deps(f))).count).toBe(0);
    expect(f.calls).toHaveLength(3);
  });
});
