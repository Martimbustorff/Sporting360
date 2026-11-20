import { logger } from "firebase-functions";
import type { Aps, Message, Messaging } from "firebase-admin/messaging";
import { INVALID_TOKEN_CODES } from "../push/sender";
import { ACTIVITY_NAME, type MatchActivityProps } from "./props";

// Live Activity pelo FCM HTTP v1 (apns.live_activity_token), com a chave APNs que o Firebase já tem para o push.
// Não é uma notificação: o `alert` do arranque é obrigatório para o iOS aceitar o "push-to-start" e só acende o
// ecrã com a atividade, sem som. Sem dados pessoais nos logs.

export type ActivityEvent = "start" | "update" | "end";

export interface ActivityTarget {
  /** Documento a apagar se o token já não servir. */
  path: string;
  fcmToken: string;
  /** Push-to-start (arranque) ou o token da atividade (atualizar e terminar). */
  activityToken: string;
  /** Pasta partilhada (App Group) do dispositivo, para os emblemas. */
  dir: string | null;
}

export interface ActivityPush {
  target: ActivityTarget;
  event: ActivityEvent;
  props: MatchActivityProps;
  now: Date;
  /** Terminar: quando o iOS tira a atividade do ecrã de bloqueio. */
  dismissAt?: Date;
  /** A partir daqui o iOS mostra a atividade como desatualizada. */
  staleAt?: Date;
}

export interface LiveActivitySender {
  /** Nunca lança. `invalid` são os destinos com tokens que já não servem. */
  send(pushes: ActivityPush[]): Promise<{ sent: number; failed: number; invalid: ActivityTarget[] }>;
}

const secs = (d: Date) => Math.floor(d.getTime() / 1000);
const BATCH = 500;

export function activityMessage(p: ActivityPush): Message {
  const aps: Record<string, unknown> = {
    timestamp: secs(p.now),
    event: p.event,
    "content-state": { name: ACTIVITY_NAME, props: JSON.stringify(p.props) },
  };
  if (p.staleAt) aps["stale-date"] = secs(p.staleAt);
  if (p.dismissAt) aps["dismissal-date"] = secs(p.dismissAt);
  if (p.event === "start") {
    aps["attributes-type"] = "LiveActivityAttributes";
    aps.attributes = { url: `s360://jogo/${p.props.matchId}` };
    aps.alert = { title: `${p.props.homeName} x ${p.props.awayName}`, body: p.props.phase };
  }
  return {
    token: p.target.fcmToken,
    apns: {
      liveActivityToken: p.target.activityToken,
      headers: { "apns-priority": "10" },
      payload: { aps: aps as Aps },
    },
  };
}

export function fcmLiveActivitySender(m: Pick<Messaging, "sendEach">): LiveActivitySender {
  return {
    async send(pushes) {
      const out = { sent: 0, failed: 0, invalid: [] as ActivityTarget[] };
      for (let i = 0; i < pushes.length; i += BATCH) {
        const batch = pushes.slice(i, i + BATCH);
        try {
          const r = await m.sendEach(batch.map(activityMessage));
          r.responses.forEach((res, j) => {
            if (res.success) {
              out.sent++;
              return;
            }
            out.failed++;
            if (res.error && INVALID_TOKEN_CODES.includes(res.error.code)) out.invalid.push(batch[j].target);
          });
        } catch (e) {
          out.failed += batch.length;
          logger.warn("liveActivity: lote falhou", { size: batch.length, error: String(e) });
        }
      }
      return out;
    },
  };
}
