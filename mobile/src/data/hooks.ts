import { useEffect, useRef, useState } from 'react';
import type { z } from 'zod';
import { doc, onSnapshot, type Query } from '@react-native-firebase/firestore';
import { getCrashlytics, recordError } from '@react-native-firebase/crashlytics';
import { codeOf } from '@/lib/report';
import { db } from '@/services/firebase';
import {
  AppConfigSchema,
  PublicProfileSchema,
  UserDocSchema,
  type AppConfig,
  type PublicProfile,
  type UserDoc,
} from './schemas';

export type Loadable<T> =
  | { status: 'loading' }
  /** `fromCache`: the data came from the local cache (offline or not yet confirmed by the server). */
  | { status: 'ready'; data: T; fromCache?: boolean }
  | { status: 'missing' }
  | { status: 'error'; error: Error };

const LOADING: Loadable<never> = { status: 'loading' };

/** Metadata changes are needed so a cached snapshot is followed by the server-confirmed one. */
const SNAPSHOT_OPTIONS = { includeMetadataChanges: true } as const;

/** Invalid documents are sent to Crashlytics once per path per app run. */
const reportedPaths = new Set<string>();

function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

/** Sends a data-layer error to Crashlytics (never throws). Used by every live read. */
export function reportDataError(e: unknown, context: string): void {
  const err = toError(e);
  if (__DEV__) console.warn(`[data] ${context}`, err);
  try {
    recordError(getCrashlytics(), err);
  } catch {
    // reporting must never break rendering
  }
}

/** Caminho sem os ids dos documentos (levam o uid): só os segmentos de coleção, por exemplo `pointEvents`. */
export function collectionOf(path: string): string {
  return path
    .split('/')
    .filter((_, i) => i % 2 === 0)
    .join('/');
}

/**
 * Reports dropped (invalid) documents of a query, each path once per app run. O Crashlytics só recebe os nomes das
 * coleções e a contagem: nunca ids de documentos (levam o uid).
 */
export function reportInvalidDocs(paths: string[], context: string): void {
  const fresh = paths.filter((p) => !reportedPaths.has(p));
  if (fresh.length === 0) return;
  for (const p of fresh) reportedPaths.add(p);
  const counts = new Map<string, number>();
  for (const p of fresh) counts.set(collectionOf(p), (counts.get(collectionOf(p)) ?? 0) + 1);
  const where = [...counts].map(([c, n]) => `${c} x${n}`).join(', ');
  reportDataError(new Error(`${fresh.length} documento(s) inválido(s) descartado(s): ${where}`), context);
}

export type DocumentOptions = {
  /** Negar a permissão é esperado (ex.: empréstimo cancelado): vira `error` sem ir ao Crashlytics. */
  expectDenied?: boolean;
  /** Caminho a mostrar em relatórios e mensagens, sem ids (ex.: `loans/*`/secret/number); por omissão, o caminho. */
  reportAs?: string;
  /**
   * Um documento em falta que vem da cache local (sem rede, ou ainda não confirmado) não prova que não existe: fica a carregar
   * até chegar o snapshot do servidor. Só um snapshot do servidor dá `missing`.
   */
  cacheMissingIsLoading?: boolean;
};

export type CollectionOptions = {
  /** Negar a permissão é esperado (ex.: app lançada antes das regras): vira `error` sem ir ao Crashlytics. */
  expectDenied?: boolean;
  /** Nome da coleção a mostrar em relatórios, sem ids. */
  reportAs?: string;
};

const isDenied = (e: unknown): boolean => /(^|\/)permission-denied$/.test(codeOf(e) ?? '');

/**
 * Live document. `path` null means "not ready to read" (e.g. no uid yet): stays `loading`
 * and never subscribes. `schema` should be a stable (module-level) value; `options` too.
 */
export function useDocument<T>(path: string | null, schema: z.ZodType<T>, options?: DocumentOptions): Loadable<T> {
  // The state remembers which path produced it: after the path changes, the first render
  // returns LOADING instead of the previous (possibly another user's) data.
  const [held, setHeld] = useState<{ key: string | null; value: Loadable<T> }>({
    key: null,
    value: LOADING,
  });
  const schemaRef = useRef(schema);
  schemaRef.current = schema;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const setState = (value: Loadable<T>) => setHeld({ key: path, value });

  useEffect(() => {
    if (path === null) return undefined;
    return onSnapshot(
      doc(db(), path),
      SNAPSHOT_OPTIONS,
      (snap) => {
        if (!snap.exists()) {
          setState(optionsRef.current?.cacheMissingIsLoading && snap.metadata?.fromCache === true ? LOADING : { status: 'missing' });
          return;
        }
        const shown = optionsRef.current?.reportAs ?? path;
        const parsed = schemaRef.current.safeParse(snap.data());
        if (parsed.success) {
          setState({ status: 'ready', data: parsed.data, fromCache: snap.metadata?.fromCache === true });
        } else {
          const error = new Error(`Documento inválido em ${shown}: ${parsed.error.message}`);
          if (!reportedPaths.has(path)) {
            reportedPaths.add(path);
            reportDataError(error, `invalid document ${shown}`);
          }
          setState({ status: 'error', error });
        }
      },
      (e) => {
        if (!(optionsRef.current?.expectDenied && isDenied(e))) {
          reportDataError(e, `listener failed ${optionsRef.current?.reportAs ?? path}`);
        }
        setState({ status: 'error', error: toError(e) });
      },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps -- só resubscreve quando o caminho muda; setState só escreve o estado do caminho atual e as opções vêm por ref
  }, [path]);

  return path !== null && held.key === path ? held.value : LOADING;
}

/**
 * Live query. The caller must memoize `query` (a new object every render resubscribes).
 * Invalid documents are dropped one by one; the list itself only fails if the listener fails.
 */
export function useCollection<T>(
  query: Query | null,
  schema: z.ZodType<T>,
  options?: CollectionOptions,
): Loadable<Array<T & { id: string }>> {
  const [held, setHeld] = useState<{
    key: Query | null;
    value: Loadable<Array<T & { id: string }>>;
  }>({ key: null, value: LOADING });
  const schemaRef = useRef(schema);
  schemaRef.current = schema;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (query === null) return undefined;
    const setState = (value: Loadable<Array<T & { id: string }>>) => setHeld({ key: query, value });
    return onSnapshot(
      query,
      SNAPSHOT_OPTIONS,
      (snap) => {
        const items: Array<T & { id: string }> = [];
        const badPaths: string[] = [];
        for (const d of snap.docs) {
          const parsed = schemaRef.current.safeParse(d.data());
          if (parsed.success) items.push({ ...parsed.data, id: d.id });
          else badPaths.push(d.ref?.path ?? d.id);
        }
        reportInvalidDocs(badPaths, 'collection');
        setState({ status: 'ready', data: items, fromCache: snap.metadata?.fromCache === true });
      },
      (e) => {
        if (!(optionsRef.current?.expectDenied && isDenied(e))) {
          reportDataError(e, `collection listener failed${optionsRef.current?.reportAs ? ` ${optionsRef.current.reportAs}` : ''}`);
        }
        setState({ status: 'error', error: toError(e) });
      },
    );
  }, [query]);

  return query !== null && held.key === query ? held.value : LOADING;
}

export function useAppConfig(): Loadable<AppConfig> {
  return useDocument('config/app', AppConfigSchema);
}

export function usePublicProfile(uid: string | null): Loadable<PublicProfile> {
  return useDocument(uid ? `publicProfiles/${uid}` : null, PublicProfileSchema);
}

export function useMyUser(uid: string | null): Loadable<UserDoc> {
  return useDocument(uid ? `users/${uid}` : null, UserDocSchema);
}
