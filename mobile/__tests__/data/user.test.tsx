import React from 'react';
import { Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import {
  collection,
  doc,
  documentId,
  getCountFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from '@react-native-firebase/firestore';
import {
  fetchMyPosition,
  useLeaderboard,
  useMyGameboxes,
  useMyGamePoints,
  useMyPointEvents,
  useMyPredictions,
  useNews,
  useSettlements,
} from '@/data/user';
import { recordError } from '@react-native-firebase/crashlytics';
import type { Loadable } from '@/data/hooks';

jest.mock('@react-native-firebase/app');
jest.mock('@react-native-firebase/firestore');
jest.mock('@react-native-firebase/crashlytics');

const snapMock = onSnapshot as unknown as jest.Mock;
type Next = (snap: unknown) => void;
const nextOf = (call: unknown[]): Next => call.find((a) => typeof a === 'function') as Next;
const lastNext = (): Next => nextOf(snapMock.mock.calls[snapMock.mock.calls.length - 1] as unknown[]);

const ts = (iso: string) => ({ toDate: () => new Date(iso) });
const qSnap = (docs: { id: string; data: unknown }[]) => ({
  docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
  metadata: { fromCache: false },
});

function Out<T>({ v, pick }: { v: Loadable<T>; pick?: (d: T) => unknown }) {
  return <Text testID="out">{JSON.stringify(v.status === 'ready' ? (pick ? pick(v.data) : v.data) : v.status)}</Text>;
}
const out = () => JSON.parse(String(screen.getByTestId('out').props.children));

beforeEach(() => {
  snapMock.mockReset().mockImplementation(() => jest.fn());
  for (const m of [doc, collection, query, where, orderBy, limit, documentId, getCountFromServer]) (m as jest.Mock).mockClear();
});

describe('leaderboards', () => {
  it('useLeaderboard reads entries ordered by points desc, limit 100', async () => {
    function P() {
      useLeaderboard('week', '2026-W47');
      return null;
    }
    await render(<P />);
    expect(collection).toHaveBeenLastCalledWith(expect.anything(), 'leaderboards/week_2026-W47/entries');
    expect(orderBy).toHaveBeenCalledWith('points', 'desc');
    expect(limit).toHaveBeenCalledWith(100);
  });

  it('fetchMyPosition counts people with more points and adds one', async () => {
    (getCountFromServer as jest.Mock).mockResolvedValueOnce({ data: () => ({ count: 41 }) });
    await expect(fetchMyPosition('month', '2026-11', 120)).resolves.toBe(42);
    expect(collection).toHaveBeenLastCalledWith(expect.anything(), 'leaderboards/month_2026-11/entries');
    expect(where).toHaveBeenCalledWith('points', '>', 120);
  });

  it('fetchMyPosition is 1 for nobody ahead', async () => {
    (getCountFromServer as jest.Mock).mockResolvedValueOnce({ data: () => ({ count: 0 }) });
    await expect(fetchMyPosition('season', '2026-2027', 5)).resolves.toBe(1);
  });
});

describe('points history', () => {
  it('useMyGamePoints filters by uid and gameId', async () => {
    function P() {
      useMyGamePoints('9001', 'u1');
      return null;
    }
    await render(<P />);
    expect(where).toHaveBeenCalledWith('uid', '==', 'u1');
    expect(where).toHaveBeenCalledWith('gameId', '==', '9001');
  });

  it('useMyPointEvents: uid, gameDate desc, limit 300; null uid never subscribes', async () => {
    function P({ uid }: { uid: string | null }) {
      return <Out v={useMyPointEvents(uid)} pick={(es) => es.map((e) => [e.type, e.gameId])} />;
    }
    const view = await render(<P uid={null} />);
    expect(snapMock).not.toHaveBeenCalled();
    await view.rerender(<P uid="u1" />);
    expect(orderBy).toHaveBeenCalledWith('gameDate', 'desc');
    expect(limit).toHaveBeenCalledWith(300);
    const e = (gameId: string | null) => ({ id: 'x', data: { uid: 'u1', gameId, type: 'mvp_correct', points: 3, gameDate: ts('2026-11-01T20:00:00Z') } });
    await act(async () => lastNext()(qSnap([e('1'), e(null)])));
    expect(out()).toEqual([['mvp_correct', '1'], ['mvp_correct', null]]);
  });

  it('useMyPredictions keeps only source v2027', async () => {
    function P() {
      return <Out v={useMyPredictions('u1')} pick={(ps) => ps.map((p) => p.gameId)} />;
    }
    await render(<P />);
    expect(where).toHaveBeenCalledWith('userId', '==', 'u1');
    expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(limit).toHaveBeenCalledWith(100);
    const p = (gameId: string, source?: string) => ({ id: gameId, data: { gameId, userId: 'u1', home: 1, away: 0, createdAt: ts('2026-11-01T10:00:00Z'), source } });
    await act(async () => lastNext()(qSnap([p('1', 'v2027'), p('2'), p('3', 'v2027')])));
    expect(out()).toEqual(['1', '3']);
  });
});

describe('useSettlements', () => {
  const settle = (n: number) => ({ id: `g${n}`, data: { finalHome: n, finalAway: 0, officialMvp: ['7'] } });

  it('splits 31 ids into 2 queries and merges the results', async () => {
    const ids = Array.from({ length: 31 }, (_, i) => `g${i}`);
    function P() {
      return <Out v={useSettlements(ids)} pick={(r) => Object.keys(r).sort()} />;
    }
    await render(<P />);
    expect(snapMock).toHaveBeenCalledTimes(2);
    const inCalls = (where as jest.Mock).mock.calls.filter((c) => c[1] === 'in');
    expect(inCalls.map((c) => (c[2] as string[]).length).sort((a, b) => a - b)).toEqual([1, 30]);
    expect(documentId).toHaveBeenCalled();
    await act(async () => nextOf(snapMock.mock.calls[0] as unknown[])(qSnap([settle(1)])));
    expect(out()).toBe('loading');
    await act(async () => nextOf(snapMock.mock.calls[1] as unknown[])(qSnap([settle(2)])));
    expect(out()).toEqual(['g1', 'g2']);
  });

  it('30 ids is a single query; an empty list is ready without subscribing', async () => {
    function P({ ids }: { ids: string[] }) {
      return <Out v={useSettlements(ids)} pick={(r) => Object.keys(r)} />;
    }
    const view = await render(<P ids={[]} />);
    expect(snapMock).not.toHaveBeenCalled();
    expect(out()).toEqual([]);
    await view.rerender(<P ids={Array.from({ length: 30 }, (_, i) => `g${i}`)} />);
    expect(snapMock).toHaveBeenCalledTimes(1);
  });

  it('drops an invalid settlement and reports it to Crashlytics once', async () => {
    (recordError as jest.Mock).mockClear();
    const ids = ['s-ok', 's-bad'];
    function P() {
      return <Out v={useSettlements(ids)} pick={(r) => Object.keys(r)} />;
    }
    await render(<P />);
    const snap = {
      docs: [
        { id: 's-ok', ref: { path: 'settlements/s-ok' }, data: () => ({ finalHome: 1, finalAway: 0 }) },
        { id: 's-bad', ref: { path: 'settlements/s-bad' }, data: () => ({ finalHome: 'x' }) },
      ],
      metadata: { fromCache: false },
    };
    await act(async () => lastNext()(snap));
    expect(out()).toEqual(['s-ok']);
    expect(recordError).toHaveBeenCalledTimes(1);
    expect(String((recordError as jest.Mock).mock.calls[0]?.[1])).toContain('settlements/s-bad');
    await act(async () => lastNext()(snap));
    expect(recordError).toHaveBeenCalledTimes(1);
  });

  it('a listener failure is an error and is reported to Crashlytics', async () => {
    (recordError as jest.Mock).mockClear();
    const ids = ['s-err'];
    function P() {
      return <Out v={useSettlements(ids)} />;
    }
    await render(<P />);
    const call = snapMock.mock.calls[snapMock.mock.calls.length - 1] as unknown[];
    const onError = call.filter((a) => typeof a === 'function')[1] as (e: unknown) => void;
    await act(async () => onError(new Error('permission-denied')));
    expect(out()).toBe('error');
    expect(recordError).toHaveBeenCalledTimes(1);
  });

  it('a new array with the same ids does not resubscribe', async () => {
    function P({ ids }: { ids: string[] }) {
      useSettlements(ids);
      return null;
    }
    const view = await render(<P ids={['a', 'b']} />);
    await view.rerender(<P ids={['b', 'a']} />);
    expect(snapMock).toHaveBeenCalledTimes(1);
  });
});

describe('news and gameboxes', () => {
  it('useNews(sport) filters by sport; null reads all; both publishedAt desc, limit 40', async () => {
    function P({ sport }: { sport: 'futsal' | null }) {
      useNews(sport);
      return null;
    }
    const view = await render(<P sport="futsal" />);
    expect(where).toHaveBeenCalledWith('sport', '==', 'futsal');
    (where as jest.Mock).mockClear();
    await view.rerender(<P sport={null} />);
    expect(where).not.toHaveBeenCalled();
    expect(orderBy).toHaveBeenCalledWith('publishedAt', 'desc');
    expect(limit).toHaveBeenCalledWith(40);
  });

  it('useMyGameboxes filters by userid and sorts by order', async () => {
    function P({ uid }: { uid: string | null }) {
      return <Out v={useMyGameboxes(uid)} pick={(gs) => gs.map((g) => g.id)} />;
    }
    const view = await render(<P uid={null} />);
    expect(snapMock).not.toHaveBeenCalled();
    await view.rerender(<P uid="u1" />);
    expect(where).toHaveBeenCalledWith('userid', '==', 'u1');
    const g = (id: string, order: number) => ({ id, data: { userid: 'u1', gameboxNumber: 'enc', gameboxName: id, order } });
    await act(async () => lastNext()(qSnap([g('b', 2), g('a', 1)])));
    expect(out()).toEqual(['a', 'b']);
  });
});
