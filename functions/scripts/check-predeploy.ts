/* eslint-disable no-console */
// Verificações antes de publicar o Plano 2 (e de novo antes das regras). SÓ LEITURA.
//
//   npx tsx scripts/check-predeploy.ts --project scp360-37a74 [--skip-functions]
//
// (a) `rankings`: `season` string aaaa-aaaa e id == `${userId}_${season}` (senão as regras novas negam
//     as atualizações da V2 nesses documentos; passagem do Plano 1, Task 3);
// (b) nenhum `predictions` nem `manofmatch` com o campo `source` (reservado aos documentos do servidor;
//     passagem do Plano 1, Task 9);
// (c) as functions publicadas (`firebase functions:list --json`) são só as 13 antigas em us-central1
//     e as v2027 em europe-west1; qualquer outra (ex. um `cleanup` antigo) falha;
// (d) informativo: documentos já existentes nas coleções do motor novo (o corte do Plano 5 apaga-os).
// Imprime as contagens e sai com código 1 se (a), (b) ou (c) falharem.
import { execFileSync } from "node:child_process";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { LEGACY_FUNCTIONS, LEGACY_REGION, V2027_FUNCTIONS, V2027_REGION } from "./deployLists";

type Doc = { id: string; data: DocumentData };
const SEASON = /^\d{4}-\d{4}$/;

/** Rankings fora do formato, com o motivo. */
export function checkRankings(docs: Doc[]): { id: string; reason: string }[] {
  const bad: { id: string; reason: string }[] = [];
  for (const { id, data } of docs) {
    const season = data.season;
    if (typeof season !== "string") bad.push({ id, reason: `season não é string (${JSON.stringify(season)})` });
    else if (!SEASON.test(season)) bad.push({ id, reason: `season fora do formato aaaa-aaaa (${season})` });
    else if (typeof data.userId !== "string" || id !== `${data.userId}_${season}`) bad.push({ id, reason: `id diferente de userId_season (userId ${JSON.stringify(data.userId)})` });
  }
  return bad;
}

/** Ids dos documentos que têm o campo `source` (mesmo a null). */
export function checkNoSource(docs: Doc[]): string[] {
  return docs.filter((d) => "source" in d.data).map((d) => d.id);
}

export type DeployedFunction = { id: string; region: string; codebase?: string };

/** Lê a saída de `firebase functions:list --json` (`{ status, result: [endpoint] }`). */
export function parseFunctionsList(stdout: string): DeployedFunction[] {
  const out = JSON.parse(stdout) as { status?: string; error?: string; result?: { id: string; region: string; codebase?: string }[] };
  if (out.status !== "success" || !Array.isArray(out.result)) throw new Error(`firebase functions:list falhou: ${out.error ?? stdout.slice(0, 200)}`);
  return out.result.map((e) => ({ id: e.id, region: e.region, codebase: e.codebase }));
}

/** Classifica as functions publicadas: antigas conhecidas, v2027 conhecidas e desconhecidas. */
export function checkFunctions(fns: DeployedFunction[]): { legacy: string[]; v2027: string[]; unknown: string[]; legacyMissing: string[] } {
  const legacyNames = new Set<string>(LEGACY_FUNCTIONS);
  const v2027Names = new Set<string>(V2027_FUNCTIONS);
  const legacy: string[] = [];
  const v2027: string[] = [];
  const unknown: string[] = [];
  for (const f of fns) {
    if (legacyNames.has(f.id) && f.region === LEGACY_REGION) legacy.push(f.id);
    else if (v2027Names.has(f.id) && f.region === V2027_REGION) v2027.push(f.id);
    else unknown.push(`${f.id} (${f.region})`);
  }
  return { legacy, v2027, unknown, legacyMissing: LEGACY_FUNCTIONS.filter((n) => !legacy.includes(n)) };
}

async function scan(db: Firestore, col: string, fields: string[]): Promise<Doc[]> {
  const snap = await db.collection(col).select(...fields).get();
  return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
}

/** Coleções do motor v2027 (Plano 1); devem estar vazias ou só com dados de teste antes da publicação. */
export const ENGINE_COLLECTIONS = ["matchPredictions", "mvpVotes", "pointEvents", "leaderboards", "settlements"] as const;

export type FirestoreReport = {
  rankings: number;
  badRankings: { id: string; reason: string }[];
  predictions: number;
  manofmatch: number;
  withSource: { predictions: string[]; manofmatch: string[] };
  engine: Record<string, number>;
};

export async function checkFirestore(db: Firestore): Promise<FirestoreReport> {
  const rankings = await scan(db, "rankings", ["season", "userId"]);
  const predictions = await scan(db, "predictions", ["source"]);
  const manofmatch = await scan(db, "manofmatch", ["source"]);
  const engine: Record<string, number> = {};
  for (const c of ENGINE_COLLECTIONS) engine[c] = (await db.collection(c).count().get()).data().count;
  return {
    rankings: rankings.length,
    badRankings: checkRankings(rankings),
    predictions: predictions.length,
    manofmatch: manofmatch.length,
    withSource: { predictions: checkNoSource(predictions), manofmatch: checkNoSource(manofmatch) },
    engine,
  };
}

export function firestoreFailures(r: FirestoreReport): string[] {
  const out: string[] = [];
  if (r.badRankings.length) out.push(`${r.badRankings.length} rankings fora do formato`);
  if (r.withSource.predictions.length) out.push(`${r.withSource.predictions.length} predictions com source`);
  if (r.withSource.manofmatch.length) out.push(`${r.withSource.manofmatch.length} manofmatch com source`);
  return out;
}

function listFunctions(project: string): DeployedFunction[] {
  const stdout = execFileSync("npx", ["firebase", "functions:list", "--json", "--project", project], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  return parseFunctionsList(stdout);
}

async function main(): Promise<void> {
  const i = process.argv.indexOf("--project");
  const project = i >= 0 ? process.argv[i + 1] : undefined;
  if (process.argv.includes("--help") || !project) {
    console.log("Uso: npx tsx scripts/check-predeploy.ts --project <id> [--skip-functions]\nSó leitura. Sai com código 1 se alguma verificação falhar.");
    if (!project) process.exitCode = 1;
    return;
  }
  const app = getApps()[0] ?? initializeApp({ projectId: project });
  const fs = await checkFirestore(getFirestore(app));
  const failures = firestoreFailures(fs);

  console.log(`rankings: ${fs.rankings} documentos, ${fs.badRankings.length} fora do formato`);
  for (const b of fs.badRankings.slice(0, 50)) console.log(`  ${b.id}: ${b.reason}`);
  console.log(`predictions: ${fs.predictions} documentos, ${fs.withSource.predictions.length} com source ${fs.withSource.predictions.slice(0, 20).join(" ")}`);
  console.log(`manofmatch: ${fs.manofmatch} documentos, ${fs.withSource.manofmatch.length} com source ${fs.withSource.manofmatch.slice(0, 20).join(" ")}`);
  console.log(`motor v2027 (informativo): ${Object.entries(fs.engine).map(([k, v]) => `${k} ${v}`).join(", ")}`);

  if (!process.argv.includes("--skip-functions")) {
    const r = checkFunctions(listFunctions(project));
    console.log(`functions antigas (${LEGACY_REGION}): ${r.legacy.length}/${LEGACY_FUNCTIONS.length}${r.legacyMissing.length ? `; em falta: ${r.legacyMissing.join(" ")}` : ""}`);
    console.log(`functions v2027 (${V2027_REGION}): ${r.v2027.length}${r.v2027.length ? ` (${r.v2027.join(" ")})` : ""}`);
    if (r.unknown.length) {
      console.log(`functions desconhecidas: ${r.unknown.join(", ")}`);
      failures.push(`${r.unknown.length} functions fora das listas`);
    }
  }

  if (failures.length) {
    console.log(`FALHOU: ${failures.join("; ")}`);
    process.exitCode = 1;
  } else {
    console.log("OK: todas as verificações passaram.");
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
}
