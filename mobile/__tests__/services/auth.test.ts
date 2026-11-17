const mockUpdateProfileCall = jest.fn();
jest.mock('@react-native-firebase/auth');
jest.mock('@react-native-firebase/firestore');
jest.mock('@react-native-firebase/functions');
jest.mock('@react-native-firebase/crashlytics');
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { signOut: jest.fn(() => Promise.resolve()) },
}));
jest.mock('@/services/firebase', () => ({
  authInstance: jest.fn(() => ({ __mock: 'auth', currentUser: null })),
  db: jest.fn(() => ({ __mock: 'firestore' })),
  fns: jest.fn(() => ({ __mock: 'functions' })),
  setAnalyticsUser: jest.fn(() => Promise.resolve()),
}));

import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from '@react-native-firebase/auth';
import { setDoc } from '@react-native-firebase/firestore';
import { httpsCallable } from '@react-native-firebase/functions';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { authInstance } from '@/services/firebase';
import { signInEmail, signUpEmail, sendReset, signOut } from '@/services/auth';
import { ensureProfile } from '@/services/profile';
import { claimProfileEnsure, resetProfileEnsured } from '@/lib/profileEnsured';

beforeEach(() => {
  jest.clearAllMocks();
  (httpsCallable as jest.Mock).mockReturnValue(mockUpdateProfileCall);
  mockUpdateProfileCall.mockResolvedValue({ data: {} });
});

describe('signInEmail', () => {
  it('calls signInWithEmailAndPassword with the trimmed email', async () => {
    (signInWithEmailAndPassword as jest.Mock).mockResolvedValue({});
    await signInEmail('  z@x.pt ', 'secret1');
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'z@x.pt', 'secret1');
  });
  it('maps not-found, wrong-password and invalid-credential to the same message', async () => {
    const msgs: string[] = [];
    for (const code of ['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential']) {
      (signInWithEmailAndPassword as jest.Mock).mockRejectedValueOnce({ code });
      msgs.push(await signInEmail('z@x.pt', 'x').then(() => '', (e: Error) => e.message));
    }
    expect(new Set(msgs)).toEqual(new Set(['Email ou password incorretos.']));
  });
  it('maps other errors through authErrorMessage', async () => {
    (signInWithEmailAndPassword as jest.Mock).mockRejectedValueOnce({ code: 'auth/too-many-requests' });
    await expect(signInEmail('z@x.pt', 'x')).rejects.toThrow('Demasiadas tentativas. Tenta mais tarde.');
  });
});

describe('signUpEmail', () => {
  it('writes users/{uid} with name and email, no displayName, then ensures the profile', async () => {
    (createUserWithEmailAndPassword as jest.Mock).mockResolvedValue({ user: { uid: 'u1' } });
    (setDoc as jest.Mock).mockResolvedValue(undefined);
    await signUpEmail('Zé', ' z@x.pt ', 'secret1');
    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'z@x.pt', 'secret1');
    const [ref, data, opts] = (setDoc as jest.Mock).mock.calls[0];
    expect(ref.path).toBe('users/u1');
    expect(data).toEqual(expect.objectContaining({ name: 'Zé', email: 'z@x.pt' }));
    expect(data).toHaveProperty('createdAt');
    expect(data).not.toHaveProperty('displayName');
    expect(opts).toEqual({ merge: true });
    expect(mockUpdateProfileCall).toHaveBeenCalledTimes(1);
    expect(mockUpdateProfileCall).toHaveBeenCalledWith({});
    // the write must precede ensureProfile
    expect((setDoc as jest.Mock).mock.invocationCallOrder[0]!).toBeLessThan(
      mockUpdateProfileCall.mock.invocationCallOrder[0]!,
    );
  });
  it('setDoc rejects: ensureProfile still called once, uid marked, resolves', async () => {
    resetProfileEnsured();
    (createUserWithEmailAndPassword as jest.Mock).mockResolvedValue({ user: { uid: 'u9' } });
    (setDoc as jest.Mock).mockRejectedValueOnce(new Error('rules'));
    await expect(signUpEmail('Zé', 'z@x.pt', 'secret1')).resolves.toBeUndefined();
    expect(mockUpdateProfileCall).toHaveBeenCalledTimes(1);
    expect(claimProfileEnsure('u9')).toBe(false); // already marked
  });
  it('createUser failing clears the sign-up flag so a later inherited session is ensured', async () => {
    resetProfileEnsured();
    (createUserWithEmailAndPassword as jest.Mock).mockRejectedValue({ code: 'auth/weak-password' });
    await expect(signUpEmail('Zé', 'z@x.pt', '1')).rejects.toThrow();
    expect(claimProfileEnsure('u10')).toBe(true);
  });
  it('says the email already exists on sign-up', async () => {
    (createUserWithEmailAndPassword as jest.Mock).mockRejectedValue({ code: 'auth/email-already-in-use' });
    await expect(signUpEmail('Zé', 'z@x.pt', 'secret1')).rejects.toThrow('Já existe uma conta com este email.');
  });
});

describe('sendReset', () => {
  it('swallows auth/user-not-found', async () => {
    (sendPasswordResetEmail as jest.Mock).mockRejectedValue({ code: 'auth/user-not-found' });
    await expect(sendReset('x@y.pt')).resolves.toBeUndefined();
  });
  it('maps other errors', async () => {
    (sendPasswordResetEmail as jest.Mock).mockRejectedValue({ code: 'auth/invalid-email' });
    await expect(sendReset('x')).rejects.toThrow('Email inválido.');
  });
});

describe('signOut', () => {
  it('signs out of Firebase and, for Google sessions, of Google', async () => {
    (authInstance as jest.Mock).mockReturnValue({
      currentUser: { providerData: [{ providerId: 'google.com' }] },
    });
    await signOut();
    expect(fbSignOut).toHaveBeenCalled();
    expect(GoogleSignin.signOut).toHaveBeenCalled();
  });
  it('does not touch Google for password sessions', async () => {
    (authInstance as jest.Mock).mockReturnValue({
      currentUser: { providerData: [{ providerId: 'password' }] },
    });
    await signOut();
    expect(GoogleSignin.signOut).not.toHaveBeenCalled();
  });
});

describe('ensureProfile', () => {
  it('never throws; failures go to crashlytics', async () => {
    mockUpdateProfileCall.mockRejectedValue(new Error('boom'));
    await expect(ensureProfile()).resolves.toBeUndefined();
  });
});
