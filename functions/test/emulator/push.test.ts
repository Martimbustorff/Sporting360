import { deleteApp, getApps } from "firebase-admin/app";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { sendOnce } from "../../src/push/markers";
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
