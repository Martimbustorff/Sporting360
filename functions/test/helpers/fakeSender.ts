import type { PushMessage, PushTopic } from "../../src/push/messages";
import type { PushSender } from "../../src/push/sender";

/** PushSender falso: guarda os envios; `failNext(n)` faz lançar os próximos `n` envios. */
export function fakeSender(o: { invalid?: string[] } = {}) {
  const topics: { topic: PushTopic; msg: PushMessage }[] = [];
  const tokens: { tokens: string[]; msg: PushMessage }[] = [];
  let failing = 0;
  const shouldFail = () => {
    if (failing > 0) {
      failing--;
      return true;
    }
    return false;
  };
  const sender: PushSender = {
    async toTopic(topic, msg) {
      if (shouldFail()) throw new Error("fcm falhou");
      topics.push({ topic, msg });
    },
    async toTokens(list, msg) {
      if (shouldFail()) throw new Error("fcm falhou");
      tokens.push({ tokens: [...list], msg });
      const invalid = list.filter((t) => o.invalid?.includes(t));
      return { sent: list.length - invalid.length, failed: invalid.length, invalid };
    },
  };
  return {
    sender,
    topics,
    tokens,
    failNext(n: number) {
      failing = n;
    },
  };
}
