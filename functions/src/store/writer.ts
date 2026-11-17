import { createHash } from "node:crypto";
import { FieldValue, Timestamp, type DocumentData, type Firestore, type WriteBatch } from "firebase-admin/firestore";
import { LEGACY_COLLECTION_PREFIX } from "../config/secrets";
import type { FootballDetails } from "../football/mapFixture";
import type { LegacyDocs } from "../legacy/footballLegacy";
import type { MatchDoc } from "../model/types";

const BATCH_SIZE = 450;

/** Nome da coleção antiga com o prefixo do ensaio em sombra (vazio em produção). */
export function legacyCollection(name: string, prefix?: string): string {
  return (prefix ?? LEGACY_COLLECTION_PREFIX.value()) + name;
}

export interface DocWrite {
  path: string;
  data: DocumentData;
  merge?: boolean;
  /** Documento das coleções antigas: não leva `updatedAt`. */
  legacy?: boolean;
  /** Campos que não contam para o hash (ex.: `channel`, que só se escreve na criação). */
  hashOmit?: string[];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && Object.getPrototypeOf(v) === Object.prototype;
}

/** Converte `Date` em `Timestamp`, em profundidade. */
function toFirestore<T>(v: T): T {
  if (v instanceof Date) return Timestamp.fromDate(v) as unknown as T;
  if (Array.isArray(v)) return v.map(toFirestore) as unknown as T;
  if (isPlainObject(v)) {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = toFirestore(x);
    return out as T;
  }
  return v;
}

/** Converte `Timestamp` em `Date`, em profundidade. */
export function fromFirestore<T>(v: T): T {
  if (v instanceof Timestamp) return v.toDate() as unknown as T;
  if (Array.isArray(v)) return v.map(fromFirestore) as unknown as T;
  if (isPlainObject(v)) {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = fromFirestore(x);
    return out as T;
  }
  return v;
}

function canonical(v: unknown): unknown {
  if (v instanceof Timestamp) return { $t: v.toMillis() };
  if (v instanceof Date) return { $t: v.getTime() };
  if (Array.isArray(v)) return v.map(canonical);
  if (isPlainObject(v)) {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v).sort()) {
      if (k === "updatedAt") continue;
      if (v[k] === undefined) continue;
      out[k] = canonical(v[k]);
    }
    return out;
  }
  return v === undefined ? null : v;
}

/** sha1 do JSON com chaves ordenadas, sem `updatedAt`. */
export function stableHash(data: unknown): string {
  return createHash("sha1").update(JSON.stringify(canonical(data))).digest("hex");
}

// Os nomes de campo do mapa de hashes não podem conter "/" nem ".".
const hashKey = (path: string) => path.replace(/[/.]/g, "|");

/**
 * Escreve só os documentos cujo conteúdo mudou desde a última vez (hash por caminho em
 * `ingestState/{stateKey}.hashes`). Os hashes só são guardados depois do lote confirmado.
 * Com `force` ignora os hashes guardados e escreve tudo (backfill, arranque do ensaio em sombra).
 */
export async function writeDocs(
  db: Firestore,
  writes: DocWrite[],
  o: { stateKey: string; force?: boolean },
): Promise<{ written: number; skipped: number; changed: string[] }> {
  if (writes.length === 0) return { written: 0, skipped: 0, changed: [] };
  const stateRef = db.doc(`ingestState/${o.stateKey}`);
  const stored = ((await stateRef.get()).get("hashes") ?? {}) as Record<string, string>;

  const changed: { w: DocWrite; key: string; hash: string }[] = [];
  let skipped = 0;
  for (const w of writes) {
    const key = hashKey(w.path);
    const hashed = w.hashOmit ? Object.fromEntries(Object.entries(w.data).filter(([k]) => !w.hashOmit!.includes(k))) : w.data;
    const hash = stableHash(hashed);
    if (!o.force && stored[key] === hash) skipped++;
    else changed.push({ w, key, hash });
  }

  for (let i = 0; i < changed.length; i += BATCH_SIZE) {
    const chunk = changed.slice(i, i + BATCH_SIZE);
    const batch: WriteBatch = db.batch();
    for (const { w } of chunk) {
      const data = w.legacy ? w.data : { ...w.data, updatedAt: FieldValue.serverTimestamp() };
      if (w.merge) batch.set(db.doc(w.path), data, { merge: true });
      else batch.set(db.doc(w.path), data);
    }
    await batch.commit();
    const hashes: Record<string, string> = {};
    for (const { key, hash } of chunk) hashes[key] = hash;
    await stateRef.set({ hashes, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  return { written: changed.length, skipped, changed: changed.map((c) => c.w.path) };
}

export async function getMatch(db: Firestore, id: string): Promise<MatchDoc | null> {
  const snap = await db.doc(`matches/${id}`).get();
  return snap.exists ? fromFirestore(snap.data() as MatchDoc) : null;
}

const DETAIL_NAMES = ["events", "statistics", "lineups", "players"] as const;
const LEGACY_NAMES = ["summaries", "stastistics", "lineups", "players"] as const;

/**
 * Único ponto de escrita de um jogo. Jogo com `locked: true` não é tocado. Respostas vazias
 * (`null` nos detalhes, mapa vazio nas coleções antigas) nunca apagam nada.
 */
export async function saveMatch(
  db: Firestore,
  m: { match: MatchDoc; details?: FootballDetails | null; legacy?: Partial<LegacyDocs> | null },
  o?: { prefix?: string; force?: boolean },
): Promise<{ written: number; skipped: number; locked: boolean }> {
  const id = m.match.id;
  const existing = await db.doc(`matches/${id}`).get();
  if (existing.get("locked") === true) return { written: 0, skipped: 0, locked: true };

  const col = (name: string) => legacyCollection(name, o?.prefix);
  const writes: DocWrite[] = [];

  // Sem `locked`: o documento existente decide; o merge preserva `locked`, `venue.capacity`, etc.
  writes.push({ path: `matches/${id}`, data: toFirestore({ ...m.match }) as DocumentData, merge: true });

  for (const name of DETAIL_NAMES) {
    const d = m.details?.[name];
    if (d !== null && d !== undefined) writes.push({ path: `matches/${id}/details/${name}`, data: toFirestore(d) as DocumentData });
  }

  const legacy = m.legacy ?? null;
  if (legacy?.games) {
    for (const [gid, data] of Object.entries(legacy.games)) {
      const g = toFirestore({ ...data });
      // `channel` manual: só se escreve o vazio quando o jogo ainda não existe.
      const current = await db.doc(`${col("games")}/${gid}`).get();
      if (current.exists) delete g.channel;
      writes.push({ path: `${col("games")}/${gid}`, data: g, merge: true, legacy: true, hashOmit: ["channel"] });
    }
  }
  for (const name of LEGACY_NAMES) {
    for (const [did, data] of Object.entries(legacy?.[name] ?? {})) {
      writes.push({ path: `${col(name)}/${did}`, data: toFirestore({ ...data }), legacy: true });
    }
  }

  const res = await writeDocs(db, writes, { stateKey: `match_${id}`, force: o?.force });

  // A limpeza de lances antigos (uma query por jogo) só corre quando os lances mudaram nesta escrita:
  // o ticker chama isto de 15 em 15 s e quase sempre nada mudou.
  const summaries = legacy?.summaries;
  const eventsChanged = res.changed.some((p) => p === `matches/${id}/details/events` || p.startsWith(`${col("summaries")}/`));
  if (eventsChanged && summaries && Object.keys(summaries).length > 0) {
    const stale = await db.collection(col("summaries")).where("GameId", "==", id).get();
    const gone = stale.docs.filter((d) => !(d.id in summaries));
    if (gone.length > 0) {
      for (let i = 0; i < gone.length; i += BATCH_SIZE) {
        const batch = db.batch();
        for (const d of gone.slice(i, i + BATCH_SIZE)) batch.delete(d.ref);
        await batch.commit();
      }
      const clear: Record<string, unknown> = {};
      for (const d of gone) clear[hashKey(d.ref.path)] = FieldValue.delete();
      await db.doc(`ingestState/match_${id}`).set({ hashes: clear }, { merge: true });
    }
  }

  return { written: res.written, skipped: res.skipped, locked: false };
}
