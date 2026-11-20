import { initializeApp, getApps, deleteApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { clearAll } from "../helpers/emulatorDb";
import { dispatchLiveActivity, DISMISS_AFTER_MS } from "../../src/liveActivity/dispatch";
import { activityMessage, type ActivityPush, type LiveActivitySender } from "../../src/liveActivity/sender";
import type { MatchDoc } from "../../src/model/types";

let db: Firestore;
const NOW = new Date("2026-12-21T20:35:00Z");

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  db = getFirestore(initializeApp({ projectId: "demo-scp360" }, "live-activity-test"));
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});
beforeEach(async () => {
  await clearAll(db);
});

function fake(invalidTokens: string[] = []) {
  const calls: ActivityPush[][] = [];
  const sender: LiveActivitySender = {
    async send(pushes) {
      calls.push(pushes);
      const invalid = pushes.filter((p) => invalidTokens.includes(p.target.activityToken)).map((p) => p.target);
      return { sent: pushes.length - invalid.length, failed: invalid.length, invalid };
    },
  };
  return { sender, calls };
}

const match = (over: Partial<MatchDoc> = {}): MatchDoc =>
  ({
    id: "g1",
    sport: "football",
    competition: { key: "liga", id: "94", name: "Liga Portugal", type: "league", season: "2026", round: "Regular Season - 12", roundLabel: null },
    home: { id: "228", name: "Sporting CP", logo: null },
    away: { id: "212", name: "FC Porto", logo: null },
    sportingSide: "home",
    kickoff: new Date("2026-12-21T20:30:00Z"),
    status: "LIVE",
    statusRaw: "1H",
    elapsed: 5,
    elapsedExtra: null,
    score: { home: 0, away: 0, halftime: null, extratime: null, penalty: null },
    finishedAt: null,
    finishedAtSource: null,
    referee: null,
    source: { provider: "api-football", id: "g1" },
    ...over,
  }) as MatchDoc;

async function seedDevices() {
  await db.doc("users/u1/liveActivityDevices/fcm1").set({ fcmToken: "fcm1", pushToStartToken: "pts1", dir: "/g1" });
  await db.doc("users/u2/liveActivityDevices/fcm2").set({ fcmToken: "fcm2", pushToStartToken: "pts2", dir: null });
  await db.doc("users/u3/liveActivityDevices/fcm3").set({ fcmToken: "fcm3" }); // sem push-to-start: fica de fora
}
async function seedActivities() {
  await db.doc("users/u1/liveActivities/a1").set({ matchId: "g1", activityToken: "act1", fcmToken: "fcm1", dir: "/g1" });
  await db.doc("users/u2/liveActivities/a2").set({ matchId: "g1", activityToken: "act2", fcmToken: "fcm2", dir: null });
  await db.doc("users/u2/liveActivities/old").set({ matchId: "g0", activityToken: "act0", fcmToken: "fcm2", dir: null });
}

describe("dispatchLiveActivity", () => {
  it("primeiro tick ao vivo: arranca em todos os dispositivos com push-to-start, uma só vez", async () => {
    await seedDevices();
    const { sender, calls } = fake();
    expect(await dispatchLiveActivity(db, sender, match(), [], NOW)).toEqual({ event: "start", sent: 2 });
    expect(calls[0].map((p) => [p.target.activityToken, p.event])).toEqual(
      expect.arrayContaining([["pts1", "start"], ["pts2", "start"]]),
    );
    expect(calls[0].find((p) => p.target.fcmToken === "fcm1")!.props.homeCrest).toBe("/g1/crest_228.png");
    expect(await dispatchLiveActivity(db, sender, match(), [], NOW)).toEqual({ event: null, sent: 0 });
    expect(calls).toHaveLength(1);
  });

  it("golo: atualiza só as atividades deste jogo; o minuto a andar não envia", async () => {
    await seedDevices();
    await seedActivities();
    const { sender, calls } = fake();
    await dispatchLiveActivity(db, sender, match(), [], NOW);
    expect(await dispatchLiveActivity(db, sender, match({ elapsed: 9 }), [], NOW)).toEqual({ event: null, sent: 0 });
    const scored = match({ elapsed: 12, score: { home: 1, away: 0, halftime: null, extratime: null, penalty: null } });
    expect(await dispatchLiveActivity(db, sender, scored, [], NOW)).toEqual({ event: "update", sent: 2 });
    expect(calls[1].map((p) => p.target.activityToken).sort()).toEqual(["act1", "act2"]);
    expect(calls[1][0].props.homeScore).toBe(1);
  });

  it("fim: termina uma vez e sai do ecrã 15 min depois", async () => {
    await seedDevices();
    await seedActivities();
    const { sender, calls } = fake();
    await dispatchLiveActivity(db, sender, match(), [], NOW);
    const ft = match({ status: "FT", statusRaw: "FT", elapsed: 90 });
    expect(await dispatchLiveActivity(db, sender, ft, [], NOW)).toEqual({ event: "end", sent: 2 });
    expect(calls[1][0].dismissAt).toEqual(new Date(NOW.getTime() + DISMISS_AFTER_MS));
    expect(await dispatchLiveActivity(db, sender, ft, [], NOW)).toEqual({ event: null, sent: 0 });
  });

  it("jogo que nunca arrancou não termina nada", async () => {
    const { sender, calls } = fake();
    expect(await dispatchLiveActivity(db, sender, match({ status: "FT", statusRaw: "FT" }), [], NOW)).toEqual({ event: null, sent: 0 });
    expect(calls).toHaveLength(0);
  });

  it("tokens que já não servem são apagados", async () => {
    await seedDevices();
    const { sender } = fake(["pts2"]);
    await dispatchLiveActivity(db, sender, match(), [], NOW);
    expect((await db.doc("users/u2/liveActivityDevices/fcm2").get()).exists).toBe(false);
    expect((await db.doc("users/u1/liveActivityDevices/fcm1").get()).exists).toBe(true);
  });

  it("outras modalidades e jogos por começar: nada", async () => {
    await seedDevices();
    const { sender, calls } = fake();
    await dispatchLiveActivity(db, sender, match({ status: "NS", statusRaw: "NS" }), [], NOW);
    await dispatchLiveActivity(db, sender, match({ sport: "futsal" } as Partial<MatchDoc>), [], NOW);
    expect(calls).toHaveLength(0);
  });
});

describe("activityMessage", () => {
  const target = { path: "x", fcmToken: "fcm1", activityToken: "pts1", dir: null };
  const props = { matchId: "g1", homeName: "SPORTING", awayName: "FC PORTO", phase: "1.ª PARTE" } as ActivityPush["props"];

  it("arranque: live_activity_token, atributos, alerta e o estado com nome e props em texto", () => {
    const msg = activityMessage({ target, event: "start", props, now: NOW }) as { token: string; apns: { liveActivityToken: string; payload: { aps: Record<string, unknown> } } };
    expect(msg.token).toBe("fcm1");
    expect(msg.apns.liveActivityToken).toBe("pts1");
    const aps = msg.apns.payload.aps;
    expect(aps).toMatchObject({ event: "start", "attributes-type": "LiveActivityAttributes", attributes: { url: "s360://jogo/g1" } });
    expect(aps["content-state"]).toEqual({ name: "MatchActivity", props: JSON.stringify(props) });
    expect(aps.alert).toEqual({ title: "SPORTING x FC PORTO", body: "1.ª PARTE" });
  });

  it("atualização: sem atributos nem alerta", () => {
    const aps = (activityMessage({ target, event: "update", props, now: NOW }) as { apns: { payload: { aps: Record<string, unknown> } } }).apns.payload.aps;
    expect(aps).not.toHaveProperty("alert");
    expect(aps).not.toHaveProperty("attributes");
  });
});
