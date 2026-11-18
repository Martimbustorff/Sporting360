import * as fs from "fs";
import * as path from "path";
import { deleteApp, getApps } from "firebase-admin/app";
import type { Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { runJob } from "../../src/store/health";
import { SPORTING_CREST_URL } from "../../src/config/brand";
import { FREE_MATCH_SOURCES, syncFreeCompetition, syncFreeSources } from "../../src/modalities/freeSourcesSync";
import type { MatchSource } from "../../src/sources/free/common";
import { clearAll, testDb } from "../helpers/emulatorDb";
import { fakeFetch } from "../helpers/fakeFetch";

const NOW = new Date("2026-11-18T12:00:00Z");
const MIN = 60_000;
const fixture = (p: string) => fs.readFileSync(path.join(__dirname, "..", "fixtures", "free", p), "utf8");

let db: Firestore;
beforeAll(() => {
  db = testDb("free-sources-sync-test");
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});
beforeEach(async () => {
  await clearAll(db);
});

const gamesheet = (home: string, away: string, start: string) =>
  `<script type="application/ld+json">${JSON.stringify({ "@type": "SportsEvent", name: `UEFA FUTSAL CHAMPIONS LEAGUE - Oitavos-De-Final: ${home} vs ${away}`, homeTeam: { name: home }, awayTeam: { name: away }, startDate: start, location: { name: "Pavilhão" } })}</script>`;

function allRoutes(o: { fail?: boolean } = {}) {
  if (o.fail) return fakeFetch([[/./, { status: 500, body: "erro" }]]);
  return fakeFetch(allRouteList());
}

function allRouteList(): Parameters<typeof fakeFetch>[0] {
  return [
    [/schedule\/3\/26$/, "free/futsalportugal/schedule-liga-placard-26.html"],
    [/schedule\/3\/45$/, "free/futsalportugal/schedule-taca-de-portugal-45.html"],
    [/schedule\/3\/43$/, "free/futsalportugal/schedule-taca-da-liga-43.html"],
    [/schedule\/3\/40$/, "free/futsalportugal/schedule-supertaca-40.html"],
    [/schedule\/3\/57$/, "free/futsalportugal/schedule-champions-league-57.html"],
    [/gamesheet\/66614$/, { status: 200, body: gamesheet("TFK Beitar", "Sporting CP", "2026-11-23T18:00:00+00:00") }],
    [/gamesheet\/\d+$/, { status: 404 }],
    [/hp\.fpp\.pt\/136\/12$/, "free/hp_fpp/competicoes-136-12-lista-fases.html"],
    [/hp\.fpp\.pt\/136\/\d+$/, { status: 200, body: `<div id="principal"><h1>Lista</h1></div>` }],
    [/Competicao\/493$/, "free/hp_fpp/competicao-493-campeonato-fase-regular.html"],
    [/Competicao\/496$/, "free/hp_fpp/competicao-496-supertaca.html"],
    [/Competicao\/508$/, "free/hp_fpp/competicao-508-taca-pre-eliminatoria.html"],
    [/Competicao\/509$/, "free/hp_fpp/competicao-509-elite-cup.html"],
    [/events\?.*page=1$/, { status: 200, body: fixture("hoqueipatins/events-league230-season1122-page1.json"), headers: { "X-WP-TotalPages": "2" } }],
    [/events\?.*page=2$/, { status: 200, body: fixture("hoqueipatins/events-sporting-europe-cups.json"), headers: { "X-WP-TotalPages": "2" } }],
  ];
}

const ids = async (prefix: string) => (await db.collection("matches").get()).docs.map((d) => d.id).filter((id) => id.startsWith(prefix)).sort();

describe("syncFreeSources", () => {
  it("amostras → matches/fs_* e matches/hq_*, saúde por competição; 15 min depois fora de janela → 0 pedidos", async () => {
    const f = allRoutes();
    const r = await syncFreeSources({ db, fetch: f, now: () => NOW });
    expect(r.count).toBe(14 + 17 + 6);

    expect(await ids("fs_")).toHaveLength(14);
    const hq = await ids("hq_");
    expect(hq).toHaveLength(23);
    expect(hq).toContain("hq_hp_fpp_493_20");
    // J3 com o Benfica: hp.fpp.pt diz dia 22, hoqueipatins dia 21 → um só jogo, hora da FPP, local de nenhuma.
    expect(hq).not.toContain("hq_hoqueipatins_110386");
    const j3 = (await db.doc("matches/hq_hp_fpp_493_20").get()).data()!;
    expect(j3.kickoff.toDate()).toEqual(new Date("2026-11-22T19:30:00Z"));
    expect(j3.home).toEqual({ id: "sporting", name: "Sporting CP", logo: SPORTING_CREST_URL });
    expect(j3.source).toMatchObject({ provider: "hp_fpp", fallbackUsed: false });
    // Jogo que só o recurso tem (jornadas seguintes, fora da amostra da FPP).
    expect((await db.doc("matches/hq_hoqueipatins_110401").get()).get("source")).toMatchObject({ fallbackUsed: true, attribution: "hoqueipatins.pt" });
    // Liga dos Campeões WSE: fonte hoqueipatins com atribuição na app.
    const wse = (await db.doc("matches/hq_hoqueipatins_109728").get()).data()!;
    expect(wse.competition).toMatchObject({ name: "Liga dos Campeões WSE", type: "europe", roundLabel: "J1" });
    expect(wse.source).toMatchObject({ provider: "hoqueipatins", fallbackUsed: false, attribution: "hoqueipatins.pt" });

    const fs1 = (await db.doc("matches/fs_futsalportugal_66614").get()).data()!;
    expect(fs1.kickoff.toDate()).toEqual(new Date("2026-11-23T18:00:00Z"));
    expect(fs1.venue).toMatchObject({ name: "Pavilhão" });
    expect((await db.doc("matches/fs_futsalportugal_31776").get()).data()).toMatchObject({ status: "FT", score: { home: 1, away: 0 }, competition: { roundLabel: "J1" } });

    expect((await db.doc("ingestHealth/free_futsal").get()).data()).toMatchObject({ lastCount: 14, lastUsed: "primary", consecutiveFailures: 0 });
    expect((await db.doc("ingestHealth/free_roller_hockey").get()).data()).toMatchObject({ lastCount: 17, lastUsed: "merged" });
    expect((await db.doc("ingestHealth/free_roller_hockey_europe").get()).data()).toMatchObject({ lastCount: 6 });
    // Cada URL uma vez por execução (as duas competições de hóquei partilham as páginas do hoqueipatins).
    expect(new Set(f.calls).size).toBe(f.calls.length);
    expect(f.calls.every((u) => !/fpf\.pt|zerozero|sporting\.pt/.test(u))).toBe(true);
    expect((f.inits[0].headers as Record<string, string>)["User-Agent"]).toMatch(/SCP360/);
    expect((await db.collection("games").get()).empty).toBe(true);

    const f2 = allRoutes();
    await syncFreeSources({ db, fetch: f2, now: () => new Date(NOW.getTime() + 15 * MIN) });
    expect(f2.calls).toHaveLength(0);
    // 6 h depois volta a pedir.
    const f3 = allRoutes();
    await syncFreeSources({ db, fetch: f3, now: () => new Date(NOW.getTime() + 6 * 60 * MIN + MIN) });
    expect(f3.calls.length).toBeGreaterThan(0);
  });

  it("em janela de jogo: devido a cada 15 min e só a página da fase do jogo na FPP", async () => {
    await syncFreeSources({ db, fetch: allRoutes(), now: () => NOW });
    const kick = new Date("2026-11-22T19:30:00Z");
    const f = allRoutes();
    await syncFreeSources({ db, fetch: f, now: () => new Date(kick.getTime() - 10 * MIN) });
    expect(f.calls.filter((u) => u.includes("hp.fpp.pt"))).toEqual(["https://hp.fpp.pt/Competicao/493"]);
    const f2 = allRoutes();
    await syncFreeSources({ db, fetch: f2, now: () => new Date(kick.getTime() + 5 * MIN) });
    expect(f2.calls.filter((u) => u.includes("hp.fpp.pt"))).toHaveLength(1);
  });

  it("falha das duas fontes fora de janela: saúde com erro e espera 1 h antes de voltar a pedir", async () => {
    const f = allRoutes({ fail: true });
    // Todas as competições falharam: lança (o runJob do index regista free_sources com erro).
    await expect(syncFreeSources({ db, fetch: f, now: () => NOW })).rejects.toThrow(/as 3 competições falharam/);
    const h = (await db.doc("ingestHealth/free_roller_hockey").get()).data()!;
    expect(h.consecutiveFailures).toBe(1);
    expect(h.lastError).toMatch(/HTTP 500/);
    // Futsal: principal com erro e recurso sem jogos conhecidos (vazia) também conta como falha.
    expect((await db.doc("ingestHealth/free_futsal").get()).get("consecutiveFailures")).toBe(1);
    const f2 = allRoutes({ fail: true });
    await syncFreeSources({ db, fetch: f2, now: () => new Date(NOW.getTime() + 15 * MIN) });
    expect(f2.calls).toHaveLength(0);
    const f3 = allRoutes();
    await syncFreeSources({ db, fetch: f3, now: () => new Date(NOW.getTime() + 61 * MIN) });
    expect(f3.calls.length).toBeGreaterThan(0);
    expect(await ids("hq_")).toHaveLength(23);
  });

  it("principal com erro e recurso com jogos: a execução conta mas a saúde fica degradada, com alerta", async () => {
    const broken: MatchSource = { key: "hp_fpp", sport: "roller_hockey", fetchMatches: async () => { throw new Error("HTTP 503"); } };
    const alert = jest.spyOn(logger, "error").mockImplementation(() => undefined);
    const r = await syncFreeCompetition({ db, fetch: allRoutes(), now: () => NOW }, { key: "roller_hockey", sport: "roller_hockey", primary: broken, fallback: FREE_MATCH_SOURCES.hoqueipatins, prefix: "hq", filter: (m) => m.competition.type !== "europe" });
    expect(r).toMatchObject({ ok: true, used: "fallback", count: 17 });
    // Cada aviso sai uma vez, pelo recordRun.
    expect(r.alerts.length).toBeGreaterThan(0);
    expect(alert).toHaveBeenCalledTimes(r.alerts.length);
    for (const reason of r.alerts) expect(alert).toHaveBeenCalledWith("INGEST_ALERT", { source: "free_roller_hockey", reason });
    alert.mockRestore();
    const h = (await db.doc("ingestHealth/free_roller_hockey").get()).data()!;
    expect(h).toMatchObject({ degraded: true, lastUsed: "fallback", consecutiveFailures: 0 });
    expect(h.lastAlerts.join(" ")).toMatch(/principal falhou: HTTP 503/);
    await syncFreeCompetition({ db, fetch: allRoutes(), now: () => NOW }, { key: "roller_hockey", sport: "roller_hockey", primary: FREE_MATCH_SOURCES.hp_fpp, fallback: FREE_MATCH_SOURCES.hoqueipatins, prefix: "hq", filter: (m) => m.competition.type !== "europe" });
    expect((await db.doc("ingestHealth/free_roller_hockey").get()).get("degraded")).toBe(false);
    // O FPP passa a dar os jogos que vieram do recurso: os ids hq_hoqueipatins_* ficam, sem duplicados.
    expect(await ids("hq_")).toHaveLength(17);
  });

  it("principal e recurso em falha: um alerta da competição e nenhum da execução agregada", async () => {
    const alert = jest.spyOn(logger, "error").mockImplementation(() => undefined);
    jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    const broken: MatchSource = { key: "hp_fpp", sport: "roller_hockey", fetchMatches: async () => { throw new Error("HTTP 503"); } };
    const r = await syncFreeCompetition({ db, fetch: allRoutes(), now: () => NOW }, { key: "roller_hockey", sport: "roller_hockey", primary: broken, fallback: broken, prefix: "hq" });
    expect(r.ok).toBe(false);
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith("INGEST_ALERT", expect.objectContaining({ source: "free_roller_hockey" }));
    alert.mockClear();
    // Agregado: uma competição falhada já alertou na sua saúde; a execução free_sources não repete.
    const f = fakeFetch([[/hp\.fpp\.pt|events\?/, { status: 503, body: "" }], ...allRouteList()]);
    await runJob(db, "free_sources", () => syncFreeSources({ db, fetch: f, now: () => NOW }));
    const sources = alert.mock.calls.map((c) => (c[1] as { source: string }).source);
    expect(sources).not.toContain("free_sources");
    const hockey = sources.filter((x) => x.startsWith("free_roller_hockey"));
    expect(hockey.length).toBeGreaterThan(0);
    expect(new Set(hockey).size).toBe(hockey.length);
    jest.restoreAllMocks();
  });

  it("Review Focus 5: fontes vazias em novembro não apagam os jogos gravados; jogo bloqueado não é tocado", async () => {
    await syncFreeSources({ db, fetch: allRoutes(), now: () => NOW });
    await db.doc("matches/hq_hp_fpp_493_20").set({ locked: true, score: { home: 9, away: 9 } }, { merge: true });
    const empty: MatchSource = { key: "vazio", sport: "roller_hockey", fetchMatches: async () => [] };
    const r = await syncFreeCompetition({ db, fetch: allRoutes(), now: () => NOW }, { key: "roller_hockey", sport: "roller_hockey", primary: empty, fallback: empty, prefix: "hq" });
    expect(r.count).toBe(0);
    expect(await ids("hq_")).toHaveLength(23);
    const h = (await db.doc("ingestHealth/free_roller_hockey").get()).data()!;
    expect(h.lastAlerts.join(" ")).toMatch(/0 jogos nas duas fontes/);

    const one = { ...FREE_MATCH_SOURCES.hp_fpp };
    await syncFreeCompetition({ db, fetch: allRoutes(), now: () => NOW }, { key: "roller_hockey", sport: "roller_hockey", primary: one, fallback: empty, prefix: "hq" });
    expect((await db.doc("matches/hq_hp_fpp_493_20").get()).get("score")).toMatchObject({ home: 9, away: 9 });
  });
});
