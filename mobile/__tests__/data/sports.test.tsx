import React from 'react';
import { Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { collection, doc, limit, onSnapshot, orderBy, query, where } from '@react-native-firebase/firestore';
import {
  useMatch,
  useMatchDetail,
  useMatchVideos,
  useHomeMatches,
  useNextFootballMatch,
  useResultMatches,
  useSeasonFootballCompetitions,
  useTeamData,
  useUpcomingMatches,
} from '@/data/sports';
import type { Loadable } from '@/data/hooks';

jest.mock('@react-native-firebase/app');
jest.mock('@react-native-firebase/firestore');
jest.mock('@react-native-firebase/crashlytics');

const snapMock = onSnapshot as unknown as jest.Mock;
type Next = (snap: unknown) => void;
function lastNext(): Next {
  const args = snapMock.mock.calls[snapMock.mock.calls.length - 1] as unknown[];
  return args.find((a) => typeof a === 'function') as Next;
}

const ts = (iso: string) => ({ toDate: () => new Date(iso) });
const matchData = (id: string, kickoff: string, status = 'NS', over: Record<string, unknown> = {}) => ({
  id,
  sport: 'football',
  competition: { key: `football_94_2026`, id: '94', name: 'Liga Portugal', type: 'league', season: '2026', round: null, roundLabel: null },
  home: { id: '228', name: 'Sporting CP', logo: null },
  away: { id: '211', name: 'Benfica', logo: null },
  sportingSide: 'home',
  kickoff: ts(kickoff),
  status,
  elapsed: null,
  score: { home: null, away: null, halftime: null, extratime: null, penalty: null },
  finishedAt: null,
  source: { provider: 'api-football', id },
  ...over,
});
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
  for (const m of [doc, collection, query, where, orderBy, limit]) (m as jest.Mock).mockClear();
});

const NOW = new Date('2026-11-18T12:00:00Z');

describe('match documents', () => {
  it('useMatch reads matches/{id}; null never subscribes', async () => {
    function P({ id }: { id: string | null }) {
      return <Out v={useMatch(id)} pick={(m) => m.kickoff.toISOString()} />;
    }
    const view = await render(<P id={null} />);
    expect(snapMock).not.toHaveBeenCalled();
    await view.rerender(<P id="9001" />);
    expect(doc).toHaveBeenLastCalledWith(expect.anything(), 'matches/9001');
    await act(async () => lastNext()({ exists: () => true, data: () => matchData('9001', '2026-11-20T20:30:00Z'), metadata: { fromCache: false } }));
    expect(out()).toBe('2026-11-20T20:30:00.000Z');
  });

  it('useMatchDetail reads details/{kind}', async () => {
    function P() {
      useMatchDetail('9001', 'prematch');
      return null;
    }
    await render(<P />);
    expect(doc).toHaveBeenLastCalledWith(expect.anything(), 'matches/9001/details/prematch');
  });

  it('useMatchVideos sorts by publishedAt asc, nulls last', async () => {
    function P() {
      return <Out v={useMatchVideos('9001')} pick={(vs) => vs.map((x) => x.id)} />;
    }
    await render(<P />);
    expect(collection).toHaveBeenLastCalledWith(expect.anything(), 'matches/9001/videos');
    const v = (id: string, at: string | null) => ({ id, data: { id, title: id, minute: null, type: 'golo', thumbnail: null, embedSrc: 'https://www.vsports.pt/e', publishedAt: at ? ts(at) : null } });
    await act(async () => lastNext()(qSnap([v('c', null), v('b', '2026-11-18T22:00:00Z'), v('a', '2026-11-18T21:00:00Z')])));
    expect(out()).toEqual(['a', 'b', 'c']);
  });
});

describe('match lists', () => {
  it('upcoming: sport, kickoff >= now - 4 h, asc, limit 40', async () => {
    function P() {
      useUpcomingMatches('futsal', NOW);
      return null;
    }
    await render(<P />);
    expect(where).toHaveBeenCalledWith('sport', '==', 'futsal');
    expect(where).toHaveBeenCalledWith('kickoff', '>=', new Date(NOW.getTime() - 4 * 3_600_000));
    expect(orderBy).toHaveBeenCalledWith('kickoff', 'asc');
    expect(limit).toHaveBeenCalledWith(40);
  });

  it('results: kickoff < now, desc, limit 40', async () => {
    function P() {
      useResultMatches('football', NOW);
      return null;
    }
    await render(<P />);
    expect(where).toHaveBeenCalledWith('kickoff', '<', NOW);
    expect(orderBy).toHaveBeenCalledWith('kickoff', 'desc');
    expect(limit).toHaveBeenCalledWith(40);
  });

  it('a null sport never subscribes', async () => {
    function P() {
      useUpcomingMatches(null, NOW);
      return null;
    }
    await render(<P />);
    expect(snapMock).not.toHaveBeenCalled();
  });

  it('does not resubscribe within the same 10-minute block, does in the next', async () => {
    function P({ now }: { now: Date }) {
      useUpcomingMatches('football', now);
      return null;
    }
    const block = Math.floor(NOW.getTime() / 600_000) * 600_000;
    const view = await render(<P now={new Date(block + 1_000)} />);
    await view.rerender(<P now={new Date(block + 590_000)} />);
    expect(snapMock).toHaveBeenCalledTimes(1);
    await view.rerender(<P now={new Date(block + 600_000)} />);
    expect(snapMock).toHaveBeenCalledTimes(2);
  });

  it('useNextFootballMatch skips finished and cancelled games', async () => {
    function P() {
      return <Out v={useNextFootballMatch(NOW)} pick={(m) => m?.id ?? null} />;
    }
    await render(<P />);
    expect(where).toHaveBeenCalledWith('sport', '==', 'football');
    expect(limit).toHaveBeenCalledWith(3);
    await act(async () =>
      lastNext()(qSnap([
        { id: '1', data: matchData('1', '2026-11-18T09:00:00Z', 'FT') },
        { id: '2', data: matchData('2', '2026-11-18T13:00:00Z', 'CANC') },
        { id: '3', data: matchData('3', '2026-11-20T20:30:00Z', 'NS') },
      ])),
    );
    expect(out()).toBe('3');
  });

  it('useNextFootballMatch is null when nothing qualifies', async () => {
    function P() {
      return <Out v={useNextFootballMatch(NOW)} pick={(m) => m?.id ?? null} />;
    }
    await render(<P />);
    await act(async () => lastNext()(qSnap([{ id: '1', data: matchData('1', '2026-11-18T09:00:00Z', 'AET') }])));
    expect(out()).toBeNull();
  });
});

describe('useHomeMatches', () => {
  it('lê o futebol desde 24 h antes, por apito, e só reconstrói a query com outra tentativa', async () => {
    function P({ attempt }: { attempt: number }) {
      return <Out v={useHomeMatches(NOW, attempt)} pick={(ms) => ms.map((m) => m.id)} />;
    }
    const view = await render(<P attempt={0} />);
    expect(where).toHaveBeenCalledWith('sport', '==', 'football');
    expect(where).toHaveBeenCalledWith('kickoff', '>=', new Date('2026-11-17T12:00:00Z'));
    expect(limit).toHaveBeenCalledWith(6);
    await act(async () =>
      lastNext()(qSnap([
        { id: '1', data: matchData('1', '2026-11-18T09:00:00Z', 'FT') },
        { id: '3', data: matchData('3', '2026-11-20T20:30:00Z', 'NS') },
      ])),
    );
    expect(out()).toEqual(['1', '3']);
    await view.rerender(<P attempt={0} />);
    expect(snapMock).toHaveBeenCalledTimes(1);
    await view.rerender(<P attempt={1} />);
    expect(snapMock).toHaveBeenCalledTimes(2);
  });
});

describe('competitions and team', () => {
  it('useSeasonFootballCompetitions: distinct, no friendlies, league then cups then europe', async () => {
    function P() {
      return <Out v={useSeasonFootballCompetitions('2026')} />;
    }
    await render(<P />);
    expect(where).toHaveBeenCalledWith('competition.season', '==', '2026');
    const comp = (key: string, id: string, name: string, type: string) => ({ key, id, name, type, season: '2026', round: null, roundLabel: null });
    await act(async () =>
      lastNext()(qSnap([
        { id: '0', data: matchData('0', '2026-10-01T20:00:00Z', 'FT', { competition: comp('football_96_2026', '96', 'Taça de Portugal', 'cup') }) },
        { id: '1', data: matchData('1', '2026-09-01T20:00:00Z', 'FT', { competition: comp('football_94_2026', '94', 'Liga Portugal', 'league') }) },
        { id: '2', data: matchData('2', '2026-09-08T20:00:00Z', 'FT', { competition: comp('football_94_2026', '94', 'Liga Portugal', 'league') }) },
        { id: '3', data: matchData('3', '2026-09-15T20:00:00Z', 'FT', { competition: comp('football_2_2026', '2', 'Liga dos Campeões', 'europe') }) },
        { id: '4', data: matchData('4', '2026-07-15T20:00:00Z', 'FT', { competition: comp('football_667_2026', '667', 'Particular', 'friendly') }) },
      ])),
    );
    expect(out()).toEqual([
      { key: 'football_94_2026', leagueId: '94', name: 'Liga Portugal', type: 'league' },
      { key: 'football_96_2026', leagueId: '96', name: 'Taça de Portugal', type: 'cup' },
      { key: 'football_2_2026', leagueId: '2', name: 'Liga dos Campeões', type: 'europe' },
    ]);
  });

  it('useTeamData reads teams/football_228/data/{kind}', async () => {
    function P() {
      useTeamData('squad');
      return null;
    }
    await render(<P />);
    expect(doc).toHaveBeenLastCalledWith(expect.anything(), 'teams/football_228/data/squad');
  });
});
