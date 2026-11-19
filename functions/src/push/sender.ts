import { logger } from "firebase-functions";
import type { Messaging } from "firebase-admin/messaging";
import { fcmMessage, type PushMessage, type PushTopic } from "./messages";

/** Envio de notificações. Atrás desta interface fica o Admin SDK; nos testes, um falso. */
export interface PushSender {
  /** Lança se o FCM falhar. */
  toTopic(topic: PushTopic, msg: PushMessage): Promise<void>;
  /** Nunca lança: um lote que falha conta em `failed`. `invalid` são tokens a apagar. */
  toTokens(tokens: string[], msg: PushMessage): Promise<{ sent: number; failed: number; invalid: string[] }>;
}

/** Códigos do FCM que dizem que o token já não serve (app desinstalada, token trocado). */
export const INVALID_TOKEN_CODES = [
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
];

/** Limite do FCM por chamada a `sendEach`. */
const BATCH = 500;

export function fcmSender(m: Pick<Messaging, "send" | "sendEach">): PushSender {
  return {
    async toTopic(topic, msg) {
      await m.send(fcmMessage({ topic }, msg));
    },
    async toTokens(tokens, msg) {
      const out = { sent: 0, failed: 0, invalid: [] as string[] };
      for (let i = 0; i < tokens.length; i += BATCH) {
        const batch = tokens.slice(i, i + BATCH);
        try {
          const r = await m.sendEach(batch.map((token) => fcmMessage({ token }, msg)));
          r.responses.forEach((res, j) => {
            if (res.success) {
              out.sent++;
              return;
            }
            out.failed++;
            if (res.error && INVALID_TOKEN_CODES.includes(res.error.code)) out.invalid.push(batch[j]);
          });
        } catch (e) {
          out.failed += batch.length;
          logger.warn("push: lote de tokens falhou", { size: batch.length, error: String(e) });
        }
      }
      return out;
    },
  };
}
