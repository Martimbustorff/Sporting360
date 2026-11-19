import { deleteApp, getApps } from "firebase-admin/app";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import type { EventItem } from "../../src/football/mapFixture";
import type { MatchDoc } from "../../src/model/types";
import { sendOnce } from "../../src/push/markers";
import { dispatchMatchPushes } from "../../src/push/matchPush";
import { REMINDER_LATEST_MS, REMINDER_LEAD_MS, remindersOn, runPredictionReminder } from "../../src/push/predictionReminder";
import { seedFootballMatch } from "../helpers/seedMatch";
import { fakeSender } from "../helpers/fakeSender";
import { clearAll, testDb } from "../helpers/emulatorDb";

const NOW = new Date("2026-11-22T20:00:00Z");

let db: Firestore;
beforeAll(() => {
  db = testDb("push-test");
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});
beforeEach(async () => {
  await clearAll(db);
});

describe("sendOnce", () => {
  const FIELD = ["push", "matchStartSentAt"];

  it("primeira vez envia e grava a marca; segunda vez skipped sem enviar", async () => {
    const send = jest.fn(async () => undefined);
    expect(await sendOnce(db, "ingestState/match_1", FIELD, NOW, send)).toBe("sent");
    expect(await sendOnce(db, "ingestState/match_1", FIELD, NOW, send)).toBe("skipped");
    expect(send).toHaveBeenCalledTimes(1);
    expect((await db.doc("ingestState/match_1").get()).get("push.matchStartSentAt")).toBeInstanceOf(Timestamp);
  });

  it("envio que lança: failed, marca libertada, a seguinte envia", async () => {
    const send = jest.fn<Promise<void>, []>().mockRejectedValueOnce(new Error("fcm")).mockResolvedValue(undefined);
    expect(await sendOnce(db, "ingestState/match_1", FIELD, NOW, send)).toBe("failed");
    expect((await db.doc("ingestState/match_1").get()).get("push.matchStartSentAt")).toBeUndefined();
    expect(await sendOnce(db, "ingestState/match_1", FIELD, NOW, send)).toBe("sent");
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("não apaga outros campos do documento (hashes, ticker)", async () => {
    await db.doc("ingestState/match_1").set({ hash: "abc", ticker: { lastAt: 1 }, push: { goals: { k1: Timestamp.fromDate(NOW) } } });
    const fail = jest.fn(async () => {
      throw new Error("fcm");
    });
    await sendOnce(db, "ingestState/match_1", FIELD, NOW, fail);
    await sendOnce(db, "ingestState/match_1", FIELD, NOW, async () => undefined);
    const d = (await db.doc("ingestState/match_1").get()).data()!;
    expect(d.hash).toBe("abc");
    expect(d.ticker).toEqual({ lastAt: 1 });
    expect(Object.keys(d.push.goals)).toEqual(["k1"]);
    expect(d.push.matchStartSentAt).toBeInstanceOf(Timestamp);
  });

  it("campos com pontos no nome (chave de golo) ficam aninhados num só campo", async () => {
    const send = jest.fn(async () => undefined);
    expect(await sendOnce(db, "ingestState/match_1", ["push", "goals", "9002_90+3_1"], NOW, send)).toBe("sent");
    expect(await sendOnce(db, "ingestState/match_1", ["push", "goals", "9002_90+3_1"], NOW, send)).toBe("skipped");
    const d = (await db.doc("ingestState/match_1").get()).data()!;
    expect(Object.keys(d.push.goals)).toEqual(["9002_90+3_1"]);
  });

  it("duas chamadas em paralelo enviam uma vez", async () => {
    const send = jest.fn(async () => undefined);
    const r = await Promise.all([
      sendOnce(db, "ingestState/match_1", FIELD, NOW, send),
      sendOnce(db, "ingestState/match_1", FIELD, NOW, send),
    ]);
    expect(r.sort()).toEqual(["sent", "skipped"]);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

const MIN = 60_000;
const KO = new Date("2026-11-15T20:30:00Z");

function liveMatch(over: Partial<MatchDoc> = {}): MatchDoc {
  return {
    id: "9002",
    sport: "football",
    competition: { key: "liga", id: "94", name: "Liga", type: "league", season: "2026", round: null, roundLabel: null },
    home: { id: "228", name: "Sporting CP", logo: null },
    away: { id: "211", name: "Benfica", logo: null },
    sportingSide: "home",
    kickoff: KO,
    status: "LIVE",
    statusRaw: "1H",
    elapsed: 2,
    elapsedExtra: null,
    score: { home: 0, away: 0, halftime: null, extratime: null, penalty: null },
    finishedAt: null,
    finishedAtSource: null,
    referee: null,
    source: { provider: "api-football", id: "9002" },
    ...over,
  };
}

function ev(over: Partial<EventItem> = {}): EventItem {
  return {
    minute: 10, extra: null, teamId: "228", playerId: "7", playerName: "Gyökeres",
    assistId: null, assistName: null, type: "goal", detail: "Normal Goal", comments: null,
    ...over,
  };
}

const at = (min: number) => new Date(KO.getTime() + min * MIN);

describe("dispatchMatchPushes", () => {
  it("jogo ao vivo com golos e elapsed baixo: nada para push_matchStart nem push_goals", async () => {
    const f = fakeSender();
    const m = liveMatch({ elapsed: 2, score: { home: 2, away: 0, halftime: null, extratime: null, penalty: null } });
    const events = [ev({ minute: 1, playerId: "1", playerName: "Trincão" }), ev({ minute: 2, playerId: "2", playerName: "Pote" })];
    const r = await dispatchMatchPushes(db, f.sender, m, events, at(3));
    await dispatchMatchPushes(db, f.sender, m, events, at(4));
    expect(r).toEqual({ sent: [], failed: [] });
    expect(f.topics).toEqual([]);
    const d = (await db.doc("ingestState/match_9002").get()).data();
    expect(d?.push?.matchStartSentAt).toBeUndefined();
    expect(d?.push?.goals).toBeUndefined();
  });

  it("golo dos descontos em FT, logo após o apito: também nada", async () => {
    const f = fakeSender();
    const finishedAt = at(110);
    const m = liveMatch({ id: "9003", status: "FT", statusRaw: "FT", elapsed: 90, finishedAt, score: { home: 1, away: 0, halftime: null, extratime: null, penalty: null } });
    await dispatchMatchPushes(db, f.sender, m, [ev({ minute: 90, extra: 4 })], new Date(finishedAt.getTime() + 5 * MIN));
    expect(f.topics.filter((t) => t.topic !== "push_mvpOpen")).toEqual([]);
  });

  it("MVP aberto (LIVE 80'): push_mvpOpen uma vez com /jogo/9002?tab=mvp; aberto outra vez em FT: não repete", async () => {
    const f = fakeSender();
    await dispatchMatchPushes(db, f.sender, liveMatch({ elapsed: 79, statusRaw: "2H" }), [], at(95));
    expect(f.topics).toEqual([]);
    await dispatchMatchPushes(db, f.sender, liveMatch({ elapsed: 80, statusRaw: "2H" }), [], at(96));
    const finishedAt = at(110);
    await dispatchMatchPushes(db, f.sender, liveMatch({ status: "FT", statusRaw: "FT", elapsed: 90, finishedAt }), [], at(112));
    expect(f.topics).toHaveLength(1);
    expect(f.topics[0]).toMatchObject({ topic: "push_mvpOpen", msg: { route: "/jogo/9002?tab=mvp" } });
  });

  it("outra modalidade (sport futsal): nada", async () => {
    const f = fakeSender();
    const m = liveMatch({ sport: "futsal", elapsed: 85, score: { home: 1, away: 0, halftime: null, extratime: null, penalty: null } });
    const r = await dispatchMatchPushes(db, f.sender, m, [ev({ minute: 84 })], at(90));
    expect(r).toEqual({ sent: [], failed: [] });
    expect(f.topics).toEqual([]);
    expect((await db.doc("ingestState/match_9002").get()).exists).toBe(false);
  });

  it("FCM falha no MVP: failed, e a chamada seguinte envia", async () => {
    const f = fakeSender();
    const m = liveMatch({ elapsed: 80, statusRaw: "2H" });
    f.failNext(1);
    expect(await dispatchMatchPushes(db, f.sender, m, [], at(96))).toEqual({ sent: [], failed: ["mvpOpen"] });
    expect((await dispatchMatchPushes(db, f.sender, m, [], at(97))).sent).toEqual(["mvpOpen"]);
    expect(f.topics).toHaveLength(1);
  });
});

describe("runPredictionReminder", () => {
  const NOW_R = new Date("2026-11-22T18:00:00Z");
  const KO_R = new Date(NOW_R.getTime() + 2 * 60 * MIN);
  const NS = { status: "NS" as const, statusRaw: "NS", elapsed: null, finishedAt: null, finishedAtSource: null, score: { home: null, away: null, halftime: null, extratime: null, penalty: null } };

  async function seedUsers() {
    const user = (uid: string, name: string, extra: Record<string, unknown> = {}) =>
      db.doc(`users/${uid}`).set({ email: `${uid}@exemplo.pt`, displayName: name, ...extra });
    const device = (uid: string, token: string, platform = "ios") =>
      db.doc(`users/${uid}/devices/${token}`).set({ token, platform, updatedAt: Timestamp.fromDate(NOW_R) });
    await user("ana", "Ana Silva");
    await device("ana", "ana-t1");
    await device("ana", "ana-t2", "android");
    await user("rui", "Rui Costa", { notificationPrefs: { matchStart: true, goals: true, predictionReminder: false, mvpOpen: true, news: true } });
    await device("rui", "rui-t1");
    await user("eva", "Eva Lopes", { notificationPrefs: { matchStart: true, goals: true, mvpOpen: true, news: true } });
    await device("eva", "eva-t1");
    await user("teo", "Teo Reis");
    await device("teo", "teo-t1");
    await db.doc("matchPredictions/9002_teo").set({ gameId: "9002", userId: "teo", home: 2, away: 0 });
  }

  it("constantes e remindersOn", () => {
    expect(REMINDER_LEAD_MS).toBe(2 * 60 * MIN);
    expect(REMINDER_LATEST_MS).toBe(90 * MIN);
    expect(remindersOn(undefined)).toBe(true);
    expect(remindersOn({ email: "x" })).toBe(true);
    expect(remindersOn({ notificationPrefs: { predictionReminder: true } })).toBe(true);
    expect(remindersOn({ notificationPrefs: { predictionReminder: false } })).toBe(false);
    expect(remindersOn({ notificationPrefs: {} })).toBe(false);
    expect(remindersOn({ notificationPrefs: null })).toBe(true);
  });

  it("só os tokens da ana, uma mensagem com rota de prognóstico", async () => {
    await seedFootballMatch(db, { id: "9002", kickoff: KO_R, ...NS });
    await seedUsers();
    const f = fakeSender();
    const r = await runPredictionReminder(db, f.sender, NOW_R);
    expect(r.count).toBe(2);
    expect(f.tokens).toHaveLength(1);
    expect(f.tokens[0].tokens.sort()).toEqual(["ana-t1", "ana-t2"]);
    expect(f.tokens[0].msg.route).toBe("/jogo/9002?tab=prognostico");
    expect(f.tokens[0].msg.body).toBe("Sporting CP vs Benfica começa às 20:00.");
    expect((await db.doc("ingestState/match_9002").get()).get("push.reminderSentAt")).toBeInstanceOf(Timestamp);
  });

  it("o payload não tem email, nome nem uid", async () => {
    await seedFootballMatch(db, { id: "9002", kickoff: KO_R, ...NS });
    await seedUsers();
    const f = fakeSender();
    await runPredictionReminder(db, f.sender, NOW_R);
    const msgs = JSON.stringify(f.tokens.map((t) => t.msg));
    expect(msgs).not.toContain("ana@");
    expect(msgs).not.toContain("Ana Silva");
    expect(msgs).not.toMatch(/\bana\b/);
  });

  it("segunda execução não envia", async () => {
    await seedFootballMatch(db, { id: "9002", kickoff: KO_R, ...NS });
    await seedUsers();
    const f = fakeSender();
    await runPredictionReminder(db, f.sender, NOW_R);
    expect((await runPredictionReminder(db, f.sender, new Date(NOW_R.getTime() + 5 * MIN))).count).toBe(0);
    expect(f.tokens).toHaveLength(1);
  });

  it("kickoff a 80 min (já passou a janela) ou a 3 h: não envia", async () => {
    await seedFootballMatch(db, { id: "9002", kickoff: new Date(NOW_R.getTime() + 80 * MIN), ...NS });
    await seedFootballMatch(db, { id: "9004", kickoff: new Date(NOW_R.getTime() + 180 * MIN), ...NS });
    await seedUsers();
    const f = fakeSender();
    expect((await runPredictionReminder(db, f.sender, NOW_R)).count).toBe(0);
    expect(f.tokens).toEqual([]);
  });

  it("jogo PST ou CANC: não envia", async () => {
    await seedFootballMatch(db, { id: "9002", kickoff: KO_R, ...NS, status: "PST", statusRaw: "PST" });
    await seedFootballMatch(db, { id: "9004", kickoff: KO_R, ...NS, status: "CANC", statusRaw: "CANC" });
    await seedUsers();
    const f = fakeSender();
    expect((await runPredictionReminder(db, f.sender, NOW_R)).count).toBe(0);
    expect(f.tokens).toEqual([]);
  });

  it("outra modalidade: não envia", async () => {
    await seedFootballMatch(db, { id: "9002", kickoff: KO_R, ...NS, sport: "futsal" });
    await seedUsers();
    const f = fakeSender();
    expect((await runPredictionReminder(db, f.sender, NOW_R)).count).toBe(0);
  });

  it("token inválido apaga users/{uid}/devices/{token}", async () => {
    await seedFootballMatch(db, { id: "9002", kickoff: KO_R, ...NS });
    await seedUsers();
    const f = fakeSender({ invalid: ["ana-t2"] });
    const r = await runPredictionReminder(db, f.sender, NOW_R);
    expect(r.count).toBe(1);
    expect((await db.doc("users/ana/devices/ana-t2").get()).exists).toBe(false);
    expect((await db.doc("users/ana/devices/ana-t1").get()).exists).toBe(true);
  });

  it("o mesmo token em duas contas sai uma vez", async () => {
    await seedFootballMatch(db, { id: "9002", kickoff: KO_R, ...NS });
    await seedUsers();
    await db.doc("users/eva/devices/ana-t1").set({ token: "ana-t1", platform: "ios", updatedAt: Timestamp.fromDate(NOW_R) });
    await db.doc("users/eva").set({ email: "eva@exemplo.pt", displayName: "Eva Lopes" });
    const f = fakeSender();
    await runPredictionReminder(db, f.sender, NOW_R);
    expect(f.tokens[0].tokens.sort()).toEqual(["ana-t1", "ana-t2", "eva-t1"]);
  });

  it("o mesmo token em várias contas: conta só o documento com o updatedAt mais recente", async () => {
    await seedFootballMatch(db, { id: "9002", kickoff: KO_R, ...NS });
    await seedUsers();
    // ana-t1 passou para a eva (sessão mais recente neste telemóvel); a eva tem o lembrete desligado.
    await db.doc("users/eva/devices/ana-t1").set({ token: "ana-t1", platform: "ios", updatedAt: Timestamp.fromDate(new Date(NOW_R.getTime() + MIN)) });
    // rui-t1 (o rui tem o lembrete desligado) é agora da conta nova "ines", sem preferências: recebe.
    await db.doc("users/ines").set({ email: "ines@exemplo.pt" });
    await db.doc("users/ines/devices/rui-t1").set({ token: "rui-t1", platform: "android", updatedAt: Timestamp.fromDate(new Date(NOW_R.getTime() + MIN)) });
    const f = fakeSender();
    const r = await runPredictionReminder(db, f.sender, NOW_R);
    expect(f.tokens[0].tokens.sort()).toEqual(["ana-t2", "rui-t1"]);
    expect(r.count).toBe(2);
  });

  it("token inválido apaga o documento em todas as contas onde aparece", async () => {
    await seedFootballMatch(db, { id: "9002", kickoff: KO_R, ...NS });
    await seedUsers();
    await db.doc("users/rui/devices/ana-t2").set({ token: "ana-t2", platform: "android", updatedAt: Timestamp.fromDate(new Date(NOW_R.getTime() - MIN)) });
    const f = fakeSender({ invalid: ["ana-t2"] });
    await runPredictionReminder(db, f.sender, NOW_R);
    expect((await db.doc("users/ana/devices/ana-t2").get()).exists).toBe(false);
    expect((await db.doc("users/rui/devices/ana-t2").get()).exists).toBe(false);
  });

  it("FCM falha em todos os tokens: marca libertada e a execução seguinte tenta outra vez", async () => {
    await seedFootballMatch(db, { id: "9002", kickoff: KO_R, ...NS });
    await seedUsers();
    const f = fakeSender();
    f.failNext(1);
    expect((await runPredictionReminder(db, f.sender, NOW_R)).count).toBe(0);
    expect((await db.doc("ingestState/match_9002").get()).get("push.reminderSentAt")).toBeUndefined();
    expect((await runPredictionReminder(db, f.sender, new Date(NOW_R.getTime() + 5 * MIN))).count).toBe(2);
  });

  it("sem dispositivos: marca não fica gravada e count 0", async () => {
    await seedFootballMatch(db, { id: "9002", kickoff: KO_R, ...NS });
    await db.doc("users/ana").set({ email: "ana@exemplo.pt" });
    const f = fakeSender();
    expect((await runPredictionReminder(db, f.sender, NOW_R)).count).toBe(0);
    expect(f.tokens).toEqual([]);
    expect((await db.doc("ingestState/match_9002").get()).get("push.reminderSentAt")).toBeUndefined();
  });
});
