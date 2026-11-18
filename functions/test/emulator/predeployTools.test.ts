import { deleteApp, getApps } from "firebase-admin/app";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { ENGINE_COLLECTIONS, checkFirestore, checkShadowIsolation, firestoreFailures, shadowFailures } from "../../scripts/check-predeploy";
import { compareAll, hasProblems } from "../../scripts/compare-legacy";
import { parseArgs as resetParse, resetEngine, runReset } from "../../scripts/reset-engine";
import { parseArgs, stripNewsContent } from "../../scripts/strip-news-content";
import { clearAll, testDb } from "../helpers/emulatorDb";

let db: Firestore;
beforeAll(() => {
  db = testDb("predeploy-tools-test");
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});
beforeEach(async () => {
  await clearAll(db);
});

describe("check-predeploy (Firestore, só leitura)", () => {
  it("dados corretos: sem falhas, e conta o motor v2027", async () => {
    await db.doc("rankings/u1_2026-2027").set({ userId: "u1", season: "2026-2027", points: 4 });
    await db.doc("predictions/1001_u1").set({ userId: "u1", scored: false });
    await db.doc("manofmatch/1001_u1").set({ userId: "u1" });
    await db.doc("matchPredictions/1001_u1").set({ userId: "u1" });
    const r = await checkFirestore(db);
    expect(r).toMatchObject({ rankings: 1, predictions: 1, manofmatch: 1, badRankings: [], withSource: { predictions: [], manofmatch: [] } });
    expect(r.engine.matchPredictions).toBe(1);
    expect(r.emailNames).toBe(0);
    expect(firestoreFailures(r)).toEqual([]);
  });

  it("ranking fora do formato e source nos palpites antigos falham", async () => {
    await db.doc("rankings/u1").set({ userId: "u1", points: 4 });
    await db.doc("predictions/1001_u1").set({ userId: "u1", source: "v2027" });
    await db.doc("manofmatch/1001_u2").set({ userId: "u2", source: null });
    const r = await checkFirestore(db);
    expect(firestoreFailures(r)).toEqual(["1 rankings fora do formato", "1 predictions com source", "1 manofmatch com source"]);
  });
});

describe("check-predeploy --phase shadow (count, só leitura)", () => {
  it("sombra isolada: _shadow_games com documentos e reais sem _ingest", async () => {
    await db.doc("_shadow_games/1001").set({ api: "1001", _ingest: "v2027" });
    await db.doc("games/1001").set({ api: "1001" });
    const r = await checkShadowIsolation(db);
    expect(r).toEqual({ shadowGames: 1, leaked: { games: 0, standings: 0 } });
    expect(shadowFailures(r)).toEqual([]);
  });

  it("escrita nas coleções reais é detetada", async () => {
    await db.doc("games/1001").set({ api: "1001", _ingest: "v2027" });
    await db.doc("standings/228_94_2026").set({ api: "228", _ingest: "v2027", userName: "x" });
    const r = await checkShadowIsolation(db);
    expect(r).toEqual({ shadowGames: 0, leaked: { games: 1, standings: 1 } });
    expect(shadowFailures(r)).toHaveLength(3);
  });
});

describe("compare-legacy (Firestore, só leitura)", () => {
  const game = (id: string, over: Record<string, unknown> = {}) => ({
    api: id,
    timestamp: Timestamp.fromMillis(1_790_000_000_000),
    scorehome: "1",
    scoreaway: "0",
    competition: "Primeira Liga",
    isActive: false,
    endTime: "2026-12-01T22:30:00.000Z",
    ...over,
  });

  it("documentos iguais nos dois lados: sem problemas; só o que mudou desde --since conta", async () => {
    // `since` vem do relógio do servidor (writeTime do documento antigo) mais 1 ms: sem esperas nem corridas de relógio.
    const old = await db.doc("games/900").set(game("900", { scorehome: "3" })); // antigo, não está em sombra
    const since = new Date(old.writeTime.toDate().getTime() + 1);
    await db.doc("games/1001").set(game("1001", { channel: "Sport TV" }));
    await db.doc("_shadow_games/1001").set(game("1001", { _ingest: "v2027", isActive: true, endTime: "2026-12-01T21:55:00.000Z", channel: "" }));
    await db.doc("summaries/a").set({ GameId: "1001", playerSub: { name: "null" } });
    await db.doc("_shadow_summaries/a").set({ GameId: "1001", playerSub: { name: "" }, _ingest: "v2027" });
    const reports = await compareAll(db, ["summaries", "games"], since);
    expect(reports.map((r) => r.col)).toEqual(["games", "summaries"]);
    expect(reports[0]).toMatchObject({ compared: 1, missing: [], extra: [], unexpected: [] });
    expect(reports[1]).toMatchObject({ compared: 1, unexpected: [] });
    expect(reports[1].expected).toHaveLength(1);
    expect(hasProblems(reports)).toBe(false);
  });

  it("diferença de tipo, jogo em falta e jogo de competição nova (esperado) com os seus detalhes", async () => {
    const since = new Date(Date.now() - 1000);
    await db.doc("games/1001").set(game("1001"));
    await db.doc("_shadow_games/1001").set(game("1001", { scoreaway: 0 }));
    await db.doc("games/1002").set(game("1002"));
    await db.doc("_shadow_games/2001").set(game("2001", { competition: "Super Cup" }));
    await db.doc("_shadow_summaries/x").set({ GameId: "2001" });
    const [games, summaries] = await compareAll(db, ["games", "summaries"], since);
    expect(games.unexpected).toEqual([{ id: "1001", field: "scoreaway", a: "0", b: 0 }]);
    expect(games.missing).toEqual(["1002"]);
    expect(games.extra).toEqual([]);
    expect(games.expectedExtra).toEqual(["2001"]);
    expect(summaries).toMatchObject({ extra: [], expectedExtra: ["x"] });
    expect(hasProblems([games, summaries])).toBe(true);
  });
});

describe("strip-news-content (só no emulador)", () => {
  const news = (id: string, withContent: boolean) => ({
    id,
    title: `Título ${id}`,
    summary: `Resumo ${id}`,
    source: "Record",
    url: `https://www.record.pt/${id}`,
    sport: "football",
    ...(withContent ? { content: `Texto integral ${id}` } : {}),
  });
  const seedNews = async () => {
    await db.doc("news/a").set(news("a", true));
    await db.doc("news/b").set(news("b", true));
    await db.doc("news/c").set(news("c", true));
    await db.doc("news/d").set(news("d", false));
  };

  it("dryRun conta e não muda nada", async () => {
    await seedNews();
    expect(await stripNewsContent(db, { dryRun: true })).toEqual({ scanned: 4, stripped: 3 });
    expect((await db.doc("news/a").get()).data()).toEqual(news("a", true));
    expect((await db.doc("news/d").get()).data()).toEqual(news("d", false));
  });

  it("sem dryRun nenhum documento fica com content e os outros campos ficam iguais", async () => {
    await seedNews();
    expect(await stripNewsContent(db, { dryRun: false })).toEqual({ scanned: 4, stripped: 3 });
    for (const id of ["a", "b", "c", "d"]) expect((await db.doc(`news/${id}`).get()).data()).toEqual(news(id, false));
  });

  it("mais de 400 documentos passam por vários lotes", async () => {
    for (let i = 0; i < 405; i++) await db.doc(`news/n${i}`).set(news(`n${i}`, true));
    expect(await stripNewsContent(db, { dryRun: false })).toEqual({ scanned: 405, stripped: 405 });
    expect((await db.collection("news").get()).docs.some((d) => "content" in d.data())).toBe(false);
  });
});

describe("strip-news-content (argumentos da linha de comandos)", () => {
  it("sem flag é um ensaio (apply=false)", () => {
    expect(parseArgs(["--project", "p1"])).toEqual({ ok: true, project: "p1", apply: false });
  });

  it("--apply apaga a sério", () => {
    expect(parseArgs(["--project", "p1", "--apply"])).toEqual({ ok: true, project: "p1", apply: true });
  });

  it("sem --project (ou sem valor) falha", () => {
    expect(parseArgs([]).ok).toBe(false);
    expect(parseArgs(["--apply"]).ok).toBe(false);
    expect(parseArgs(["--project"]).ok).toBe(false);
    expect(parseArgs(["--project", "--apply"]).ok).toBe(false);
  });

  it("--dry-run foi removido e é rejeitado", () => {
    const r = parseArgs(["--project", "p1", "--dry-run"]);
    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.message).toMatch(/removido/);
  });

  it("CLI sem --project sai com código != 0 sem tocar em nada", async () => {
    const { spawnSync } = await import("node:child_process");
    const r = spawnSync("npx", ["tsx", "scripts/strip-news-content.ts"], { cwd: __dirname + "/../..", encoding: "utf8" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/--project/);
  });
});

describe("reset-engine (só no emulador)", () => {
  const NOW = new Date("2026-11-20T10:00:00Z");
  const hours = (h: number) => Timestamp.fromDate(new Date(NOW.getTime() + h * 3_600_000));
  const match = (id: string, over: Record<string, unknown> = {}) =>
    db.doc(`matches/${id}`).set({ id, sport: "football", sportingSide: "home", status: "NS", kickoff: hours(48), ...over });
  const ENGINE = ["matchPredictions/a", "mvpVotes/a", "pointEvents/a", "leaderboards/season", "settlements/a", "mvpTallies/g1"];
  const OTHERS = ["users/a", "publicProfiles/a", "predictions/x", "manofmatch/x", "rankings/x_2026-2027", "gamebox/x", "config/app", "news/n1", "matches/m1"];

  const seed = async () => {
    for (const p of ENGINE) await db.doc(p).set({ v: 1 });
    await db.doc("leaderboards/season/entries/u1").set({ points: 3 });
    await db.doc("mvpTallies/g1/shards/0").set({ counts: { p1: 2 } });
    for (const p of OTHERS) await db.doc(p).set({ v: 1 });
  };
  const exists = async (p: string) => (await db.doc(p).get()).exists;

  it("dryRun devolve as contagens (com subcoleções) e não apaga nada", async () => {
    await seed();
    const r = await resetEngine(db, { dryRun: true, now: NOW });
    expect(r.deleted).toBe(false);
    expect(r.counts).toEqual({
      matchPredictions: 1, mvpVotes: 1, pointEvents: 1, leaderboards: 1, settlements: 1, mvpTallies: 1,
      "leaderboards/entries": 1, "mvpTallies/shards": 1,
    });
    for (const p of [...ENGINE, ...OTHERS, "leaderboards/season/entries/u1", "mvpTallies/g1/shards/0"]) expect(await exists(p)).toBe(true);
  });

  it("sem dryRun apaga as 6 coleções, incluindo entries e shards, e deixa as outras intactas", async () => {
    await seed();
    const r = await resetEngine(db, { dryRun: false, now: NOW });
    expect(r.deleted).toBe(true);
    for (const c of ENGINE_COLLECTIONS) expect((await db.collection(c).listDocuments()).length).toBe(0);
    expect(await exists("leaderboards/season/entries/u1")).toBe(false);
    expect(await exists("mvpTallies/g1/shards/0")).toBe(false);
    for (const p of OTHERS) expect(await exists(p)).toBe(true);
  });

  it("conta e apaga documentos pai que só existem por terem subcoleções", async () => {
    await db.doc("leaderboards/ghost/entries/u1").set({ points: 1 });
    expect((await resetEngine(db, { dryRun: true, now: NOW })).counts).toMatchObject({ leaderboards: 1, "leaderboards/entries": 1 });
    await resetEngine(db, { dryRun: false, now: NOW });
    expect(await exists("leaderboards/ghost/entries/u1")).toBe(false);
  });

  // Kickoffs fora de ±6 h (-8 h e +30 h): só a query de estado pode recusar.
  it.each([["LIVE", -8], ["HT", -8], ["LIVE", 30], ["HT", 30]])("jogo do Sporting %s com kickoff a %i h recusa e não apaga nada", async (status, h) => {
    await seed();
    await match("live", { status, kickoff: hours(h as number) });
    await expect(resetEngine(db, { dryRun: false, now: NOW })).rejects.toThrow("RESET_BLOCKED_LIVE_GAME");
    await expect(resetEngine(db, { dryRun: true, now: NOW })).rejects.toThrow("RESET_BLOCKED_LIVE_GAME");
    for (const p of ENGINE) expect(await exists(p)).toBe(true);
  });

  it("janela de kickoff: dentro de ±6 h recusa, fora de 6 h não", async () => {
    await seed();
    for (const h of [-5.9, 0, 5.9, -6, 6]) {
      await clearMatches();
      await match("m", { kickoff: hours(h) });
      await expect(resetEngine(db, { dryRun: true, now: NOW })).rejects.toThrow("RESET_BLOCKED_LIVE_GAME");
    }
    for (const h of [-6.1, 6.1]) {
      await clearMatches();
      await match("m", { kickoff: hours(h), status: h < 0 ? "FT" : "NS" });
      await expect(resetEngine(db, { dryRun: true, now: NOW })).resolves.toMatchObject({ deleted: false });
    }
  });

  it("jogos de outros desportos (LIVE ou próximos) não bloqueiam", async () => {
    await seed();
    await match("futsal", { sport: "futsal", status: "LIVE", kickoff: hours(0) });
    await expect(resetEngine(db, { dryRun: false, now: NOW })).resolves.toMatchObject({ deleted: true });
  });

  async function clearMatches() {
    await Promise.all((await db.collection("matches").listDocuments()).map((r) => r.delete()));
  }
});

describe("reset-engine (linha de comandos)", () => {
  it("parseArgs: --project obrigatório, --apply opcional, --dry-run rejeitado", () => {
    expect(resetParse(["--project", "scp360-37a74"])).toEqual({ ok: true, project: "scp360-37a74", apply: false });
    expect(resetParse(["--project", "scp360-37a74", "--apply"])).toEqual({ ok: true, project: "scp360-37a74", apply: true });
    expect(resetParse([])).toMatchObject({ ok: false });
    expect(resetParse(["--apply"])).toMatchObject({ ok: false });
    expect(resetParse(["--project", "--apply"])).toMatchObject({ ok: false });
    const dry = resetParse(["--project", "x", "--dry-run"]);
    expect(dry).toMatchObject({ ok: false });
    expect(dry.ok === false && dry.message).toContain("--dry-run");
  });

  const NOW = new Date("2026-11-20T10:00:00Z");
  const run = (apply: boolean, typed: string) => {
    const logs: string[] = [];
    const prompt = jest.fn(async () => typed);
    return { logs, prompt, p: runReset({ project: "scp360-37a74", apply }, { db, now: NOW, prompt, log: (l) => logs.push(l) }) };
  };

  it("sem --apply é ensaio: não pergunta nem apaga", async () => {
    await db.doc("pointEvents/a").set({ v: 1 });
    const { prompt, logs, p } = run(false, "");
    expect(await p).toEqual({ deleted: false });
    expect(prompt).not.toHaveBeenCalled();
    expect(logs.join("\n")).toContain("scp360-37a74");
    expect((await db.doc("pointEvents/a").get()).exists).toBe(true);
  });

  it("--apply com id diferente aborta e não apaga", async () => {
    await db.doc("pointEvents/a").set({ v: 1 });
    const { prompt, logs, p } = run(true, "outro-projeto");
    expect(await p).toEqual({ deleted: false });
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(logs.join("\n")).toContain("abortado");
    expect((await db.doc("pointEvents/a").get()).exists).toBe(true);
  });

  it("--apply com o id certo apaga", async () => {
    await db.doc("pointEvents/a").set({ v: 1 });
    await db.doc("users/a").set({ v: 1 });
    expect(await run(true, " scp360-37a74 ").p).toEqual({ deleted: true });
    expect((await db.doc("pointEvents/a").get()).exists).toBe(false);
    expect((await db.doc("users/a").get()).exists).toBe(true);
  });
});
