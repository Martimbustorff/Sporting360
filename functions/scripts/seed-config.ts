/* eslint-disable no-console */
// Cria `config/app` (versão mínima, textos de atualização obrigatória, Comunidade Leonina).
// Usa credenciais ADC; nunca corre em testes contra um projeto real (os testes usam o emulador).
//
//   npx tsx scripts/seed-config.ts --project <id> [--force]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, Firestore, getFirestore } from "firebase-admin/firestore";
import type { AppConfig } from "../src/config/appConfig";

/** Sem `force` nunca toca num documento existente (a versão mínima pode já ter subido). */
export async function seedConfig(
  db: Firestore,
  data: AppConfig,
  o: { force: boolean },
): Promise<"created" | "exists" | "overwritten"> {
  const ref = db.doc("config/app");
  const doc = { ...data, updatedAt: FieldValue.serverTimestamp() };
  if (o.force) {
    const existed = (await ref.get()).exists;
    await ref.set(doc);
    return existed ? "overwritten" : "created";
  }
  try {
    await ref.create(doc);
    return "created";
  } catch (e) {
    if ((e as { code?: number }).code === 6) return "exists"; // ALREADY_EXISTS
    throw e;
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const project = arg("--project");
  if (process.argv.includes("--help") || !project) {
    console.log("Uso: npx tsx scripts/seed-config.ts --project <id> [--force]\n  --force  substitui config/app se já existir");
    return;
  }
  const data = JSON.parse(readFileSync(resolve(__dirname, "../seed/config-app.json"), "utf8")) as AppConfig;
  const app = getApps()[0] ?? initializeApp({ projectId: project });
  console.log(`${project}: config/app ${await seedConfig(getFirestore(app), data, { force: process.argv.includes("--force") })}`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
