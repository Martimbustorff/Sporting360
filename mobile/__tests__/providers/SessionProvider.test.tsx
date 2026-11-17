import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';

jest.mock('@react-native-firebase/auth');
jest.mock('@react-native-firebase/crashlytics');
jest.mock('@/services/firebase', () => ({
  authInstance: jest.fn(() => ({ __mock: 'auth' })),
  setAnalyticsUser: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/services/profile', () => ({ ensureProfile: jest.fn(() => Promise.resolve()) }));

import { onAuthStateChanged } from '@react-native-firebase/auth';
import { setUserId } from '@react-native-firebase/crashlytics';
import { setAnalyticsUser } from '@/services/firebase';
import { ensureProfile } from '@/services/profile';
import { SessionProvider, useSession, markProfileEnsured, resetProfileEnsured } from '@/providers/SessionProvider';
import { beginSignUp } from '@/lib/profileEnsured';

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
    expect(setUserId).toHaveBeenCalledWith(expect.anything(), 'u1');
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
});
