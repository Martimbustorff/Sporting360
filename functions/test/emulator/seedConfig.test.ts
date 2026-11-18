import { initializeApp, getApps, deleteApp } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { seedConfig } from "../../scripts/seed-config";
import type { AppConfig } from "../../src/config/appConfig";
import seedJson from "../../seed/config-app.json";

let db: Firestore;
const seed: AppConfig = seedJson;

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  db = getFirestore(initializeApp({ projectId: "demo-scp360" }, "seed-config-test"));
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});
beforeEach(async () => {
  await db.doc("config/app").delete();
});

describe("seedConfig", () => {
  it("cria o documento quando não existe", async () => {
    expect(await seedConfig(db, seed, { force: false })).toBe("created");
    const d = (await db.doc("config/app").get()).data()!;
    expect(d.minVersion).toEqual({ ios: "0.0.0", android: "0.0.0" });
    expect(d.updatedAt).toBeDefined();
  });

  it("não mexe num documento existente", async () => {
    await db.doc("config/app").set({ minVersion: { ios: "2.0.0", android: "2.0.0" }, custom: true });
    expect(await seedConfig(db, seed, { force: false })).toBe("exists");
    expect((await db.doc("config/app").get()).data()).toEqual({ minVersion: { ios: "2.0.0", android: "2.0.0" }, custom: true });
  });

  it("com force substitui o documento", async () => {
    await db.doc("config/app").set({ custom: true });
    expect(await seedConfig(db, seed, { force: true })).toBe("overwritten");
    const d = (await db.doc("config/app").get()).data()!;
    expect(d.custom).toBeUndefined();
    expect(d.texts).toEqual(seed.texts);
  });

  it("o JSON de seed tem os textos esperados pela app", () => {
    expect(seed.texts).toEqual({
      updateRequiredTitle: "Atualização obrigatória",
      updateRequiredBody: "Há uma versão nova da S360. Atualiza a app para continuar.",
      updateButton: "Atualizar",
    });
    expect(seed.minVersion).toEqual({ ios: "0.0.0", android: "0.0.0" });
  });
});
