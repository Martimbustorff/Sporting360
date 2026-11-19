import { Timestamp, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import { gameStateOf } from "../data/gamesRepo";
import { listFootballWindow } from "../football/fixturesSync";
import { predictionOpen } from "../game/windows";
import type { MatchDoc } from "../model/types";
import { sendOnce } from "./markers";
import { predictionReminderMessage } from "./messages";
import type { PushSender } from "./sender";

/** O lembrete sai a partir de 2 h antes do kickoff... */
export const REMINDER_LEAD_MS = 2 * 60 * 60_000;
/** ...e até 90 min antes (com a function de 5 em 5 min, várias tentativas se o FCM falhar). */
export const REMINDER_LATEST_MS = 90 * 60_000;

/** Lotes de `getAll` (limite prático de documentos por pedido). */
const GET_ALL_BATCH = 300;

/** Sem `notificationPrefs`: tudo ligado. Com o objeto, uma chave em falta conta como desligada. */
export function remindersOn(user: Record<string, unknown> | undefined): boolean {
  const prefs = user?.notificationPrefs;
  if (prefs === undefined || prefs === null) return true;
  return typeof prefs === "object" && (prefs as Record<string, unknown>).predictionReminder === true;
}

async function getAllBatched(db: Firestore, refs: DocumentReference[]) {
  const out = [];
  for (let i = 0; i < refs.length; i += GET_ALL_BATCH) {
    const part = refs.slice(i, i + GET_ALL_BATCH);
    if (part.length > 0) out.push(...(await db.getAll(...part)));
  }
  return out;
}

function millis(v: unknown): number {
  return v instanceof Timestamp ? v.toMillis() : v instanceof Date ? v.getTime() : 0;
}

/**
 * Dispositivos por utilizador, a partir de `users/{uid}/devices/{token}`. O mesmo token em várias contas
 * (sair e entrar com outra sem o desregisto chegar) conta só na do `updatedAt` mais recente: é a sessão atual
 * desse telemóvel. `refsByToken` guarda todos os documentos de cada token, para apagar os inválidos.
 */
async function loadDevices(db: Firestore): Promise<{
  byUser: Map<string, { token: string; ref: DocumentReference }[]>;
  refsByToken: Map<string, DocumentReference[]>;
}> {
  const snap = await db.collectionGroup("devices").get();
  const latest = new Map<string, { uid: string; ref: DocumentReference; at: number }>();
  const refsByToken = new Map<string, DocumentReference[]>();
  for (const d of snap.docs) {
    const user = d.ref.parent.parent;
    if (!user || user.parent.id !== "users") continue;
    refsByToken.set(d.id, [...(refsByToken.get(d.id) ?? []), d.ref]);
    const at = millis(d.get("updatedAt"));
    const cur = latest.get(d.id);
    if (!cur || at > cur.at) latest.set(d.id, { uid: user.id, ref: d.ref, at });
  }
  const byUser = new Map<string, { token: string; ref: DocumentReference }[]>();
  for (const [token, { uid, ref }] of latest) byUser.set(uid, [...(byUser.get(uid) ?? []), { token, ref }]);
  return { byUser, refsByToken };
}

/**
 * Lembrete de prognóstico, por token: só dispositivos de quem tem `predictionReminder` ligado e
 * ainda não tem `matchPredictions/{gameId}_{uid}`. Uma vez por jogo (`push.reminderSentAt`).
 * `count` = tokens a que o FCM aceitou a mensagem.
 */
export async function runPredictionReminder(db: Firestore, sender: PushSender, now: Date): Promise<{ count: number }> {
  const window = await listFootballWindow(
    db,
    new Date(now.getTime() + REMINDER_LATEST_MS),
    new Date(now.getTime() + REMINDER_LEAD_MS),
  );
  const open = window.filter((m) => predictionOpen(gameStateOf(m), now));
  const pending: MatchDoc[] = [];
  for (const m of open) {
    const marker = (await db.doc(`ingestState/match_${m.id}`).get()).get("push.reminderSentAt");
    if (marker == null) pending.push(m);
  }
  if (pending.length === 0) return { count: 0 };

  const { byUser: devices, refsByToken } = await loadDevices(db);
  if (devices.size === 0) return { count: 0 };
  const uids = [...devices.keys()];
  const users = await getAllBatched(db, uids.map((u) => db.doc(`users/${u}`)));
  // Sem documento users/{uid} (conta a meio de ser apagada): não envia.
  const wanting = users.filter((u) => u.exists && remindersOn(u.data())).map((u) => u.id);

  let count = 0;
  for (const m of pending) {
    const predictions = await getAllBatched(db, wanting.map((u) => db.doc(`matchPredictions/${m.id}_${u}`)));
    const predicted = new Set(predictions.filter((p) => p.exists).map((p) => p.id.slice(m.id.length + 1)));
    const targets = wanting.filter((u) => !predicted.has(u)).flatMap((u) => devices.get(u) ?? []);
    const tokens = [...new Set(targets.map((t) => t.token))];
    if (tokens.length === 0) continue;

    let result: { sent: number; failed: number; invalid: string[] } | null = null;
    await sendOnce(db, `ingestState/match_${m.id}`, ["push", "reminderSentAt"], now, async () => {
      result = await sender.toTokens(tokens, predictionReminderMessage(m));
      // Nenhum token aceite por falha do FCM (não por tokens inválidos): liberta a marca e tenta daqui a 5 min.
      if (result.sent === 0 && result.failed > result.invalid.length) throw new Error("FCM recusou todos os tokens");
    });
    if (!result) continue;
    const r: { sent: number; invalid: string[] } = result;
    count += r.sent;
    await Promise.all(r.invalid.flatMap((t) => refsByToken.get(t) ?? []).map((ref) => ref.delete()));
  }
  return { count };
}
