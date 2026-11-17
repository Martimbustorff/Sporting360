import * as fs from "fs";
import * as path from "path";
import { deleteApp, getApps } from "firebase-admin/app";
import type { Firestore } from "firebase-admin/firestore";
import { SPORTING_CREST_URL } from "../../src/config/brand";
import type { FootballDeps } from "../../src/football/fixturesSync";
import { mapFixture } from "../../src/football/mapFixture";
import { syncPrematch } from "../../src/football/prematchSync";
import { apiFootball } from "../../src/sources/apiFootball";
import { saveMatch } from "../../src/store/writer";
import { clearAll, testDb } from "../helpers/emulatorDb";
import { fakeFetch } from "../helpers/fakeFetch";
import { seedFootballMatch } from "../helpers/seedMatch";

const FIX = path.join(__dirname, "..", "fixtures", "api-football");
const load = (n: string) => JSON.parse(fs.readFileSync(path.join(FIX, n), "utf8"));
const NOW = new Date("2026-11-17T12:00:00Z");
const HOUR = 3_600_000;

let db: Firestore;
beforeAll(() => {
  db = testDb("prematch-sync-test");
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});
beforeEach(async () => {
  await clearAll(db);
  jest.restoreAllMocks();
});

let clock = NOW;
const deps = (f: ReturnType<typeof fakeFetch>): FootballDeps => ({ db, api: apiFootball({ key: "k", fetch: f }), now: () => clock });
const envelope = (response: unknown, extra: Record<string, unknown> = {}) => ({ get: "x", parameters: {}, errors: [], results: 0, paging: { current: 1, total: 1 }, response, ...extra });
const routes = () =>
  [
    [/predictions/, "api-football/predictions.json"],
    [/injuries/, "api-football/injuries-fixture.json"],
    [/venues/, "api-football/venue.json"],
  ] as Array<[RegExp, string | object]>;
const kick = (h: number) => new Date(NOW.getTime() + h * HOUR);
const seedNs = (id: string, hours: number, venue: object | null = { id: "1", name: "Estádio José Alvalade", city: "Lisboa" }) =>
  seedFootballMatch(db, { id, status: "NS", statusRaw: "NS", elapsed: null, finishedAt: null, finishedAtSource: null, kickoff: kick(hours), venue, score: { home: null, away: null, halftime: null, extratime: null, penalty: null } } as never);

beforeEach(() => {
  clock = NOW;
});

describe("syncPrematch", () => {
  it("jogo NS daqui a 30 h: previsões, lesões e estádio (3 chamadas)", async () => {
    await seedNs("1500003", 30);
    const f = fakeFetch(routes());
    const r = await syncPrematch(deps(f));
    expect(r).toMatchObject({ count: 1, failed: 0 });
    expect(f.calls).toHaveLength(3);

    const p = (await db.doc("matches/1500003/details/prematch").get()).data()!;
    expect(p.percent).toEqual({ home: 45, draw: 45, away: 10 });
    expect(p.advice).toBe("Double chance : Sporting CP or draw");
    expect(p.winner).toEqual({ id: "228", name: "Sporting CP", comment: "Win or draw" });
    expect(p.form).toEqual({ home: "78%", away: "78%" });
    expect(p.last5.home).toMatchObject({ played: 5 });
    expect(p.fetchedAt.toMillis()).toBe(NOW.getTime());
    expect(p.h2h).toHaveLength(1);
    expect(p.h2h[0]).toMatchObject({ id: "1400001", home: { id: "228", logo: SPORTING_CREST_URL }, away: { id: "211" }, score: { home: 1, away: 1 } });

    const inj = (await db.doc("matches/1500003/details/injuries").get()).data()!;
    expect(inj.items).toHaveLength(3);
    expect(inj.items[0]).toMatchObject({ teamId: "228", playerId: "5007", name: "Trincão", type: "Missing Fixture", reason: "Muscle Injury" });

    expect((await db.doc("venues/1").get()).data()).toMatchObject({ name: "Estádio José Alvalade", city: "Lisboa", capacity: 50095, surface: "grass" });
    const m = (await db.doc("matches/1500003").get()).data()!;
    expect(m.venue).toMatchObject({ id: "1", name: "Estádio José Alvalade", capacity: 50095, image: expect.stringContaining("venues/1.png") });
  });

  it("segunda execução 1 h depois: 0 chamadas", async () => {
    await seedNs("1500003", 30);
    await syncPrematch(deps(fakeFetch(routes())));
    clock = new Date(NOW.getTime() + HOUR);
    const f = fakeFetch(routes());
    const r = await syncPrematch(deps(f));
    expect(f.calls).toHaveLength(0);
    expect(r.count).toBe(0);
  });

  it("13 h depois volta a atualizar previsões e lesões, sem estádio", async () => {
    await seedNs("1500003", 30);
    await syncPrematch(deps(fakeFetch(routes())));
    clock = new Date(NOW.getTime() + 13 * HOUR);
    const f = fakeFetch(routes());
    await syncPrematch(deps(f));
    expect(f.calls).toHaveLength(2);
    expect(f.calls.some((u) => /venues/.test(u))).toBe(false);
  });

  it("jogo daqui a 3 dias ou já começado: 0 chamadas", async () => {
    await seedNs("1", 72);
    await seedFootballMatch(db, { id: "2", status: "FT", kickoff: kick(5) } as never);
    const f = fakeFetch(routes());
    const r = await syncPrematch(deps(f));
    expect(f.calls).toHaveLength(0);
    expect(r).toMatchObject({ count: 0, failed: 0 });
  });

  it("estádio já em venues/: sem chamada venues, mas capacity preenchida no jogo", async () => {
    await db.doc("venues/1").set({ name: "Estádio José Alvalade", city: "Lisboa", address: null, capacity: 50095, surface: "grass", image: "https://x/1.png" });
    await seedNs("1500003", 30);
    const f = fakeFetch(routes());
    await syncPrematch(deps(f));
    expect(f.calls.some((u) => /venues/.test(u))).toBe(false);
    expect(f.calls).toHaveLength(2);
    expect((await db.doc("matches/1500003").get()).get("venue")).toMatchObject({ capacity: 50095, image: "https://x/1.png" });
  });

  it("previsões vazias: não escreve prematch nem conta falha; lesões e estádio seguem", async () => {
    await seedNs("1500003", 30);
    const f = fakeFetch([[/predictions/, envelope([])], ...routes().slice(1)]);
    const r = await syncPrematch(deps(f));
    expect(r.failed).toBe(0);
    expect((await db.doc("matches/1500003/details/prematch").get()).exists).toBe(false);
    expect((await db.doc("matches/1500003/details/injuries").get()).exists).toBe(true);
  });

  it("um jogo que falha não bloqueia os outros; falha conta em failed", async () => {
    await seedNs("1500003", 30);
    await seedNs("1500004", 20);
    const f = fakeFetch([
      [/predictions\?fixture=1500004/, { status: 500, body: "boom" }],
      ...routes(),
    ]);
    const r = await syncPrematch(deps(f));
    expect(r.failed).toBe(1);
    expect((await db.doc("matches/1500003/details/prematch").get()).exists).toBe(true);
  });

  it("quota (429) pára o lote e os restantes contam como falhados", async () => {
    await seedNs("1500003", 20);
    await seedNs("1500004", 30);
    await seedNs("1500005", 40);
    const f = fakeFetch([[/predictions/, { status: 429, body: "" }], ...routes().slice(1)]);
    await expect(syncPrematch(deps(f))).rejects.toThrow();
    expect(f.calls.filter((u) => /predictions/.test(u)).length).toBeLessThan(3);
  });

  it("saveMatch posterior do mesmo fixture mantém venue.capacity e image", async () => {
    await seedNs("1500003", 30);
    await syncPrematch(deps(fakeFetch(routes())));
    const fx = load("fixture-ns.json").response[0];
    fx.fixture.id = 1500003;
    fx.fixture.venue = { id: 1, name: "Estádio José Alvalade", city: "Lisboa" };
    const { match } = mapFixture({ events: [], lineups: [], statistics: [], players: [], ...fx }, { now: NOW, previous: null, observedLive: false });
    await saveMatch(db, { match }, { prefix: "t_" });
    expect((await db.doc("matches/1500003").get()).get("venue")).toMatchObject({ id: "1", capacity: 50095, image: expect.stringContaining("venues/1.png") });
  });
});
