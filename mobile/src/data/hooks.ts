import { useEffect, useRef, useState } from 'react';
import type { z } from 'zod';
import { doc, onSnapshot, type Query } from '@react-native-firebase/firestore';
import { getCrashlytics, recordError } from '@react-native-firebase/crashlytics';
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
  | { status: 'ready'; data: T }
  | { status: 'missing' }
  | { status: 'error'; error: Error };

const LOADING: Loadable<never> = { status: 'loading' };

function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

function report(e: unknown, context: string): void {
  const err = toError(e);
  if (__DEV__) console.warn(`[data] ${context}`, err);
  try {
    recordError(getCrashlytics(), err);
  } catch {
    // reporting must never break rendering
  }
}

/**
 * Live document. `path` null means "not ready to read" (e.g. no uid yet): stays `loading`
 * and never subscribes. `schema` should be a stable (module-level) value.
 */
export function useDocument<T>(path: string | null, schema: z.ZodType<T>): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>(LOADING);
  const schemaRef = useRef(schema);
  schemaRef.current = schema;

  useEffect(() => {
    setState(LOADING);
    if (path === null) return undefined;
    return onSnapshot(
      doc(db(), path),
      (snap) => {
        if (!snap.exists()) {
          setState({ status: 'missing' });
          return;
        }
        const parsed = schemaRef.current.safeParse(snap.data());
        if (parsed.success) {
          setState({ status: 'ready', data: parsed.data });
        } else {
          const error = new Error(`Documento inválido em ${path}: ${parsed.error.message}`);
          report(error, `invalid document ${path}`);
          setState({ status: 'error', error });
        }
      },
      (e) => {
        report(e, `listener failed ${path}`);
        setState({ status: 'error', error: toError(e) });
      },
    );
  }, [path]);

  return state;
}

/**
 * Live query. The caller must memoize `query` (a new object every render resubscribes).
 * Invalid documents are dropped one by one; the list itself only fails if the listener fails.
 */
export function useCollection<T>(
  query: Query | null,
  schema: z.ZodType<T>,
): Loadable<Array<T & { id: string }>> {
  const [state, setState] = useState<Loadable<Array<T & { id: string }>>>(LOADING);
  const schemaRef = useRef(schema);
  schemaRef.current = schema;

  useEffect(() => {
    setState(LOADING);
    if (query === null) return undefined;
    return onSnapshot(
      query,
      (snap) => {
        const items: Array<T & { id: string }> = [];
        let dropped = 0;
        for (const d of snap.docs) {
          const parsed = schemaRef.current.safeParse(d.data());
          if (parsed.success) items.push({ ...parsed.data, id: d.id });
          else dropped += 1;
        }
        if (dropped > 0) report(new Error(`${dropped} documento(s) inválido(s) descartado(s)`), 'collection');
        setState({ status: 'ready', data: items });
      },
      (e) => {
        report(e, 'collection listener failed');
        setState({ status: 'error', error: toError(e) });
      },
    );
  }, [query]);

  return state;
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
