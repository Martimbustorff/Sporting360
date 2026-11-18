/* eslint-disable no-console */
// Põe o ranking e o motor a zero no dia do lançamento: apaga (recursivamente) as coleções do motor v2027,
// incluindo leaderboards/*/entries e mvpTallies/*/shards. Não toca em users, publicProfiles, matches, config, news
// nem nas coleções da V2. Recusa correr com um jogo de futebol do Sporting a decorrer ou a menos de 6 h.
// Por omissão é um ensaio: só conta. Apagar a sério exige --apply e escrever o id do projeto para confirmar.
// Usa credenciais ADC. Nunca correr contra um projeto real sem decisão do Martim.
//
//   npx tsx scripts/reset-engine.ts --project <id> [--apply]
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import * as readline from "node:readline/promises";
import { ENGINE_COLLECTIONS } from "./check-predeploy";

const WINDOW_MS = 6 * 60 * 60_000;

/** Conta os documentos de cada coleção do motor (incluindo os fantasmas só com subcoleções) e das suas subcoleções (`col/sub`). */
async function countEngine(db: Firestore): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const c of ENGINE_COLLECTIONS) {
    const refs = await db.collection(c).listDocuments();
    counts[c] = refs.length;
    for (const ref of refs) {
      for (const sub of await ref.listCollections()) {
        const key = `${c}/${sub.id}`;
        counts[key] = (counts[key] ?? 0) + (await sub.count().get()).data().count;
      }
    }
  }
  return counts;
}

/** Lança RESET_BLOCKED_LIVE_GAME se houver um jogo de futebol do Sporting LIVE/HT ou com kickoff em now ± 6 h. */
async function assertNoLiveGame(db: Firestore, now: Date): Promise<void> {
  const football = db.collection("matches").where("sport", "==", "football");
  const [live, near] = await Promise.all([
    football.where("status", "in", ["LIVE", "HT"]).get(),
    football
      .where("kickoff", ">=", new Date(now.getTime() - WINDOW_MS))
      .where("kickoff", "<=", new Date(now.getTime() + WINDOW_MS))
      .get(),
  ]);
  // sportingSide != null é só defensivo: nos documentos tipados é sempre verdade.
  const blocking = [...live.docs, ...near.docs].filter((d) => d.get("sportingSide") != null);
  if (blocking.length) {
    const ids = [...new Set(blocking.map((d) => d.id))].join(", ");
    throw new Error(`RESET_BLOCKED_LIVE_GAME: jogo do Sporting a decorrer ou a menos de 6 h (${ids})`);
  }
}

/** Conta e, sem `dryRun`, apaga as coleções do motor (recursiveDelete: inclui subcoleções). */
export async function resetEngine(db: Firestore, o: { dryRun: boolean; now: Date }): Promise<{ counts: Record<string, number>; deleted: boolean }> {
  await assertNoLiveGame(db, o.now);
  const counts = await countEngine(db);
  if (o.dryRun) return { counts, deleted: false };
  for (const c of ENGINE_COLLECTIONS) await db.recursiveDelete(db.collection(c));
  return { counts, deleted: true };
}

export type CliArgs = { ok: true; project: string; apply: boolean } | { ok: false; message: string };

const USAGE = "Uso: npx tsx scripts/reset-engine.ts --project <id> [--apply]\n  sem --apply  ensaio: só conta, não apaga nada\n  --apply      apaga o motor (depois de mostrar o projeto e as contagens e de pedir o id do projeto)";

/** Lê os argumentos. `--project` é obrigatório e `--dry-run` não existe (o ensaio é o comportamento por omissão). */
export function parseArgs(argv: string[]): CliArgs {
  if (argv.includes("--dry-run")) return { ok: false, message: `--dry-run não existe: sem --apply já é um ensaio.\n${USAGE}` };
  const i = argv.indexOf("--project");
  const project = i >= 0 ? argv[i + 1] : undefined;
  if (!project || project.startsWith("--")) return { ok: false, message: USAGE };
  return { ok: true, project, apply: argv.includes("--apply") };
}

export interface RunDeps {
  db: Firestore;
  now: Date;
  /** Pergunta ao operador e devolve o que ele escreveu. */
  prompt: (question: string) => Promise<string>;
  log: (line: string) => void;
}

/** Fluxo do CLI: ensaio por omissão; com --apply mostra projeto e contagens e só apaga se o id escrito for igual. */
export async function runReset(args: { project: string; apply: boolean }, d: RunDeps): Promise<{ deleted: boolean }> {
  const plan = await resetEngine(d.db, { dryRun: true, now: d.now });
  d.log(`${args.project}: ${Object.entries(plan.counts).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  if (!args.apply) {
    d.log("Ensaio: nada foi alterado. Para apagar, repetir com --apply.");
    return { deleted: false };
  }
  const typed = (await d.prompt(`Vai apagar o motor em ${args.project}. Escreva o id do projeto para confirmar: `)).trim();
  if (typed !== args.project) {
    d.log("Id do projeto diferente: abortado, nada foi apagado.");
    return { deleted: false };
  }
  const r = await resetEngine(d.db, { dryRun: false, now: d.now });
  d.log(`${args.project}: motor apagado (${Object.keys(r.counts).length} coleções contadas).`);
  return { deleted: r.deleted };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.ok) {
    console.error(args.message);
    process.exitCode = 1;
    return;
  }
  const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: args.project }));
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const r = await runReset(args, { db, now: new Date(), prompt: (q) => rl.question(q), log: console.log });
    if (args.apply && !r.deleted) process.exitCode = 1;
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
