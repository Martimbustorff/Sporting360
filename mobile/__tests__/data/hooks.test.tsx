import React from 'react';
import { Text } from 'react-native';
import { render, screen, act } from '@testing-library/react-native';
import { z } from 'zod';
import { collection, doc, onSnapshot } from '@react-native-firebase/firestore';
import { recordError } from '@react-native-firebase/crashlytics';
import {
  reportInvalidDocs,
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

// onSnapshot(ref, options, next, error): the callbacks are the function arguments, in order.
function lastSubscription(): { next: Next; error: Err; unsubscribe: jest.Mock; args: unknown[] } {
  const i = snapMock.mock.calls.length - 1;
  const args = snapMock.mock.calls[i] as unknown[];
  const fns = args.filter((a): a is (...x: never[]) => void => typeof a === 'function');
  const unsubscribe = snapMock.mock.results[i]?.value as jest.Mock;
  return { next: fns[0] as Next, error: fns[1] as Err, unsubscribe, args };
}

const docSnap = (data: unknown | null, fromCache = false) => ({
  exists: () => data !== null,
  data: () => data,
  id: 'x',
  metadata: { fromCache, hasPendingWrites: false },
});
const querySnap = (docs: { id: string; data: unknown }[], fromCache = false) => ({
  docs: docs.map((d) => ({ id: d.id, data: () => d.data, exists: () => true })),
  metadata: { fromCache, hasPendingWrites: false },
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
    expect(out()).toEqual({ status: 'ready', data: { name: 'Leão' }, fromCache: false });
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

  describe('opções (permissão negada esperada, caminho sem ids)', () => {
    const OPTS = { expectDenied: true, reportAs: 'things/*' } as const;
    const Opt = ({ path }: { path: string }) => <Probe value={useDocument(path, ItemSchema, OPTS)} />;
    const withCode = (code: string) => Object.assign(new Error('x'), { code });

    it('permission-denied esperado vira error sem ir ao Crashlytics', async () => {
      await render(<Opt path="things/L1" />);
      await act(async () => lastSubscription().error(withCode('firestore/permission-denied')));
      expect(out().status).toBe('error');
      expect(recordError).not.toHaveBeenCalled();
    });

    it('outros erros vão ao Crashlytics, com o caminho mascarado', async () => {
      await render(<Opt path="things/L1" />);
      await act(async () => lastSubscription().error(withCode('firestore/unavailable')));
      expect(recordError).toHaveBeenCalledTimes(1);
      expect(String((recordError as jest.Mock).mock.calls[0]?.[1]?.message)).not.toContain('L1');
    });

    it('documento inválido: o relatório e o erro usam o caminho mascarado', async () => {
      await render(<Opt path="things/L9" />);
      await act(async () => lastSubscription().next(docSnap({ name: 5 })));
      expect(recordError).toHaveBeenCalledTimes(1);
      expect(String((recordError as jest.Mock).mock.calls[0]?.[1]?.message)).not.toContain('L9');
      expect(out().message).not.toContain('L9');
    });

    it('sem a opção, permission-denied continua a ser reportado', async () => {
      await render(<DocProbe path="things/a" />);
      await act(async () => lastSubscription().error(withCode('firestore/permission-denied')));
      expect(recordError).toHaveBeenCalledTimes(1);
    });

    it('useLoanSecret e useLoan: negado esperado não se reporta e o id nunca vai num relatório', async () => {
      const { useLoan, useLoanSecret } = jest.requireActual('@/data/loans') as typeof import('@/data/loans');
      const P = () => (
        <>
          <Probe value={useLoanSecret('LOANID1')} />
        </>
      );
      await render(<P />);
      expect(doc).toHaveBeenCalledWith(expect.anything(), 'loans/LOANID1/secret/number');
      await act(async () => lastSubscription().error(withCode('firestore/permission-denied')));
      expect(recordError).not.toHaveBeenCalled();
      await act(async () => lastSubscription().error(withCode('firestore/unavailable')));
      expect(String((recordError as jest.Mock).mock.calls[0]?.[1]?.message)).not.toContain('LOANID1');
      expect(typeof useLoan).toBe('function');
    });
  });

  describe('cacheMissingIsLoading', () => {
    const Opt = () => <Probe value={useDocument('things/a', ItemSchema, { cacheMissingIsLoading: true })} />;

    it('em falta vindo da cache fica a carregar; só o servidor dá missing', async () => {
      await render(<Opt />);
      await act(async () => lastSubscription().next(docSnap(null, true)));
      expect(out().status).toBe('loading');
      await act(async () => lastSubscription().next(docSnap(null, false)));
      expect(out().status).toBe('missing');
    });

    it('cache em falta e depois servidor com o documento: fica ready', async () => {
      await render(<Opt />);
      await act(async () => lastSubscription().next(docSnap(null, true)));
      await act(async () => lastSubscription().next(docSnap({ name: 'A' }, false)));
      expect(out()).toEqual({ status: 'ready', data: { name: 'A' }, fromCache: false });
    });

    it('sem a opção, em falta vindo da cache continua a ser missing', async () => {
      await render(<DocProbe path="things/a" />);
      await act(async () => lastSubscription().next(docSnap(null, true)));
      expect(out().status).toBe('missing');
    });
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

describe('cache state (Review Focus 3)', () => {
  it('subscribes with includeMetadataChanges', async () => {
    await render(<DocProbe path="things/a" />);
    expect(lastSubscription().args[1]).toEqual({ includeMetadataChanges: true });
  });

  it('document: fromCache follows the snapshot metadata', async () => {
    await render(<DocProbe path="things/a" />);
    await act(async () => lastSubscription().next(docSnap({ name: 'A' }, true)));
    expect(out()).toEqual({ status: 'ready', data: { name: 'A' }, fromCache: true });
    await act(async () => lastSubscription().next(docSnap({ name: 'A' }, false)));
    expect(out()).toEqual({ status: 'ready', data: { name: 'A' }, fromCache: false });
  });

  it('collection: fromCache follows the snapshot metadata', async () => {
    const q = { __k: 'cache' } as unknown as Parameters<typeof useCollection>[0];
    function C() {
      return <Probe value={useCollection(q, ItemSchema)} />;
    }
    await render(<C />);
    expect(lastSubscription().args[1]).toEqual({ includeMetadataChanges: true });
    await act(async () => lastSubscription().next(querySnap([{ id: 'a', data: { name: 'A' } }], true)));
    expect(out()).toEqual({ status: 'ready', data: [{ id: 'a', name: 'A' }], fromCache: true });
    await act(async () => lastSubscription().next(querySnap([{ id: 'a', data: { name: 'A' } }], false)));
    expect(out()).toEqual({ status: 'ready', data: [{ id: 'a', name: 'A' }], fromCache: false });
  });
});

describe('stale data on input change', () => {
  it('never returns the previous path data on the first render after a change', async () => {
    const seen: string[] = [];
    function Spy({ path }: { path: string }) {
      const v = useDocument(path, ItemSchema);
      seen.push(`${path}:${v.status === 'ready' ? v.data.name : v.status}`);
      return null;
    }
    const view = await render(<Spy path="users/a" />);
    await act(async () => lastSubscription().next(docSnap({ name: 'A-private' })));
    seen.length = 0;
    await view.rerender(<Spy path="users/b" />);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((s) => s === 'users/b:loading')).toBe(true);
  });

  it('same for collections when the query changes', async () => {
    const q1 = { id: 1 } as unknown as Parameters<typeof useCollection>[0];
    const q2 = { id: 2 } as unknown as Parameters<typeof useCollection>[0];
    const seen: string[] = [];
    function Spy({ query, tag }: { query: typeof q1; tag: string }) {
      const v = useCollection(query, ItemSchema);
      seen.push(`${tag}:${v.status}`);
      return null;
    }
    const view = await render(<Spy query={q1} tag="q1" />);
    await act(async () => lastSubscription().next(querySnap([{ id: 'a', data: { name: 'A' } }])));
    seen.length = 0;
    await view.rerender(<Spy query={q2} tag="q2" />);
    expect(seen.every((s) => s === 'q2:loading')).toBe(true);
  });

  it('a stable query reference subscribes once across re-renders', async () => {
    const q = { id: 1 } as unknown as Parameters<typeof useCollection>[0];
    function C({ n }: { n: number }) {
      useCollection(q, ItemSchema);
      return <Text>{n}</Text>;
    }
    const view = await render(<C n={1} />);
    await view.rerender(<C n={2} />);
    await view.rerender(<C n={3} />);
    expect(snapMock).toHaveBeenCalledTimes(1);
  });

  it('reports the same invalid path to Crashlytics only once', async () => {
    const bad = { __k: 'dedupe' } as unknown as Parameters<typeof useCollection>[0];
    function C() {
      useCollection(bad, ItemSchema);
      return null;
    }
    await render(<C />);
    const snap = {
      docs: [{ id: 'bad', ref: { path: 'dedupe/bad' }, data: () => ({ name: 1 }) }],
    };
    await act(async () => lastSubscription().next(snap));
    await act(async () => lastSubscription().next(snap));
    expect(recordError).toHaveBeenCalledTimes(1);
  });
});

describe('useCollection', () => {
  const q = { __kind: 'collection', path: 'things' } as unknown as Parameters<typeof useCollection>[0];
  function ColProbe({ query }: { query: typeof q }) {
    return <Probe value={useCollection(query, ItemSchema)} />;
  }

  describe('opções (permissão negada esperada)', () => {
    const OPTS = { expectDenied: true, reportAs: 'things' } as const;
    const withCode = (code: string) => Object.assign(new Error('x'), { code });
    const Opt = () => <Probe value={useCollection(q, ItemSchema, OPTS)} />;

    it('permission-denied esperado vira error sem ir ao Crashlytics', async () => {
      await render(<Opt />);
      await act(async () => lastSubscription().error(withCode('firestore/permission-denied')));
      expect(out().status).toBe('error');
      expect(recordError).not.toHaveBeenCalled();
    });

    it('outros erros vão ao Crashlytics; sem a opção, permission-denied também', async () => {
      await render(<Opt />);
      await act(async () => lastSubscription().error(withCode('firestore/unavailable')));
      expect(recordError).toHaveBeenCalledTimes(1);
      (recordError as jest.Mock).mockClear();
      await render(<ColProbe query={{ __kind: 'other' } as unknown as typeof q} />);
      await act(async () => lastSubscription().error(withCode('firestore/permission-denied')));
      expect(recordError).toHaveBeenCalledTimes(1);
    });
  });

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
      fromCache: false,
    });
    expect(recordError).toHaveBeenCalledTimes(1);
  });

  it('an empty collection is ready with []', async () => {
    await render(<ColProbe query={q} />);
    await act(async () => lastSubscription().next(querySnap([])));
    expect(out()).toEqual({ status: 'ready', data: [], fromCache: false });
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

describe('reportInvalidDocs (privacidade)', () => {
  it('a mensagem para o Crashlytics leva só coleções e contagem, nunca o uid dos ids', () => {
    reportInvalidDocs(
      ['matchPredictions/1001_UID-ABC123', 'pointEvents/UID-ABC123_1001_prediction_exact', 'users/UID-ABC123/pointEvents/x1'],
      'collection',
    );
    expect(recordError).toHaveBeenCalledTimes(1);
    const msg = ((recordError as jest.Mock).mock.calls[0][1] as Error).message;
    expect(msg).not.toContain('UID-ABC123');
    expect(msg).toContain('matchPredictions x1');
    expect(msg).toContain('pointEvents x1');
    expect(msg).toContain('users/pointEvents x1');
  });
});
