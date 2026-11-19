import type { Message, Messaging, BatchResponse } from "firebase-admin/messaging";
import { INVALID_TOKEN_CODES, fcmSender } from "../../src/push/sender";
import type { PushMessage } from "../../src/push/messages";

const MSG: PushMessage = { title: "T", body: "B", route: "/jogo/1" };

type FakeMessaging = Pick<Messaging, "send" | "sendEach"> & { send: jest.Mock; sendEach: jest.Mock };

function messaging(o: { badCode?: string; throwOnBatch?: number } = {}): FakeMessaging {
  let batch = 0;
  return {
    send: jest.fn(async () => "id"),
    sendEach: jest.fn(async (msgs: Message[]): Promise<BatchResponse> => {
      const i = batch++;
      if (o.throwOnBatch === i) throw new Error("network");
      const responses = msgs.map((x) => {
        const token = (x as { token: string }).token;
        return token === "bad"
          ? { success: false, error: { code: o.badCode ?? INVALID_TOKEN_CODES[0], message: "x" } as never }
          : { success: true, messageId: "m" };
      });
      const failureCount = responses.filter((r) => !r.success).length;
      return { responses, successCount: responses.length - failureCount, failureCount };
    }),
  };
}

describe("fcmSender", () => {
  it("toTopic manda fcmMessage({ topic })", async () => {
    const m = messaging();
    await fcmSender(m).toTopic("push_mvpOpen", MSG);
    expect(m.send).toHaveBeenCalledTimes(1);
    expect(m.send.mock.calls[0][0]).toMatchObject({ topic: "push_mvpOpen", data: { route: "/jogo/1" } });
  });

  it("toTopic lança se o FCM falhar", async () => {
    const m = messaging();
    m.send.mockRejectedValueOnce(new Error("quota"));
    await expect(fcmSender(m).toTopic("push_mvpOpen", MSG)).rejects.toThrow("quota");
  });

  it("toTokens parte em lotes de 500 e junta invalid", async () => {
    const m = messaging();
    const tokens = Array.from({ length: 1200 }, (_, i) => `t${i}`).concat("bad");
    const r = await fcmSender(m).toTokens(tokens, MSG);
    expect(m.sendEach).toHaveBeenCalledTimes(3);
    expect(m.sendEach.mock.calls.map((c) => (c[0] as Message[]).length)).toEqual([500, 500, 201]);
    expect((m.sendEach.mock.calls[0][0] as Message[])[0]).toMatchObject({ token: "t0", data: { route: "/jogo/1" } });
    expect(r).toEqual({ sent: 1200, failed: 1, invalid: ["bad"] });
  });

  it("toTokens: erro que não é de token inválido conta em failed mas não em invalid", async () => {
    const m = messaging({ badCode: "messaging/internal-error" });
    const r = await fcmSender(m).toTokens(["a", "bad"], MSG);
    expect(r).toEqual({ sent: 1, failed: 1, invalid: [] });
  });

  it("toTokens: um lote que lança conta como failed e os outros seguem", async () => {
    const m = messaging({ throwOnBatch: 1 });
    const tokens = Array.from({ length: 1200 }, (_, i) => `t${i}`);
    const r = await fcmSender(m).toTokens(tokens, MSG);
    expect(m.sendEach).toHaveBeenCalledTimes(3);
    expect(r).toEqual({ sent: 700, failed: 500, invalid: [] });
  });

  it("toTokens([]) não chama o FCM", async () => {
    const m = messaging();
    expect(await fcmSender(m).toTokens([], MSG)).toEqual({ sent: 0, failed: 0, invalid: [] });
    expect(m.sendEach).not.toHaveBeenCalled();
  });
});
