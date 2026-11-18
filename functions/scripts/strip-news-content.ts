/* eslint-disable no-console */
// Apaga o campo `content` de todos os documentos de `news` (depois do corte, quando a V2 já não existe).
// Usa credenciais ADC. Só corre em testes contra o emulador; nunca contra um projeto real sem decisão do Martim.
//
//   npx tsx scripts/strip-news-content.ts --project <id> [--dry-run]
import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, type Firestore } from "firebase-admin/firestore";

const BATCH = 400;

/** Percorre `news` e apaga `content` (lotes de 400). Com `dryRun` só conta. */
export async function stripNewsContent(db: Firestore, o: { dryRun: boolean }): Promise<{ scanned: number; stripped: number }> {
  const snap = await db.collection("news").get();
  const withContent = snap.docs.filter((d) => d.data().content !== undefined);
  if (!o.dryRun) {
    for (let i = 0; i < withContent.length; i += BATCH) {
      const batch = db.batch();
      for (const d of withContent.slice(i, i + BATCH)) batch.update(d.ref, { content: FieldValue.delete() });
      await batch.commit();
    }
  }
  return { scanned: snap.size, stripped: withContent.length };
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const project = arg("--project");
  if (process.argv.includes("--help") || !project) {
    console.log("Uso: npx tsx scripts/strip-news-content.ts --project <id> [--dry-run]\n  --dry-run  só conta, não apaga nada");
    return;
  }
  const dryRun = process.argv.includes("--dry-run");
  const app = getApps()[0] ?? initializeApp({ projectId: project });
  const r = await stripNewsContent(getFirestore(app), { dryRun });
  console.log(`${project}: ${r.scanned} notícias lidas, ${r.stripped} ${dryRun ? "teriam o content apagado (dry-run)" : "com content apagado"}`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
