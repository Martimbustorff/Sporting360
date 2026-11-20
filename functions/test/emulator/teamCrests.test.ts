// Emblemas dos adversários das fontes gratuitas, guardados em teamCrests (20/11): pedidos uma vez, reutilizados depois.
import * as fs from "fs";
import * as path from "path";
import { deleteApp, getApps } from "firebase-admin/app";
import type { Firestore } from "firebase-admin/firestore";
import { CREST_RETRY_MS, MAX_CREST_LOOKUPS } from "../../src/modalities/teamCrests";
import { FREE_MATCH_SOURCES, syncFreeCompetition } from "../../src/modalities/freeSourcesSync";
import { SPORTING_CREST_URL } from "../../src/config/brand";
import { clearAll, testDb } from "../helpers/emulatorDb";
import { fakeFetch } from "../helpers/fakeFetch";

const NOW = new Date("2026-11-18T12:00:00Z");
const fixture = (p: string) => fs.readFileSync(path.join(__dirname, "..", "fixtures", "free", p), "utf8");

let db: Firestore;
beforeAll(() => {
  db = testDb("team-crests-test");
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});
beforeEach(async () => {
  await clearAll(db);
});

// Só o hoqueipatins (recurso do hóquei nacional): a principal falha e os jogos vêm todos do recurso.
const broken = { key: "hp_fpp", sport: "roller_hockey" as const, fetchMatches: async () => { throw new Error("fora"); } };
const ref = { key: "roller_hockey", sport: "roller_hockey" as const, primary: broken, fallback: FREE_MATCH_SOURCES.hoqueipatins, prefix: "hq", filter: (m: { competition: { type: string } }) => m.competition.type !== "europe" };

const events = (): Array<[RegExp, Parameters<typeof fakeFetch>[0][number][1]]> => [
  [/events\?.*page=1$/, { status: 200, body: fixture("hoqueipatins/events-league230-season1122-page1.json"), headers: { "X-WP-TotalPages": "1" } }],
];
const crestRoutes = (): Parameters<typeof fakeFetch>[0] => [
  // O Benfica (3580) não tem imagem; os outros têm media = id + 1.
  [/teams\/3580\?/, { status: 200, body: { featured_media: 0 } }],
  [/teams\/(\d+)\?/, (url: string) => ({ status: 200, body: { featured_media: Number(url.match(/teams\/(\d+)/)![1]) + 1 } })],
  [/media\/(\d+)\?/, (url: string) => ({ status: 200, body: { source_url: `http://www.hoqueipatins.pt/wp-content/uploads/${url.match(/media\/(\d+)/)![1]}.png` } })],
];

const opp = async (id: string) => {
  const m = (await db.doc(`matches/${id}`).get()).data()!;
  return m.sportingSide === "home" ? m.away : m.home;
};

describe("teamCrests", () => {
  it("pede o emblema de cada adversário uma vez, grava em teamCrests e põe-no no logo do jogo", async () => {
    const f = fakeFetch([...events(), ...crestRoutes()]);
    await syncFreeCompetition({ db, fetch: f, now: () => NOW }, ref);

    expect(await opp("hq_hoqueipatins_110379")).toMatchObject({ name: "Valongo", logo: "https://www.hoqueipatins.pt/wp-content/uploads/3609.png" });
    expect((await db.doc("teamCrests/roller_hockey_valongo").get()).data()).toMatchObject({ sport: "roller_hockey", name: "Valongo", url: "https://www.hoqueipatins.pt/wp-content/uploads/3609.png", provider: "hoqueipatins", providerId: 3608 });
    // Sem imagem na fonte: fica registado (url null) e o jogo sem emblema; a app mostra as iniciais.
    expect((await db.doc("teamCrests/roller_hockey_benfica").get()).data()).toMatchObject({ url: null });
    expect((await opp("hq_hoqueipatins_110386")).logo).toBeNull();
    // O Sporting nunca é pedido: leva sempre o emblema de 2026.
    expect(f.calls.some((u) => /teams\/3860/.test(u))).toBe(false);
    expect((await db.doc("matches/hq_hoqueipatins_110379").get()).get("away")).toMatchObject({ logo: SPORTING_CREST_URL });
    expect(f.calls.filter((u) => /teams\//.test(u)).length).toBeLessThanOrEqual(MAX_CREST_LOOKUPS);

    // Mais adversários do que o teto: os que faltam vêm na execução seguinte, e só esses.
    const f2 = fakeFetch([...events(), ...crestRoutes()]);
    await syncFreeCompetition({ db, fetch: f2, now: () => new Date(NOW.getTime() + 6 * 3600_000) }, ref);
    const again = f2.calls.filter((u) => /teams\//.test(u));
    expect(again.every((u) => !f.calls.includes(u))).toBe(true);
    // Depois disso nenhum pedido de emblemas (os guardados servem, o null ainda não expirou).
    const f3 = fakeFetch(events());
    await syncFreeCompetition({ db, fetch: f3, now: () => new Date(NOW.getTime() + 12 * 3600_000) }, ref);
    expect(f3.calls.every((u) => !/teams\/|media\//.test(u))).toBe(true);
    expect((await opp("hq_hoqueipatins_110379")).logo).toBe("https://www.hoqueipatins.pt/wp-content/uploads/3609.png");
  });

  it("um emblema que falha não trava os jogos e volta a ser pedido só depois de CREST_RETRY_MS", async () => {
    const f = fakeFetch([...events(), [/teams\/|media\//, { status: 500, body: "erro" }]]);
    const r = await syncFreeCompetition({ db, fetch: f, now: () => NOW }, ref);
    expect(r.count).toBeGreaterThan(0);
    expect((await opp("hq_hoqueipatins_110379")).logo).toBeNull();

    const later = fakeFetch([...events(), ...crestRoutes()]);
    await syncFreeCompetition({ db, fetch: later, now: () => new Date(NOW.getTime() + CREST_RETRY_MS + 3600_000) }, ref);
    expect((await opp("hq_hoqueipatins_110379")).logo).toBe("https://www.hoqueipatins.pt/wp-content/uploads/3609.png");
  });
});
