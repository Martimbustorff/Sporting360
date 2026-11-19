// Typed read hooks for points, predictions, news and GameBox (Plan 4 "Contrato de leitura").
// The app never writes any of these collections except `gamebox` (owner); predictions and votes
// go through callables.
import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  documentId,
  getCountFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Query,
} from '@react-native-firebase/firestore';
import { db } from '@/services/firebase';
import { reportDataError, reportInvalidDocs, useCollection, useDocument, type Loadable } from './hooks';
import {
  GameboxDocSchema,
  LeaderboardEntrySchema,
  MatchPredictionSchema,
  MvpVoteSchema,
  NewsSchema,
  PointEventSchema,
  SettlementSchema,
  type GameboxDoc,
  type LeaderboardEntry,
  type MatchPrediction,
  type MvpVote,
  type News,
  type PointEvent,
  type Settlement,
  type Sport,
} from './schemas';

export type PeriodKind = 'week' | 'month' | 'season';

const LEADERBOARD_LIMIT = 100;
const POINT_EVENTS_LIMIT = 300;
const PREDICTIONS_LIMIT = 100;
const NEWS_LIMIT = 40;
/** Firestore `in` accepts at most 30 values. */
const IN_CHUNK = 30;
/** Predictions written by the 2027 callable; older V2 predictions do not count in the stats. */
const V2027_SOURCE = 'v2027';

const LOADING: Loadable<never> = { status: 'loading' };

/** Same Loadable with `data` transformed; keeps `fromCache`. `f` must be a module-level function. */
function useMapped<A, B>(l: Loadable<A>, f: (a: A) => B): Loadable<B> {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- f é função de módulo, só a identidade do Loadable conta
  return useMemo(() => (l.status === 'ready' ? { status: 'ready', data: f(l.data), fromCache: l.fromCache } : l), [l]);
}

// --- Leaderboards ----------------------------------------------------------------------------

const leaderboardPath = (kind: PeriodKind, key: string): string => `leaderboards/${kind}_${key}/entries`;

/** Top 100 of a period, most points first. */
export function useLeaderboard(kind: PeriodKind, key: string): Loadable<LeaderboardEntry[]> {
  const q = useMemo(
    () => query(collection(db(), leaderboardPath(kind, key)), orderBy('points', 'desc'), limit(LEADERBOARD_LIMIT)),
    [kind, key],
  );
  return useCollection(q, LeaderboardEntrySchema);
}

/** The user's own entry in a period; `missing` when they have no points yet. */
export function useMyLeaderboardEntry(kind: PeriodKind, key: string, uid: string | null): Loadable<LeaderboardEntry> {
  return useDocument(uid ? `${leaderboardPath(kind, key)}/${uid}` : null, LeaderboardEntrySchema);
}

/** Position of someone with `points`: people with strictly more points, plus one (ties share a position). */
export async function fetchMyPosition(kind: PeriodKind, key: string, points: number): Promise<number> {
  const q = query(collection(db(), leaderboardPath(kind, key)), where('points', '>', points));
  const snap = await getCountFromServer(q);
  return snap.data().count + 1;
}

// --- Prediction, MVP and settlement of one game ----------------------------------------------

export function useMyPrediction(gameId: string, uid: string | null): Loadable<MatchPrediction> {
  return useDocument(uid ? `matchPredictions/${gameId}_${uid}` : null, MatchPredictionSchema);
}

export function useMyMvpVote(gameId: string, uid: string | null): Loadable<MvpVote> {
  return useDocument(uid ? `mvpVotes/${gameId}_${uid}` : null, MvpVoteSchema);
}

/** `missing` until the server settles the game (about 2 h after the end). */
export function useSettlement(gameId: string): Loadable<Settlement> {
  return useDocument(`settlements/${gameId}`, SettlementSchema);
}

/** The user's point events for one game. */
export function useMyGamePoints(gameId: string, uid: string | null): Loadable<PointEvent[]> {
  const q = useMemo(
    () =>
      uid ? query(collection(db(), 'pointEvents'), where('uid', '==', uid), where('gameId', '==', gameId)) : null,
    [gameId, uid],
  );
  return useCollection(q, PointEventSchema);
}

// --- History of the user ---------------------------------------------------------------------

/** The user's last 300 point events, most recent game first. */
export function useMyPointEvents(uid: string | null): Loadable<PointEvent[]> {
  const q = useMemo(
    () =>
      uid
        ? query(
            collection(db(), 'pointEvents'),
            where('uid', '==', uid),
            orderBy('gameDate', 'desc'),
            limit(POINT_EVENTS_LIMIT),
          )
        : null,
    [uid],
  );
  return useCollection(q, PointEventSchema);
}

const onlyV2027 = (ps: MatchPrediction[]): MatchPrediction[] => ps.filter((p) => p.source === V2027_SOURCE);

/** The user's last 100 predictions made in this version, most recent first. */
export function useMyPredictions(uid: string | null): Loadable<MatchPrediction[]> {
  const q = useMemo(
    () =>
      uid
        ? query(
            collection(db(), 'matchPredictions'),
            where('userId', '==', uid),
            orderBy('createdAt', 'desc'),
            limit(PREDICTIONS_LIMIT),
          )
        : null,
    [uid],
  );
  return useMapped(useCollection(q, MatchPredictionSchema), onlyV2027);
}

/**
 * Settlements of several games by id, in chunks of 30 (Firestore `in` limit). Keyed by game id.
 * Like `useCollection`: invalid documents are dropped and reported, a listener failure is reported and is `error`.
 */
export function useSettlements(gameIds: string[]): Loadable<Record<string, Settlement>> {
  // Stable key: the same set of ids never resubscribes.
  const key = useMemo(() => [...new Set(gameIds)].sort().join('|'), [gameIds]);
  const [held, setHeld] = useState<{ key: string; value: Loadable<Record<string, Settlement>> }>({
    key: '',
    value: LOADING,
  });
  useEffect(() => {
    const ids = key === '' ? [] : key.split('|');
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += IN_CHUNK) chunks.push(ids.slice(i, i + IN_CHUNK));
    if (chunks.length === 0) {
      setHeld({ key, value: { status: 'ready', data: {} } });
      return undefined;
    }
    const parts: Array<Record<string, Settlement> | null> = chunks.map(() => null);
    const cached: boolean[] = chunks.map(() => false);
    let failed: Error | null = null;
    const publish = () => {
      if (failed) {
        setHeld({ key, value: { status: 'error', error: failed } });
        return;
      }
      if (parts.some((p) => p === null)) return;
      const data: Record<string, Settlement> = Object.assign({}, ...(parts as Array<Record<string, Settlement>>));
      setHeld({ key, value: { status: 'ready', data, fromCache: cached.some(Boolean) } });
    };
    const unsubs = chunks.map((chunk, i) =>
      onSnapshot(
        query(collection(db(), 'settlements'), where(documentId(), 'in', chunk)),
        { includeMetadataChanges: true },
        (snap: {
          docs: Array<{ id: string; ref?: { path?: string }; data: () => unknown }>;
          metadata?: { fromCache?: boolean };
        }) => {
          const part: Record<string, Settlement> = {};
          const badPaths: string[] = [];
          for (const d of snap.docs) {
            const parsed = SettlementSchema.safeParse(d.data());
            if (parsed.success) part[d.id] = parsed.data;
            else badPaths.push(d.ref?.path ?? `settlements/${d.id}`);
          }
          reportInvalidDocs(badPaths, 'settlements');
          parts[i] = part;
          cached[i] = snap.metadata?.fromCache === true;
          publish();
        },
        (e: unknown) => {
          reportDataError(e, 'settlements listener failed');
          failed = e instanceof Error ? e : new Error(String(e));
          publish();
        },
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [key]);

  return held.key === key ? held.value : LOADING;
}

// --- News and GameBox ------------------------------------------------------------------------

/** Latest 40 news, optionally of one sport. Never reads `content`. */
export function useNews(sport: Sport | null): Loadable<News[]> {
  const q = useMemo(() => {
    const base = collection(db(), 'news');
    return sport
      ? query(base, where('sport', '==', sport), orderBy('publishedAt', 'desc'), limit(NEWS_LIMIT))
      : query(base, orderBy('publishedAt', 'desc'), limit(NEWS_LIMIT));
  }, [sport]);
  return useCollection(q, NewsSchema);
}

type GameboxItem = GameboxDoc & { id: string };
const byOrder = (gs: GameboxItem[]): GameboxItem[] => [...gs].sort((a, b) => a.order - b.order);

/** The user's GameBoxes (V2 documents, field `userid`), by `order`. Each item carries its document `id`. */
export function useMyGameboxes(uid: string | null): Loadable<GameboxItem[]> {
  const q: Query | null = useMemo(
    () => (uid ? query(collection(db(), 'gamebox'), where('userid', '==', uid)) : null),
    [uid],
  );
  return useMapped(useCollection(q, GameboxDocSchema), byOrder);
}
