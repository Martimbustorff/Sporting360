import { deleteApp, getApps } from "firebase-admin/app";
import type { Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { recordRun, runJob } from "../../src/store/health";
import { clearAll, testDb } from "../helpers/emulatorDb";

let db: Firestore;
beforeAll(() => {
  db = testDb("health-test");
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});
beforeEach(async () => {
  await clearAll(db);
  jest.restoreAllMocks();
});

describe("recordRun", () => {
  it("conta falhas consecutivas e repõe a 0 com sucesso", async () => {
    const spy = jest.spyOn(logger, "error").mockImplementation(() => undefined);
    for (let i = 0; i < 3; i++) await recordRun(db, "x", { ok: false, error: "boom" });
    let d = (await db.doc("ingestHealth/x").get()).data()!;
    expect(d.consecutiveFailures).toBe(3);
    expect(d.lastError).toBe("boom");
    expect(spy).toHaveBeenCalledWith("INGEST_ALERT", expect.objectContaining({ source: "x" }));
    await recordRun(db, "x", { ok: true, count: 5, remaining: 900 });
    d = (await db.doc("ingestHealth/x").get()).data()!;
    expect(d.consecutiveFailures).toBe(0);
    expect(d.lastError).toBeNull();
    expect(d.lastCount).toBe(5);
    expect(d.remaining).toBe(900);
    expect(d.lastOkAt).toBeDefined();
  });

  it("expectNonZero com count 0 alerta", async () => {
    const spy = jest.spyOn(logger, "error").mockImplementation(() => undefined);
    await recordRun(db, "y", { ok: true, count: 0 }, { expectNonZero: true });
    expect(spy).toHaveBeenCalledWith("INGEST_ALERT", expect.objectContaining({ source: "y" }));
  });

  it("sem condições de alerta não regista erro", async () => {
    const spy = jest.spyOn(logger, "error").mockImplementation(() => undefined);
    await recordRun(db, "z", { ok: true, count: 0 });
    await recordRun(db, "z", { ok: true, count: 3, remaining: 800 }, { minRemaining: 500 });
    expect(spy).not.toHaveBeenCalled();
  });

  it("remaining abaixo do mínimo alerta", async () => {
    const spy = jest.spyOn(logger, "error").mockImplementation(() => undefined);
    await recordRun(db, "q", { ok: true, count: 3, remaining: 100 }, { minRemaining: 500 });
    expect(spy).toHaveBeenCalledWith("INGEST_ALERT", expect.objectContaining({ source: "q", reason: expect.stringContaining("100") }));
  });
});

describe("runJob", () => {
  it("não relança e regista a mensagem de erro", async () => {
    jest.spyOn(logger, "error").mockImplementation(() => undefined);
    await expect(runJob(db, "x", async () => { throw new Error("falhou"); })).resolves.toBeUndefined();
    expect((await db.doc("ingestHealth/x").get()).get("lastError")).toContain("falhou");
  });

  it("regista sucesso", async () => {
    await runJob(db, "ok", async () => ({ count: 7, remaining: 1000 }));
    expect((await db.doc("ingestHealth/ok").get()).get("lastCount")).toBe(7);
  });
});
