/* eslint-disable no-console */
// Compara as coleções antigas escritas em sombra pelas functions v2027 (`_shadow_<col>`) com as
// escritas pelas functions antigas (`<col>`). SÓ LEITURA: nunca escreve nem apaga nada.
//
//   npx tsx scripts/compare-legacy.ts --project scp360-37a74 --since 2026-12-04T10:00:00Z [opções]
//
// Credenciais: ADC (`gcloud auth application-default login`) ou GOOGLE_APPLICATION_CREDENTIALS.
// Custo: 1 leitura por documento de cada coleção real e sombra (para ver o `updateTime`), mais 2 por
// documento comparado. Antes de ler conta os documentos e pára acima de --max-reads.
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { SPORTING_CREST_URL } from "../src/config/brand";

export const SHADOW_PREFIX = "_shadow_";

/** Coleções antigas que a V2 lê e que as functions v2027 escrevem (contrato do Plano 2). */
export const LEGACY_COLLECTIONS = ["games", "summaries", "stastistics", "lineups", "players", "standings", "videos", "news", "tweets"] as const;
export type LegacyCollection = (typeof LEGACY_COLLECTIONS)[number];

/** Campos que nunca se comparam: marca da ingestão nova. */
const ALWAYS_IGNORE = ["_ingest"];

/**
 * Campos ignorados por coleção (diferenças esperadas por desenho):
 * - games: `isActive` e `endTime` usam o estado real (a antiga usa a janela de 150 min); `channel` é
 *   manual e não existe em sombra; `predictionsSettled` só é escrito pela liquidação (que não corre em sombra).
 */
export const IGNORE_FIELDS: Record<LegacyCollection, string[]> = {
  games: ["isActive", "endTime", "channel", "predictionsSettled"],
  summaries: [],
  stastistics: [],
  lineups: [],
  players: [],
  standings: [],
  videos: [],
  news: [],
  tweets: [],
};

export type Change = { id: string; field: string; a: unknown; b: unknown };
export type Diff = { missing: string[]; extra: string[]; changed: Change[] };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Timestamp) && Object.getPrototypeOf(v) === Object.prototype;
}

function ignored(path: string, ignore: string[]): boolean {
  return ignore.some((i) => path === i || path.startsWith(`${i}.`));
}

function same(a: unknown, b: unknown): boolean {
  if (a instanceof Timestamp || b instanceof Timestamp) return a instanceof Timestamp && b instanceof Timestamp && a.isEqual(b);
  if (typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b)) return true;
  return a === b;
}

function walk(id: string, path: string, a: unknown, b: unknown, ignore: string[], out: Change[]): void {
  if (path && ignored(path, ignore)) return;
  if (isPlainObject(a) && isPlainObject(b)) {
    for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      walk(id, path ? `${path}.${k}` : k, a[k], b[k], ignore, out);
    }
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) walk(id, `${path}.${i}`, a[i], b[i], ignore, out);
    return;
  }
  if (!same(a, b)) out.push({ id, field: path, a, b });
}

/**
 * Diferenças entre `a` (coleção real, escrita pelas antigas) e `b` (sombra, escrita pelas v2027).
 * `missing` = só em `a`; `extra` = só em `b`; `changed` por campo (caminho com pontos; o tipo conta).
 * `_ingest` é sempre ignorado; `ignore` aceita campos de topo ou caminhos (`teamhome.logo`).
 */
export function diffLegacy(a: Record<string, DocumentData>, b: Record<string, DocumentData>, ignore: string[]): Diff {
  const ign = [...ALWAYS_IGNORE, ...ignore];
  const missing = Object.keys(a).filter((id) => !(id in b)).sort();
  const extra = Object.keys(b).filter((id) => !(id in a)).sort();
  const changed: Change[] = [];
  for (const id of Object.keys(a).filter((k) => k in b).sort()) walk(id, "", a[id], b[id], ign, changed);
  return { missing, extra, changed };
}

const EMPTYISH = new Set<unknown>(["", "null", null, undefined]);
const COUNTERS = new Set(["goals", "assists", "saves", "passesAccuracy", "tackles", "foulsCommitted", "cardsYellow", "cardsRed", "minutes"]);
const ZEROISH = new Set<unknown>([0, "", null, undefined]);

/**
 * Diferenças conhecidas e aceites (notas da Task 5, decisões T4/T14):
 * - qualquer `*.logo` que passa a ser o emblema de 2026 (regra do emblema, equipa 228);
 * - summaries: `playerSub` vazio como `""` ou `"null"`;
 * - players: contadores `0`, `""` e `null`/ausente são equivalentes;
 * - news: `sport` e `publishedAt` são campos novos;
 * - tweets: `metrics.*` mudam entre leituras.
 */
export function classifyDiff(col: string, c: Change): "expected" | "unexpected" {
  const parts = c.field.split(".");
  const last = parts[parts.length - 1];
  if (last === "logo" && c.b === SPORTING_CREST_URL) return "expected";
  if (col === "summaries" && parts[0] === "playerSub" && EMPTYISH.has(c.a) && EMPTYISH.has(c.b)) return "expected";
  if (col === "players" && parts[0] === "Players" && COUNTERS.has(last) && ZEROISH.has(c.a) && ZEROISH.has(c.b)) return "expected";
  if (col === "news" && (c.field === "sport" || c.field === "publishedAt") && c.a === undefined) return "expected";
  if (col === "tweets" && parts[0] === "metrics") return "expected";
  return "unexpected";
}

export type Args = { project: string; since: Date; collections: LegacyCollection[]; maxReads: number; limit: number };

export function parseArgs(argv: string[]): Args {
  const arg = (n: string) => {
    const i = argv.indexOf(n);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const project = arg("--project");
  if (!project) throw new Error("falta --project <id>");
  const sinceRaw = arg("--since");
  const since = sinceRaw && /^\d{4}-\d{2}-\d{2}T/.test(sinceRaw) ? new Date(sinceRaw) : undefined;
  if (!since || Number.isNaN(since.getTime())) throw new Error("falta --since <ISO>, ex. 2026-12-04T10:00:00Z");
  const cols = arg("--collections")?.split(",").filter(Boolean) ?? [...LEGACY_COLLECTIONS];
  for (const c of cols) if (!(LEGACY_COLLECTIONS as readonly string[]).includes(c)) throw new Error(`coleção desconhecida: ${c}`);
  return {
    project,
    since,
    collections: cols as LegacyCollection[],
    maxReads: Number(arg("--max-reads") ?? 150_000),
    limit: Number(arg("--limit") ?? 20),
  };
}

export type CollectionReport = {
  col: LegacyCollection;
  compared: number;
  missing: string[];
  extra: string[];
  expectedExtra: string[];
  expected: Change[];
  unexpected: Change[];
};

async function idsSince(db: Firestore, col: string, since: Date): Promise<string[]> {
  const snap = await db.collection(col).select().get();
  return snap.docs.filter((d) => d.updateTime.toMillis() >= since.getTime()).map((d) => d.id);
}

async function load(db: Firestore, col: string, ids: string[]): Promise<Record<string, DocumentData>> {
  const out: Record<string, DocumentData> = {};
  for (let i = 0; i < ids.length; i += 300) {
    const snaps = await db.getAll(...ids.slice(i, i + 300).map((id) => db.collection(col).doc(id)));
    for (const s of snaps) if (s.exists) out[s.id] = s.data() as DocumentData;
  }
  return out;
}

/** Leituras previstas (contagens das coleções real e sombra), para o limite --max-reads. */
export async function estimateReads(db: Firestore, cols: readonly LegacyCollection[], prefix = SHADOW_PREFIX): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const c of cols) {
    for (const name of [c, prefix + c]) out[name] = (await db.collection(name).count().get()).data().count;
  }
  return out;
}

/**
 * Compara uma coleção: documentos de `<col>` e `<prefix><col>` com `updateTime >= since`, lidos dos
 * dois lados. Os jogos só em sombra de competições que a função antiga não pedia (competição que não
 * aparece em nenhum `games` real comparado) e os documentos desses jogos contam como esperados.
 */
export async function compareCollection(
  db: Firestore,
  col: LegacyCollection,
  since: Date,
  ctx: { legacyCompetitions?: Set<string>; expectedGameIds?: Set<string> } = {},
  prefix = SHADOW_PREFIX,
): Promise<CollectionReport> {
  const shadowCol = prefix + col;
  const ids = [...new Set([...(await idsSince(db, col, since)), ...(await idsSince(db, shadowCol, since))])];
  const [a, b] = await Promise.all([load(db, col, ids), load(db, shadowCol, ids)]);
  const d = diffLegacy(a, b, IGNORE_FIELDS[col]);

  let expectedExtra: string[] = [];
  if (col === "games") {
    const comps = ctx.legacyCompetitions ?? new Set(Object.values(a).map((g) => String(g.competition)));
    expectedExtra = d.extra.filter((id) => !comps.has(String(b[id].competition)));
    for (const id of expectedExtra) ctx.expectedGameIds?.add(id);
  } else if (ctx.expectedGameIds?.size) {
    expectedExtra = d.extra.filter((id) => ctx.expectedGameIds?.has(String(b[id].GameId)));
  }
  const exp = new Set(expectedExtra);
  return {
    col,
    compared: Object.keys(a).filter((k) => k in b).length,
    missing: d.missing,
    extra: d.extra.filter((id) => !exp.has(id)),
    expectedExtra,
    expected: d.changed.filter((c) => classifyDiff(col, c) === "expected"),
    unexpected: d.changed.filter((c) => classifyDiff(col, c) === "unexpected"),
  };
}

/** Corre todas as coleções (games primeiro, para saber os jogos esperados só em sombra). */
export async function compareAll(db: Firestore, cols: readonly LegacyCollection[], since: Date, prefix = SHADOW_PREFIX): Promise<CollectionReport[]> {
  const ctx = { expectedGameIds: new Set<string>() };
  const ordered = [...cols].sort((x, y) => Number(y === "games") - Number(x === "games"));
  const out: CollectionReport[] = [];
  for (const c of ordered) out.push(await compareCollection(db, c, since, ctx, prefix));
  return out;
}

export function hasProblems(reports: CollectionReport[]): boolean {
  return reports.some((r) => r.missing.length > 0 || r.extra.length > 0 || r.unexpected.length > 0);
}

const show = (v: unknown) => (v instanceof Timestamp ? v.toDate().toISOString() : JSON.stringify(v));

function print(reports: CollectionReport[], limit: number): void {
  for (const r of reports) {
    console.log(
      `${r.col}: ${r.compared} comparados; só na antiga ${r.missing.length}; só na sombra ${r.extra.length} (+${r.expectedExtra.length} esperados); ` +
        `diferenças ${r.unexpected.length} (+${r.expected.length} esperadas)`,
    );
    if (r.missing.length) console.log(`  só na antiga: ${r.missing.slice(0, limit).join(", ")}`);
    if (r.extra.length) console.log(`  só na sombra: ${r.extra.slice(0, limit).join(", ")}`);
    for (const c of r.unexpected.slice(0, limit)) console.log(`  ${c.id} ${c.field}: antiga=${show(c.a)} sombra=${show(c.b)}`);
    if (r.unexpected.length > limit) console.log(`  ... e mais ${r.unexpected.length - limit}`);
  }
}

const HELP = `Uso: npx tsx scripts/compare-legacy.ts --project <id> --since <ISO> [opções]

Só leitura. Compara _shadow_<col> com <col> para os documentos atualizados desde --since.

  --project <id>        projeto Firebase (obrigatório)
  --since <ISO>         hora do deploy em sombra, ex. 2026-12-04T10:00:00Z (obrigatório)
  --collections a,b     só estas coleções (por omissão: ${LEGACY_COLLECTIONS.join(",")})
  --max-reads <n>       pára antes de ler se as coleções tiverem mais documentos (por omissão 150000)
  --limit <n>           exemplos por coleção (por omissão 20)

Sai com código 1 se houver diferenças fora das esperadas.`;

async function main(): Promise<void> {
  if (process.argv.includes("--help")) return void console.log(HELP);
  const args = parseArgs(process.argv.slice(2));
  const app = getApps()[0] ?? initializeApp({ projectId: args.project });
  const db = getFirestore(app);
  const counts = await estimateReads(db, args.collections);
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  console.log(`Documentos a ler: ${total} (${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ")})`);
  if (total > args.maxReads) throw new Error(`acima de --max-reads ${args.maxReads}: usar --collections ou subir o limite`);
  const reports = await compareAll(db, args.collections, args.since);
  print(reports, args.limit);
  if (hasProblems(reports)) {
    console.log("RESULTADO: há diferenças por explicar.");
    process.exitCode = 1;
  } else {
    console.log("RESULTADO: zero diferenças fora das esperadas.");
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
}
