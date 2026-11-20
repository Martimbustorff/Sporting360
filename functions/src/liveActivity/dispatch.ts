import { logger } from "firebase-functions";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { EventItem } from "../football/mapFixture";
import { FINAL_STATUSES, LIVE_STATUSES } from "../model/status";
import type { MatchDoc } from "../model/types";
import { sendOnce } from "../push/markers";
import { activityProps, activitySignature } from "./props";
import type { ActivityPush, ActivityTarget, LiveActivitySender } from "./sender";

// Jogo no ecrã de bloqueio (Plano 10, ponto 2). Martim 20/11: automático em todos os jogos de futebol do Sporting,
// só iPhone. Arranca ao primeiro tick ao vivo para todos os dispositivos com token de "push-to-start"
// (users/{uid}/liveActivityDevices); atualiza quando o resultado, a fase ou o último golo mudam, para as atividades
// que os telemóveis registaram (users/{uid}/liveActivities, por jogo); termina no fim e sai do ecrã 15 min depois.
// Marcas em ingestState/match_{id}.liveActivity: re-syncs e ticks repetidos não duplicam.

export const DEVICES = "liveActivityDevices";
export const ACTIVITIES = "liveActivities";
/** O iOS tira a atividade terminada do ecrã de bloqueio ao fim deste tempo. */
export const DISMISS_AFTER_MS = 15 * 60_000;
/** Sem novidades durante este tempo, o iOS mostra a atividade como desatualizada. */
export const STALE_AFTER_MS = 70 * 60_000; // mais do que uma parte sem mudanças (0-0)

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

async function startTargets(db: Firestore): Promise<ActivityTarget[]> {
  const snap = await db.collectionGroup(DEVICES).get();
  return snap.docs.flatMap((d) => {
    const fcmToken = str(d.get("fcmToken"));
    const activityToken = str(d.get("pushToStartToken"));
    return fcmToken && activityToken ? [{ path: d.ref.path, fcmToken, activityToken, dir: str(d.get("dir")) }] : [];
  });
}

async function activityTargets(db: Firestore, matchId: string): Promise<ActivityTarget[]> {
  const snap = await db.collectionGroup(ACTIVITIES).where("matchId", "==", matchId).get();
  return snap.docs.flatMap((d) => {
    const fcmToken = str(d.get("fcmToken"));
    const activityToken = str(d.get("activityToken"));
    return fcmToken && activityToken ? [{ path: d.ref.path, fcmToken, activityToken, dir: str(d.get("dir")) }] : [];
  });
}

async function prune(db: Firestore, invalid: ActivityTarget[]): Promise<void> {
  await Promise.all(invalid.map((t) => db.doc(t.path).delete().catch(() => undefined)));
}

/** Compara e grava a assinatura numa transação: dois ticks seguidos com a mesma mudança só enviam uma vez. */
async function claimChange(db: Firestore, docPath: string, sig: string, final: boolean): Promise<boolean> {
  const ref = db.doc(docPath);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.get("liveActivity.startedAt") == null || snap.get("liveActivity.endedAt") != null) return false;
    if (snap.get("liveActivity.sig") === sig && !final) return false;
    tx.set(ref, { liveActivity: { sig, ...(final ? { endedAt: FieldValue.serverTimestamp() } : {}) } }, { merge: true });
    return true;
  });
}

export async function dispatchLiveActivity(
  db: Firestore,
  sender: LiveActivitySender,
  m: MatchDoc,
  events: EventItem[],
  now: Date,
): Promise<{ event: "start" | "update" | "end" | null; sent: number }> {
  if (m.sport !== "football") return { event: null, sent: 0 };
  const live = LIVE_STATUSES.has(m.status);
  const final = FINAL_STATUSES.has(m.status);
  if (!live && !final) return { event: null, sent: 0 };
  const docPath = `ingestState/match_${m.id}`;
  const staleAt = new Date(now.getTime() + STALE_AFTER_MS);
  const push = (target: ActivityTarget, event: ActivityPush["event"], extra: Partial<ActivityPush> = {}): ActivityPush => ({
    target,
    event,
    props: activityProps(m, events, now, target.dir),
    now,
    ...extra,
  });

  if (live) {
    let sent = 0;
    const r = await sendOnce(db, docPath, ["liveActivity", "startedAt"], now, async () => {
      const targets = await startTargets(db);
      const out = await sender.send(targets.map((t) => push(t, "start", { staleAt })));
      await prune(db, out.invalid);
      sent = out.sent;
      await db.doc(docPath).set({ liveActivity: { sig: activitySignature(activityProps(m, events, now, null)) } }, { merge: true });
    });
    if (r === "sent") return { event: "start", sent };
    if (r === "failed") return { event: null, sent: 0 };
  }

  const sig = activitySignature(activityProps(m, events, now, null));
  if (!(await claimChange(db, docPath, sig, final))) return { event: null, sent: 0 };
  const event = final ? "end" : "update";
  const targets = await activityTargets(db, m.id);
  const out = await sender.send(
    targets.map((t) => push(t, event, final ? { dismissAt: new Date(now.getTime() + DISMISS_AFTER_MS) } : { staleAt })),
  );
  await prune(db, out.invalid);
  if (out.failed > 0) logger.warn("liveActivity: envios falhados", { matchId: m.id, event, failed: out.failed });
  return { event, sent: out.sent };
}
