import React from 'react';
import { Text } from 'react-native';
import { render, screen, act } from '@testing-library/react-native';
import { z } from 'zod';
import { collection, doc, onSnapshot } from '@react-native-firebase/firestore';
import { recordError } from '@react-native-firebase/crashlytics';
import {
  useAppConfig,
  useCollection,
  useDocument,
  useMyUser,
  usePublicProfile,
  type Loadable,
} from '@/data/hooks';

jest.mock('@react-native-firebase/app');
jest.mock('@react-native-firebase/auth');
jest.mock('@react-native-firebase/firestore');
jest.mock('@react-native-firebase/functions');
jest.mock('@react-native-firebase/crashlytics');
jest.mock('@react-native-firebase/analytics');
jest.mock('@react-native-firebase/app-check');

const snapMock = onSnapshot as unknown as jest.Mock;

type Next = (snap: unknown) => void;
type Err = (e: Error) => void;

function lastSubscription(): { next: Next; error: Err; unsubscribe: jest.Mock } {
  const i = snapMock.mock.calls.length - 1;
  const call = snapMock.mock.calls[i] as [unknown, Next, Err];
  const unsubscribe = snapMock.mock.results[i]?.value as jest.Mock;
  return { next: call[1], error: call[2], unsubscribe };
}

const docSnap = (data: unknown | null) => ({
  exists: () => data !== null,
  data: () => data,
  id: 'x',
});
const querySnap = (docs: { id: string; data: unknown }[]) => ({
  docs: docs.map((d) => ({ id: d.id, data: () => d.data, exists: () => true })),
});

const ItemSchema = z.object({ name: z.string() });

function Probe<T>({ value }: { value: Loadable<T> }) {
  return <Text testID="out">{JSON.stringify(value.status === 'error' ? { status: 'error', message: value.error.message } : value)}</Text>;
}
function out(): { status: string; data?: unknown; message?: string } {
  return JSON.parse(String(screen.getByTestId('out').props.children));
}

function DocProbe({ path }: { path: string | null }) {
  return <Probe value={useDocument(path, ItemSchema)} />;
}

beforeEach(() => {
  snapMock.mockClear().mockImplementation(() => jest.fn());
  (recordError as jest.Mock).mockClear();
  (doc as jest.Mock).mockClear();
});

describe('useDocument', () => {
  it('is loading, then ready with the data', async () => {
    await render(<DocProbe path="things/a" />);
    expect(out().status).toBe('loading');
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'things/a');
    await act(async () => lastSubscription().next(docSnap({ name: 'Leão' })));
    expect(out()).toEqual({ status: 'ready', data: { name: 'Leão' } });
  });

  it('reports a missing document', async () => {
    await render(<DocProbe path="things/a" />);
    await act(async () => lastSubscription().next(docSnap(null)));
    expect(out().status).toBe('missing');
  });

  it('turns a schema failure into error without throwing, and records it', async () => {
    await render(<DocProbe path="things/a" />);
    await act(async () => lastSubscription().next(docSnap({ name: 5 })));
    expect(out().status).toBe('error');
    expect(recordError).toHaveBeenCalledTimes(1);
  });

  it('turns a listener failure into error and records it', async () => {
    await render(<DocProbe path="things/a" />);
    await act(async () => lastSubscription().error(new Error('permission-denied')));
    expect(out()).toEqual({ status: 'error', message: 'permission-denied' });
    expect(recordError).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes on unmount', async () => {
    const view = await render(<DocProbe path="things/a" />);
    const { unsubscribe } = lastSubscription();
    expect(unsubscribe).not.toHaveBeenCalled();
    await view.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('never subscribes when path is null', async () => {
    await render(<DocProbe path={null} />);
    expect(out().status).toBe('loading');
    expect(snapMock).not.toHaveBeenCalled();
  });

  it('resubscribes and goes back to loading when the path changes', async () => {
    const view = await render(<DocProbe path="things/a" />);
    const first = lastSubscription();
    await act(async () => first.next(docSnap({ name: 'A' })));
    await view.rerender(<DocProbe path="things/b" />);
    expect(first.unsubscribe).toHaveBeenCalledTimes(1);
    expect(snapMock).toHaveBeenCalledTimes(2);
    expect(out().status).toBe('loading');
  });
});

describe('useCollection', () => {
  const q = { __kind: 'collection', path: 'things' } as unknown as Parameters<typeof useCollection>[0];
  function ColProbe({ query }: { query: typeof q }) {
    return <Probe value={useCollection(query, ItemSchema)} />;
  }

  it('drops invalid documents one by one and adds the id', async () => {
    await render(<ColProbe query={q} />);
    await act(async () =>
      lastSubscription().next(
        querySnap([
          { id: 'a', data: { name: 'A' } },
          { id: 'bad', data: { name: 1 } },
          { id: 'c', data: { name: 'C' } },
        ]),
      ),
    );
    expect(out()).toEqual({
      status: 'ready',
      data: [
        { id: 'a', name: 'A' },
        { id: 'c', name: 'C' },
      ],
    });
    expect(recordError).toHaveBeenCalledTimes(1);
  });

  it('an empty collection is ready with []', async () => {
    await render(<ColProbe query={q} />);
    await act(async () => lastSubscription().next(querySnap([])));
    expect(out()).toEqual({ status: 'ready', data: [] });
  });

  it('never subscribes when the query is null', async () => {
    await render(<ColProbe query={null} />);
    expect(out().status).toBe('loading');
    expect(snapMock).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount', async () => {
    const view = await render(<ColProbe query={q} />);
    const { unsubscribe } = lastSubscription();
    await view.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('turns a listener failure into error', async () => {
    await render(<ColProbe query={q} />);
    await act(async () => lastSubscription().error(new Error('boom')));
    expect(out().status).toBe('error');
  });
});

describe('typed wrappers', () => {
  function Wrappers({ uid }: { uid: string | null }) {
    const cfg = useAppConfig();
    const pub = usePublicProfile(uid);
    const me = useMyUser(uid);
    return <Text testID="out">{[cfg.status, pub.status, me.status].join(',')}</Text>;
  }

  it('useAppConfig reads config/app and parses it', async () => {
    await render(<Wrappers uid={null} />);
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'config/app');
    await act(async () =>
      lastSubscription().next(docSnap({ minVersion: { ios: '7.0.0', android: '7.0.0' } })),
    );
    expect(String(screen.getByTestId('out').props.children)).toBe('ready,loading,loading');
  });

  it('config/app without minVersion is error, not an exception', async () => {
    await render(<Wrappers uid={null} />);
    await act(async () => lastSubscription().next(docSnap({ texts: {} })));
    expect(String(screen.getByTestId('out').props.children)).toBe('error,loading,loading');
  });

  it('usePublicProfile and useMyUser use their own paths and wait for a uid', async () => {
    await render(<Wrappers uid="u1" />);
    const paths = (doc as jest.Mock).mock.calls.map((c) => c[1]);
    expect(paths).toEqual(expect.arrayContaining(['config/app', 'publicProfiles/u1', 'users/u1']));
    expect(collection).not.toHaveBeenCalled();
  });

  it('with no uid only config/app is subscribed', async () => {
    await render(<Wrappers uid={null} />);
    expect(snapMock).toHaveBeenCalledTimes(1);
  });
});
