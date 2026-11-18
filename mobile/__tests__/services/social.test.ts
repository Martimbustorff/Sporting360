// Task 14: login Google e Apple com ligação de contas. Módulos nativos mockados.
import { createHash } from 'node:crypto';

const mockLinkCall = jest.fn();
const mockUpdateProfileCall = jest.fn();

jest.mock('@react-native-firebase/auth');
jest.mock('@react-native-firebase/firestore');
jest.mock('@react-native-firebase/functions');
jest.mock('@react-native-firebase/crashlytics');
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(),
    signInSilently: jest.fn(),
    signOut: jest.fn(() => Promise.resolve(null)),
  },
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED', IN_PROGRESS: 'IN_PROGRESS' },
}));
jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex', BASE64: 'base64' },
  getRandomBytes: jest.fn((n: number) => new Uint8Array(require('node:crypto').randomBytes(n))),
  digestStringAsync: jest.fn(async (_alg: string, data: string) =>
    require('node:crypto').createHash('sha256').update(data).digest('hex'),
  ),
}));
jest.mock('@/services/firebase', () => ({
  authInstance: jest.fn(() => ({ __mock: 'auth', currentUser: { uid: 'me' } })),
  db: jest.fn(() => ({ __mock: 'firestore' })),
  fns: jest.fn(() => ({ __mock: 'functions' })),
  setAnalyticsUser: jest.fn(() => Promise.resolve()),
}));

import * as AppleAuthentication from 'expo-apple-authentication';
import { linkWithCredential, reauthenticateWithCredential, signInWithCredential } from '@react-native-firebase/auth';
import { getDoc, setDoc } from '@react-native-firebase/firestore';
import { recordError } from '@react-native-firebase/crashlytics';
import { httpsCallable } from '@react-native-firebase/functions';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { claimProfileEnsure, resetProfileEnsured } from '@/lib/profileEnsured';
import {
  APPLE_IN_USE_MESSAGE,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
  NEEDS_EXISTING_LOGIN_MESSAGE,
  linkAppleToCurrentUser,
  reauthenticateWithApple,
  reauthenticateWithGoogle,
  signInWithApple,
  signInWithGoogle,
} from '@/services/social';

const EXISTS = { code: 'auth/account-exists-with-different-credential' };
const sha256hex = (s: string) => createHash('sha256').update(s).digest('hex');

function googleSuccess(idToken = 'g-token', name: string | null = 'Zé Leão') {
  return { type: 'success', data: { idToken, user: { id: 'g1', name, email: 'ze@x.pt' } } };
}
function appleCredential(identityToken = 'a-token', fullName: { givenName: string | null; familyName: string | null } | null = null) {
  return { identityToken, fullName, email: 'ze@x.pt', authorizationCode: 'code', user: 'a1' };
}
function userCred(uid: string, isNewUser: boolean, email = 'ze@x.pt') {
  return { user: { uid, email }, additionalUserInfo: { isNewUser, providerId: 'x' } };
}

beforeEach(() => {
  jest.clearAllMocks();
  resetProfileEnsured();
  (httpsCallable as jest.Mock).mockImplementation((_f: unknown, name: string) =>
    name === 'linkProviderByEmail' ? mockLinkCall : mockUpdateProfileCall,
  );
  mockUpdateProfileCall.mockResolvedValue({ data: {} });
  (setDoc as jest.Mock).mockResolvedValue(undefined);
  // Por omissão o documento users/{uid} já existe (utilizadores existentes não são reescritos).
  (getDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => ({ name: 'Antigo' }) });
});

describe('constantes', () => {
  it('usa os client ids da V2', () => {
    expect(GOOGLE_WEB_CLIENT_ID).toBe('394641993263-m82d9jj7m2do7204davvqo5k1f09epoh.apps.googleusercontent.com');
    expect(GOOGLE_IOS_CLIENT_ID).toBe('394641993263-84tree10asc01anqldkhog14sbqq1k7b.apps.googleusercontent.com');
  });
});

describe('signInWithGoogle', () => {
  it('utilizador novo: signedIn, users/{uid} com name e email em merge, perfil garantido', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue(googleSuccess());
    (signInWithCredential as jest.Mock).mockResolvedValue(userCred('u1', true));

    await expect(signInWithGoogle()).resolves.toEqual({ status: 'signedIn' });

    expect(GoogleSignin.configure).toHaveBeenCalledWith(
      expect.objectContaining({ webClientId: GOOGLE_WEB_CLIENT_ID, iosClientId: GOOGLE_IOS_CLIENT_ID }),
    );
    expect(signInWithCredential).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ providerId: 'google.com', token: 'g-token' }),
    );
    expect(setDoc).toHaveBeenCalledTimes(1);
    const [ref, data, opts] = (setDoc as jest.Mock).mock.calls[0];
    expect(ref.path).toBe('users/u1');
    expect(data).toEqual(expect.objectContaining({ name: 'Zé Leão', email: 'ze@x.pt' }));
    expect(data).not.toHaveProperty('displayName');
    expect(opts).toEqual({ merge: true });
    expect(mockUpdateProfileCall).toHaveBeenCalledTimes(1);
    expect(claimProfileEnsure('u1')).toBe(false);
  });

  it('utilizador novo sem nome: não escreve name', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue(googleSuccess('g-token', null));
    (signInWithCredential as jest.Mock).mockResolvedValue(userCred('u1', true));
    await signInWithGoogle();
    expect((setDoc as jest.Mock).mock.calls[0][1]).not.toHaveProperty('name');
  });

  it('utilizador existente com documento: não reescreve users/{uid}', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue(googleSuccess());
    (signInWithCredential as jest.Mock).mockResolvedValue(userCred('u1', false));
    await expect(signInWithGoogle()).resolves.toEqual({ status: 'signedIn' });
    expect((getDoc as jest.Mock).mock.calls[0][0].path).toBe('users/u1');
    expect(setDoc).not.toHaveBeenCalled();
    expect(mockUpdateProfileCall).toHaveBeenCalledTimes(1);
  });

  it('paridade V2: utilizador existente sem documento users/{uid} → cria { name, email } em merge', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue(googleSuccess());
    (signInWithCredential as jest.Mock).mockResolvedValue(userCred('u1', false));
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false, data: () => undefined });
    await expect(signInWithGoogle()).resolves.toEqual({ status: 'signedIn' });
    expect(setDoc).toHaveBeenCalledTimes(1);
    const [ref, data, opts] = (setDoc as jest.Mock).mock.calls[0];
    expect(ref.path).toBe('users/u1');
    expect(data).toEqual(expect.objectContaining({ name: 'Zé Leão', email: 'ze@x.pt' }));
    expect(opts).toEqual({ merge: true });
  });

  it('erro inesperado: Crashlytics só recebe o código (sem mensagem, token nem email)', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue(googleSuccess('secret-id-token'));
    (signInWithCredential as jest.Mock).mockRejectedValue({
      code: 'auth/internal-error',
      message: 'boom for ze@x.pt with secret-id-token',
    });
    await expect(signInWithGoogle()).rejects.toThrow('Algo correu mal. Tenta outra vez.');
    expect(recordError).toHaveBeenCalledTimes(1);
    const err = (recordError as jest.Mock).mock.calls[0][1] as Error;
    expect(err.message).toBe('SOCIAL_SIGN_IN_FAILED google auth/internal-error');
    expect(err.message).not.toContain('ze@x.pt');
    expect(err.message).not.toContain('secret-id-token');
  });

  it('erro sem código: Crashlytics recebe "unknown"', async () => {
    (GoogleSignin.signIn as jest.Mock).mockRejectedValue(new Error('token abc ze@x.pt'));
    await expect(signInWithGoogle()).rejects.toThrow();
    expect(((recordError as jest.Mock).mock.calls[0][1] as Error).message).toBe('SOCIAL_SIGN_IN_FAILED google unknown');
  });

  it('cancelar não vai para o Crashlytics', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue({ type: 'cancelled', data: null });
    await signInWithGoogle();
    expect(recordError).not.toHaveBeenCalled();
  });

  it('se a escrita em users falhar, garante o perfil e entra na mesma', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue(googleSuccess());
    (signInWithCredential as jest.Mock).mockResolvedValue(userCred('u1', true));
    (setDoc as jest.Mock).mockRejectedValueOnce(new Error('permission-denied'));
    await expect(signInWithGoogle()).resolves.toEqual({ status: 'signedIn' });
    expect(mockUpdateProfileCall).toHaveBeenCalledTimes(1);
  });

  it('cancelado (SIGN_IN_CANCELLED) → cancelled', async () => {
    (GoogleSignin.signIn as jest.Mock).mockRejectedValue({ code: 'SIGN_IN_CANCELLED' });
    await expect(signInWithGoogle()).resolves.toEqual({ status: 'cancelled' });
    expect(signInWithCredential).not.toHaveBeenCalled();
  });

  it('resposta cancelled (v17) → cancelled', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue({ type: 'cancelled', data: null });
    await expect(signInWithGoogle()).resolves.toEqual({ status: 'cancelled' });
  });

  it('conta existente com outro método: liga e repete com signInSilently', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue(googleSuccess('g-1'));
    (GoogleSignin.signInSilently as jest.Mock).mockResolvedValue(googleSuccess('g-2'));
    (signInWithCredential as jest.Mock).mockRejectedValueOnce(EXISTS).mockResolvedValueOnce(userCred('u1', false));
    mockLinkCall.mockResolvedValue({ data: { linked: true } });

    await expect(signInWithGoogle()).resolves.toEqual({ status: 'signedIn' });
    expect(mockLinkCall).toHaveBeenCalledWith({ provider: 'google', idToken: 'g-1' });
    expect((signInWithCredential as jest.Mock).mock.calls[1][1]).toEqual(expect.objectContaining({ token: 'g-2' }));
  });

  it('outros erros dão mensagem PT', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue(googleSuccess());
    (signInWithCredential as jest.Mock).mockRejectedValue({ code: 'auth/network-request-failed' });
    await expect(signInWithGoogle()).rejects.toThrow('Sem ligação à internet.');
  });
});

describe('signInWithApple', () => {
  it('o nonce enviado à Apple é o SHA-256 hex do rawNonce enviado ao Firebase e à callable', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(appleCredential('a-1'));
    (signInWithCredential as jest.Mock).mockRejectedValueOnce(EXISTS);
    mockLinkCall.mockResolvedValue({ data: { linked: false, reason: 'PRIVATE_RELAY' } });

    await signInWithApple();

    const appleNonce = (AppleAuthentication.signInAsync as jest.Mock).mock.calls[0][0].nonce as string;
    const fbCred = (signInWithCredential as jest.Mock).mock.calls[0][1];
    const callArg = mockLinkCall.mock.calls[0][0];
    expect(fbCred).toEqual(expect.objectContaining({ providerId: 'apple.com', token: 'a-1' }));
    expect(typeof fbCred.secret).toBe('string');
    expect(fbCred.secret.length).toBeGreaterThanOrEqual(32);
    expect(appleNonce).toBe(sha256hex(fbCred.secret));
    expect(appleNonce).not.toBe(fbCred.secret);
    expect(callArg).toEqual({ provider: 'apple', idToken: 'a-1', rawNonce: fbCred.secret });
  });

  it('Review Focus 4: account-exists + linked:true → uma só folha Apple, reutiliza token e rawNonce, signedIn', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(appleCredential('a-1'));
    (signInWithCredential as jest.Mock).mockRejectedValueOnce(EXISTS).mockResolvedValueOnce(userCred('u1', false));
    mockLinkCall.mockResolvedValue({ data: { linked: true } });

    await expect(signInWithApple()).resolves.toEqual({ status: 'signedIn' });
    expect(AppleAuthentication.signInAsync).toHaveBeenCalledTimes(1);
    expect(signInWithCredential).toHaveBeenCalledTimes(2);
    const first = (signInWithCredential as jest.Mock).mock.calls[0][1];
    const second = (signInWithCredential as jest.Mock).mock.calls[1][1];
    expect(second).toEqual(first);
    expect(second.token).toBe('a-1');
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('token reutilizado recusado (auth/invalid-credential) → volta a pedir à Apple com nonce novo', async () => {
    (AppleAuthentication.signInAsync as jest.Mock)
      .mockResolvedValueOnce(appleCredential('a-1'))
      .mockResolvedValueOnce(appleCredential('a-2'));
    (signInWithCredential as jest.Mock)
      .mockRejectedValueOnce(EXISTS)
      .mockRejectedValueOnce({ code: 'auth/invalid-credential' })
      .mockResolvedValueOnce(userCred('u1', false));
    mockLinkCall.mockResolvedValue({ data: { linked: true } });

    await expect(signInWithApple()).resolves.toEqual({ status: 'signedIn' });
    expect(AppleAuthentication.signInAsync).toHaveBeenCalledTimes(2);
    expect(signInWithCredential).toHaveBeenCalledTimes(3);
    expect(mockLinkCall).toHaveBeenCalledTimes(1);
    const first = (signInWithCredential as jest.Mock).mock.calls[0][1];
    const third = (signInWithCredential as jest.Mock).mock.calls[2][1];
    expect(third.token).toBe('a-2');
    expect(third.secret).not.toBe(first.secret);
    expect((AppleAuthentication.signInAsync as jest.Mock).mock.calls[1][0].nonce).toBe(sha256hex(third.secret));
  });

  it('invalid-credential sem ligação prévia não volta a pedir (erro PT)', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(appleCredential('a-1'));
    (signInWithCredential as jest.Mock).mockRejectedValue({ code: 'auth/invalid-credential' });
    await expect(signInWithApple()).rejects.toThrow();
    expect(AppleAuthentication.signInAsync).toHaveBeenCalledTimes(1);
  });

  it('o novo pedido só acontece uma vez: segundo invalid-credential é erro', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(appleCredential('a-1'));
    (signInWithCredential as jest.Mock)
      .mockRejectedValueOnce(EXISTS)
      .mockRejectedValue({ code: 'auth/invalid-credential' });
    mockLinkCall.mockResolvedValue({ data: { linked: true } });
    await expect(signInWithApple()).rejects.toThrow();
    expect(AppleAuthentication.signInAsync).toHaveBeenCalledTimes(2);
    expect(signInWithCredential).toHaveBeenCalledTimes(3);
  });

  it('Review Focus 4: PRIVATE_RELAY → needsExistingLogin com a mensagem exata', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(appleCredential('a-1'));
    (signInWithCredential as jest.Mock).mockRejectedValueOnce(EXISTS);
    mockLinkCall.mockResolvedValue({ data: { linked: false, reason: 'PRIVATE_RELAY' } });

    await expect(signInWithApple()).resolves.toEqual({
      status: 'needsExistingLogin',
      message: 'Já tens conta S360? Entra com o teu método habitual e liga a Apple nas Definições',
    });
    expect(NEEDS_EXISTING_LOGIN_MESSAGE).toBe(
      'Já tens conta S360? Entra com o teu método habitual e liga a Apple nas Definições',
    );
    expect(signInWithCredential).toHaveBeenCalledTimes(1);
  });

  it('outra razão (EMAIL_NOT_VERIFIED) → needsExistingLogin', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(appleCredential());
    (signInWithCredential as jest.Mock).mockRejectedValueOnce(EXISTS);
    mockLinkCall.mockResolvedValue({ data: { linked: false, reason: 'EMAIL_NOT_VERIFIED' } });
    await expect(signInWithApple()).resolves.toEqual({
      status: 'needsExistingLogin',
      message: NEEDS_EXISTING_LOGIN_MESSAGE,
    });
  });

  it('account-exists outra vez depois de ligar é terminal (sem ciclo)', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(appleCredential());
    (signInWithCredential as jest.Mock).mockRejectedValue(EXISTS);
    mockLinkCall.mockResolvedValue({ data: { linked: true } });

    await expect(signInWithApple()).resolves.toEqual({
      status: 'needsExistingLogin',
      message: NEEDS_EXISTING_LOGIN_MESSAGE,
    });
    expect(signInWithCredential).toHaveBeenCalledTimes(2);
    expect(mockLinkCall).toHaveBeenCalledTimes(1);
  });

  it('ALREADY_LINKED → needsExistingLogin, sem nova tentativa', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(appleCredential());
    (signInWithCredential as jest.Mock).mockRejectedValueOnce(EXISTS);
    mockLinkCall.mockResolvedValue({ data: { linked: false, reason: 'ALREADY_LINKED' } });
    await expect(signInWithApple()).resolves.toEqual(expect.objectContaining({ status: 'needsExistingLogin' }));
    expect(signInWithCredential).toHaveBeenCalledTimes(1);
  });

  it('utilizador novo com fullName: users/{uid} com o nome da Apple', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(
      appleCredential('a-1', { givenName: 'Zé', familyName: 'Leão' }),
    );
    (signInWithCredential as jest.Mock).mockResolvedValue(userCred('u9', true, 'abc@privaterelay.appleid.com'));
    await expect(signInWithApple()).resolves.toEqual({ status: 'signedIn' });
    const [ref, data] = (setDoc as jest.Mock).mock.calls[0];
    expect(ref.path).toBe('users/u9');
    expect(data).toEqual(expect.objectContaining({ name: 'Zé Leão' }));
  });

  it('utilizador novo sem fullName: não escreve name', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(appleCredential('a-1', null));
    (signInWithCredential as jest.Mock).mockResolvedValue(userCred('u9', true));
    await signInWithApple();
    expect((setDoc as jest.Mock).mock.calls[0][1]).not.toHaveProperty('name');
  });

  it('cancelado (ERR_REQUEST_CANCELED) → cancelled', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });
    await expect(signInWithApple()).resolves.toEqual({ status: 'cancelled' });
    expect(signInWithCredential).not.toHaveBeenCalled();
  });

  it('cancelar o segundo pedido Apple (após invalid-credential) → cancelled', async () => {
    (AppleAuthentication.signInAsync as jest.Mock)
      .mockResolvedValueOnce(appleCredential('a-1'))
      .mockRejectedValueOnce({ code: 'ERR_REQUEST_CANCELED' });
    (signInWithCredential as jest.Mock)
      .mockRejectedValueOnce(EXISTS)
      .mockRejectedValueOnce({ code: 'auth/invalid-credential' });
    mockLinkCall.mockResolvedValue({ data: { linked: true } });
    await expect(signInWithApple()).resolves.toEqual({ status: 'cancelled' });
  });
});

describe('linkAppleToCurrentUser', () => {
  it('liga a Apple ao utilizador atual com o rawNonce', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(appleCredential('a-1'));
    (linkWithCredential as jest.Mock).mockResolvedValue({});
    await expect(linkAppleToCurrentUser()).resolves.toBe('linked');
    const [user, cred] = (linkWithCredential as jest.Mock).mock.calls[0];
    expect(user).toEqual({ uid: 'me' });
    expect((AppleAuthentication.signInAsync as jest.Mock).mock.calls[0][0].nonce).toBe(sha256hex(cred.secret));
  });

  it('credential-already-in-use → inUse', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(appleCredential());
    (linkWithCredential as jest.Mock).mockRejectedValue({ code: 'auth/credential-already-in-use' });
    await expect(linkAppleToCurrentUser()).resolves.toBe('inUse');
    expect(APPLE_IN_USE_MESSAGE).toBe('Esta conta Apple já está ligada a outra conta S360.');
  });

  it('cancelado → cancelled', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });
    await expect(linkAppleToCurrentUser()).resolves.toBe('cancelled');
    expect(linkWithCredential).not.toHaveBeenCalled();
  });
});

// Task 16 (R9): reautenticação para apagar a conta.
describe('reauthenticateWithApple', () => {
  it('reautentica o utilizador atual com o rawNonce e devolve o authorizationCode', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({ ...appleCredential('a-re'), authorizationCode: 'auth-code-1' });
    await expect(reauthenticateWithApple()).resolves.toEqual({ status: 'ok', authorizationCode: 'auth-code-1' });
    const [user, cred] = (reauthenticateWithCredential as jest.Mock).mock.calls[0];
    expect(user).toEqual({ uid: 'me' });
    expect(cred).toEqual(expect.objectContaining({ providerId: 'apple.com', token: 'a-re' }));
    expect((AppleAuthentication.signInAsync as jest.Mock).mock.calls[0][0].nonce).toBe(sha256hex(cred.secret));
  });

  it('cancelado → cancelled, sem reautenticar', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });
    await expect(reauthenticateWithApple()).resolves.toEqual({ status: 'cancelled' });
    expect(reauthenticateWithCredential).not.toHaveBeenCalled();
  });

  it('sem authorizationCode falha (não há como revogar o token)', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({ ...appleCredential(), authorizationCode: null });
    await expect(reauthenticateWithApple()).rejects.toThrow('Algo correu mal. Tenta outra vez.');
    expect(reauthenticateWithCredential).not.toHaveBeenCalled();
  });

  it('erro do Firebase vira mensagem PT', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(appleCredential());
    (reauthenticateWithCredential as jest.Mock).mockRejectedValueOnce({ code: 'auth/network-request-failed' });
    await expect(reauthenticateWithApple()).rejects.toThrow('Sem ligação à internet.');
  });
});

describe('reauthenticateWithGoogle', () => {
  it('silencioso: reautentica com o idToken novo', async () => {
    (GoogleSignin.signInSilently as jest.Mock).mockResolvedValue(googleSuccess('g-re'));
    await expect(reauthenticateWithGoogle()).resolves.toEqual({ status: 'ok' });
    expect(GoogleSignin.signIn).not.toHaveBeenCalled();
    const [user, cred] = (reauthenticateWithCredential as jest.Mock).mock.calls[0];
    expect(user).toEqual({ uid: 'me' });
    expect(cred).toEqual(expect.objectContaining({ providerId: 'google.com', token: 'g-re' }));
  });

  it('sem sessão Google guardada pede interativo; cancelado → cancelled', async () => {
    (GoogleSignin.signInSilently as jest.Mock).mockResolvedValue({ type: 'noSavedCredentialFound', data: null });
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue({ type: 'cancelled', data: null });
    await expect(reauthenticateWithGoogle()).resolves.toEqual({ status: 'cancelled' });
    expect(reauthenticateWithCredential).not.toHaveBeenCalled();
  });

  it('conta Google diferente (auth/user-mismatch) falha com mensagem genérica', async () => {
    (GoogleSignin.signInSilently as jest.Mock).mockResolvedValue(googleSuccess());
    (reauthenticateWithCredential as jest.Mock).mockRejectedValueOnce({ code: 'auth/user-mismatch' });
    await expect(reauthenticateWithGoogle()).rejects.toThrow('Algo correu mal. Tenta outra vez.');
  });
});
