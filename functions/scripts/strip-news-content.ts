/* eslint-disable no-console */
// Apaga o campo `content` de todos os documentos de `news` (depois do corte, quando a V2 já não existe).
// Por omissão é um ensaio: só conta. Apagar a sério exige --apply. Usa credenciais ADC. Só corre em testes contra o emulador; nunca contra um projeto real sem decisão do Martim.
//
//   npx tsx scripts/strip-news-content.ts --project <id> [--apply]
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

export type CliArgs = { ok: true; project: string; apply: boolean } | { ok: false; message: string };

const USAGE = "Uso: npx tsx scripts/strip-news-content.ts --project <id> [--apply]\n  sem --apply  ensaio: só conta, não apaga nada\n  --apply      apaga o content (depois de mostrar o projeto e a contagem)";

/** Lê os argumentos. `--project` é obrigatório e `--dry-run` já não existe (o ensaio é o comportamento por omissão). */
export function parseArgs(argv: string[]): CliArgs {
  if (argv.includes("--dry-run")) return { ok: false, message: `--dry-run foi removido: sem --apply já é um ensaio.\n${USAGE}` };
  const i = argv.indexOf("--project");
  const project = i >= 0 ? argv[i + 1] : undefined;
  if (!project || project.startsWith("--")) return { ok: false, message: USAGE };
  return { ok: true, project, apply: argv.includes("--apply") };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.ok) {
    console.error(args.message);
    process.exitCode = 1;
    return;
  }
  const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: args.project }));
  const plan = await stripNewsContent(db, { dryRun: true });
  console.log(`${args.project}: ${plan.scanned} notícias lidas, ${plan.stripped} com content.`);
  if (!args.apply) {
    console.log("Ensaio: nada foi alterado. Para apagar, repetir com --apply.");
    return;
  }
  console.log(`A apagar o content de ${plan.stripped} notícias em ${args.project}...`);
  const r = await stripNewsContent(db, { dryRun: false });
  console.log(`${args.project}: content apagado em ${r.stripped} de ${r.scanned} notícias.`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
