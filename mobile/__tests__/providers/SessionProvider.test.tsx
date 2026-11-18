import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';

jest.mock('@react-native-firebase/auth');
jest.mock('@react-native-firebase/crashlytics');
const mockAuth: { currentUser: unknown } = { currentUser: null };
jest.mock('@/services/firebase', () => ({
  authInstance: jest.fn(() => mockAuth),
  setAnalyticsUser: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/services/profile', () => ({ ensureProfile: jest.fn(() => Promise.resolve()) }));

import { onAuthStateChanged, reload } from '@react-native-firebase/auth';
import { setUserId } from '@react-native-firebase/crashlytics';
import { setAnalyticsUser } from '@/services/firebase';
import { ensureProfile } from '@/services/profile';
import {
  SessionProvider,
  useRefreshProviders,
  useSession,
  markProfileEnsured,
  resetProfileEnsured,
} from '@/providers/SessionProvider';
import { beginSignUp } from '@/lib/profileEnsured';
import { consumeColdStart, resetColdStartForTests } from '@/lib/lockSession';

type Listener = (u: unknown) => void;
let listener: Listener;
const states: string[] = [];

function Probe() {
  const s = useSession();
  states.push(s.status);
  return <Text testID="s">{s.status}:{s.user?.uid ?? '-'}</Text>;
}
const tree = () => (
  <SessionProvider>
    <Probe />
  </SessionProvider>
);
const user = (uid: string) => ({ uid, email: 'a@b.pt', providerData: [{ providerId: 'password' }] });

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.currentUser = null;
  states.length = 0;
  resetProfileEnsured();
  (onAuthStateChanged as jest.Mock).mockImplementation((_a: unknown, cb: Listener) => {
    listener = cb;
    return jest.fn();
  });
});

describe('SessionProvider', () => {
  it('inherited V2 session: loading -> signedIn (never signedOut), ensureProfile once despite re-renders', async () => {
    const r = await render(tree());
    expect(states[0]).toBe('loading');
    await act(async () => listener(user('u1')));
    await r.rerender(tree());
    await r.rerender(tree());
    await act(async () => listener(user('u1')));
    expect(states).not.toContain('signedOut');
    expect(states[states.length - 1]).toBe('signedIn');
    expect(ensureProfile).toHaveBeenCalledTimes(1);
    expect(setAnalyticsUser).toHaveBeenCalledWith('u1');
    // O Crashlytics nunca recebe o uid (a política de privacidade diz que os relatórios não levam a conta).
    expect(setUserId).not.toHaveBeenCalled();
  });

  it('no user -> signedOut, nothing ensured', async () => {
    await render(tree());
    await act(async () => listener(null));
    expect(states[states.length - 1]).toBe('signedOut');
    expect(ensureProfile).not.toHaveBeenCalled();
  });

  it('does not call ensureProfile when signUpEmail already ensured this uid', async () => {
    await render(tree());
    markProfileEnsured('u2');
    await act(async () => listener(user('u2')));
    expect(ensureProfile).not.toHaveBeenCalled();
  });

  it('does not call ensureProfile while a sign-up is in progress (name not written yet)', async () => {
    await render(tree());
    beginSignUp();
    await act(async () => listener(user('u4')));
    expect(ensureProfile).not.toHaveBeenCalled();
  });

  it('calls it again for a different uid after sign-out', async () => {
    await render(tree());
    await act(async () => listener(user('u1')));
    await act(async () => listener(null));
    await act(async () => listener(user('u3')));
    expect(ensureProfile).toHaveBeenCalledTimes(2);
  });

  it('ensureProfile failing does not change the state', async () => {
    (ensureProfile as jest.Mock).mockRejectedValueOnce(new Error('x'));
    const r = await render(tree());
    await act(async () => listener(user('u1')));
    expect(r.getByTestId('s')).toHaveTextContent('signedIn:u1');
  });

  it('signedOut observed at start: the next login is not a cold start (biometric gate must not lock)', async () => {
    resetColdStartForTests();
    await render(tree());
    await act(async () => listener(null));
    await act(async () => listener(user('u1')));
    expect(consumeColdStart()).toBe(false);
  });

  it('inherited session (never signedOut) keeps the cold start for the gate', async () => {
    resetColdStartForTests();
    await render(tree());
    await act(async () => listener(user('u1')));
    expect(consumeColdStart()).toBe(true);
  });

  describe('refreshProviders (Task 27: depois de ligar a Apple)', () => {
    let refresh: () => Promise<void>;
    function ProvidersProbe() {
      const s = useSession();
      refresh = useRefreshProviders();
      return <Text testID="p">{s.user?.providers.join(',') ?? '-'}</Text>;
    }
    const ptree = () => (
      <SessionProvider>
        <ProvidersProbe />
      </SessionProvider>
    );

    it('faz reload() ao utilizador atual e atualiza os providers da sessão', async () => {
      const r = await render(ptree());
      await act(async () => listener(user('u1')));
      expect(r.getByTestId('p')).toHaveTextContent('password');
      const current = { ...user('u1'), providerData: [{ providerId: 'password' }] };
      mockAuth.currentUser = current;
      (reload as jest.Mock).mockImplementationOnce(async () => {
        current.providerData = [{ providerId: 'password' }, { providerId: 'apple.com' }];
      });
      await act(async () => refresh());
      expect(reload).toHaveBeenCalledWith(current);
      expect(r.getByTestId('p')).toHaveTextContent('password,apple.com');
    });

    it('sem utilizador atual não faz nada', async () => {
      await render(ptree());
      await act(async () => listener(null));
      await act(async () => refresh());
      expect(reload).not.toHaveBeenCalled();
    });

    it('fora do provider é um no-op', async () => {
      let fallback: (() => Promise<void>) | undefined;
      function Bare() {
        fallback = useRefreshProviders();
        return null;
      }
      await render(<Bare />);
      await expect(fallback!()).resolves.toBeUndefined();
    });
  });
});
