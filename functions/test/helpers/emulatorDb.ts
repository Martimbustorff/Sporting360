import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/** Firestore do emulador (projeto demo-scp360), numa app admin própria por nome. */
export function testDb(name: string): Firestore {
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  const app = getApps().some((a) => a.name === name) ? getApp(name) : initializeApp({ projectId: "demo-scp360" }, name);
  const db = getFirestore(app);
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // settings() só pode ser chamado uma vez por instância
  }
  return db;
}

/** Apaga recursivamente todas as coleções de topo. */
export async function clearAll(db: Firestore): Promise<void> {
  const cols = await db.listCollections();
  await Promise.all(cols.map((c) => db.recursiveDelete(c)));
}
