// Task 16: apagar a conta (deleteMyAccount) e reautenticação por provider. Módulos nativos mockados.
import { Platform } from 'react-native';

const mockDeleteCall = jest.fn();
const mockUser: { current: { uid: string; email: string | null; providerData: { providerId: string }[] } | null } = {
  current: null,
};

jest.mock('@react-native-firebase/auth');
jest.mock('@react-native-firebase/functions');
jest.mock('@react-native-firebase/crashlytics');
jest.mock('@/services/firebase', () => ({
  authInstance: jest.fn(() => ({ __mock: 'auth', currentUser: mockUser.current })),
  fns: jest.fn(() => ({ __mock: 'functions' })),
}));
jest.mock('@/services/auth', () => ({ signOut: jest.fn(() => Promise.resolve()) }));
jest.mock('@/services/biometrics', () => ({ setBiometricEnabled: jest.fn(() => Promise.resolve()) }));
jest.mock('@/services/social', () => ({
  reauthenticateWithApple: jest.fn(),
  reauthenticateWithGoogle: jest.fn(),
}));

import { EmailAuthProvider, reauthenticateWithCredential, revokeToken } from '@react-native-firebase/auth';
import { recordError } from '@react-native-firebase/crashlytics';
import { httpsCallable } from '@react-native-firebase/functions';
import { clearSignOutNotice, peekSignOutNotice } from '@/lib/signOutNotice';
import { deleteMyAccount, providerReauth, reauthenticateWithPassword } from '@/services/account';
import { signOut } from '@/services/auth';
import { updateDisplayName } from '@/services/profile';
import { setBiometricEnabled } from '@/services/biometrics';
import { reauthenticateWithApple, reauthenticateWithGoogle } from '@/services/social';

const REAUTH = Object.assign(new Error('REAUTH_REQUIRED'), { code: 'failed-precondition' });
const user = (uid: string, providers: string[], email: string | null = 'ze@x.pt') => ({
  uid,
  email,
  providerData: providers.map((providerId) => ({ providerId })),
});
const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  clearSignOutNotice();
  Platform.OS = 'ios';
  mockUser.current = user('u1', ['password']);
  (httpsCallable as jest.Mock).mockImplementation(() => mockDeleteCall);
  mockDeleteCall.mockResolvedValue({ data: { ok: true, deleted: 3 } });
});
afterAll(() => {
  Platform.OS = originalOS;
});

describe('deleteMyAccount', () => {
  it('sucesso: chama deleteAccount, desliga a biometria do uid, marca o aviso e termina a sessão', async () => {
    const reauth = jest.fn();
    await expect(deleteMyAccount(reauth)).resolves.toBe('deleted');
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'deleteAccount');
    expect(mockDeleteCall).toHaveBeenCalledTimes(1);
    expect(reauth).not.toHaveBeenCalled();
    expect(setBiometricEnabled).toHaveBeenCalledWith('u1', false);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(peekSignOutNotice()).toBe('conta-apagada');
    // biometria desligada antes de terminar a sessão (o uid foi capturado antes)
    expect((setBiometricEnabled as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (signOut as jest.Mock).mock.invocationCallOrder[0] ?? Infinity,
    );
  });

  it('REAUTH_REQUIRED → chama reauth e repete uma vez', async () => {
    mockDeleteCall.mockRejectedValueOnce(REAUTH).mockResolvedValueOnce({ data: { ok: true, deleted: 1 } });
    const reauth = jest.fn(() => Promise.resolve('ok' as const));
    await expect(deleteMyAccount(reauth)).resolves.toBe('deleted');
    expect(reauth).toHaveBeenCalledTimes(1);
    expect(mockDeleteCall).toHaveBeenCalledTimes(2);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('também reconhece o código com prefixo functions/', async () => {
    mockDeleteCall
      .mockRejectedValueOnce(Object.assign(new Error('REAUTH_REQUIRED'), { code: 'functions/failed-precondition' }))
      .mockResolvedValueOnce({ data: { ok: true, deleted: 0 } });
    const reauth = jest.fn(() => Promise.resolve('ok' as const));
    await expect(deleteMyAccount(reauth)).resolves.toBe('deleted');
    expect(reauth).toHaveBeenCalledTimes(1);
  });

  it('reauth cancelado → cancelled, sem signOut, sem desligar a biometria, sem aviso', async () => {
    mockDeleteCall.mockRejectedValueOnce(REAUTH);
    const reauth = jest.fn(() => Promise.resolve('cancelled' as const));
    await expect(deleteMyAccount(reauth)).resolves.toBe('cancelled');
    expect(mockDeleteCall).toHaveBeenCalledTimes(1);
    expect(signOut).not.toHaveBeenCalled();
    expect(setBiometricEnabled).not.toHaveBeenCalled();
    expect(peekSignOutNotice()).toBeNull();
  });

  it('REAUTH_REQUIRED duas vezes: falha com erro genérico e não termina a sessão (sem ciclo)', async () => {
    mockDeleteCall.mockRejectedValue(REAUTH);
    const reauth = jest.fn(() => Promise.resolve('ok' as const));
    await expect(deleteMyAccount(reauth)).rejects.toThrow('Algo correu mal. Tenta outra vez.');
    expect(reauth).toHaveBeenCalledTimes(1);
    expect(mockDeleteCall).toHaveBeenCalledTimes(2);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('outro erro da callable: erro genérico, sem reauth nem signOut; só o código vai ao Crashlytics', async () => {
    mockDeleteCall.mockRejectedValueOnce(
      Object.assign(new Error('DELETE_FAILED ze@x.pt'), { code: 'internal' }),
    );
    const reauth = jest.fn();
    await expect(deleteMyAccount(reauth)).rejects.toThrow('Algo correu mal. Tenta outra vez.');
    expect(reauth).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    expect(setBiometricEnabled).not.toHaveBeenCalled();
    const logged = (recordError as jest.Mock).mock.calls.map((c) => String((c[1] as Error).message)).join(' ');
    expect(logged).toContain('internal');
    expect(logged).not.toContain('ze@x.pt');
  });

  it('erro do reauth (ex.: rede) propaga a mensagem e não termina a sessão', async () => {
    mockDeleteCall.mockRejectedValueOnce(REAUTH);
    const reauth = jest.fn(() => Promise.reject(new Error('Sem ligação à internet.')));
    await expect(deleteMyAccount(reauth)).rejects.toThrow('Sem ligação à internet.');
    expect(signOut).not.toHaveBeenCalled();
  });

  it('sem sessão: falha sem chamar a callable', async () => {
    mockUser.current = null;
    await expect(deleteMyAccount(jest.fn())).rejects.toThrow('Algo correu mal. Tenta outra vez.');
    expect(mockDeleteCall).not.toHaveBeenCalled();
  });

  it('falha a desligar a biometria ou a terminar a sessão: a conta já foi apagada, devolve deleted', async () => {
    (setBiometricEnabled as jest.Mock).mockRejectedValueOnce(new Error('keychain'));
    (signOut as jest.Mock).mockRejectedValueOnce(new Error('x'));
    await expect(deleteMyAccount(jest.fn())).resolves.toBe('deleted');
  });

  describe('utilizador Apple (R9)', () => {
    beforeEach(() => {
      mockUser.current = user('ua', ['apple.com']);
      (reauthenticateWithApple as jest.Mock).mockResolvedValue({ status: 'ok', authorizationCode: 'code-xyz' });
    });

    it('reautentica com a Apple e revoga o token ANTES da primeira chamada a deleteAccount', async () => {
      const reauth = jest.fn();
      await expect(deleteMyAccount(reauth)).resolves.toBe('deleted');
      expect(reauthenticateWithApple).toHaveBeenCalledTimes(1);
      expect(revokeToken).toHaveBeenCalledWith(expect.anything(), 'code-xyz');
      expect((revokeToken as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
        mockDeleteCall.mock.invocationCallOrder[0] ?? Infinity,
      );
      expect(reauth).not.toHaveBeenCalled();
      expect(setBiometricEnabled).toHaveBeenCalledWith('ua', false);
    });

    it('revokeToken também antes da segunda chamada quando o servidor pede reauth', async () => {
      mockDeleteCall.mockRejectedValueOnce(REAUTH).mockResolvedValueOnce({ data: { ok: true, deleted: 1 } });
      const reauth = jest.fn(() => Promise.resolve('ok' as const));
      await expect(deleteMyAccount(reauth)).resolves.toBe('deleted');
      expect((revokeToken as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
        mockDeleteCall.mock.invocationCallOrder[1] ?? Infinity,
      );
    });

    it('Apple cancelado → cancelled, sem revogar nem apagar', async () => {
      (reauthenticateWithApple as jest.Mock).mockResolvedValue({ status: 'cancelled' });
      await expect(deleteMyAccount(jest.fn())).resolves.toBe('cancelled');
      expect(revokeToken).not.toHaveBeenCalled();
      expect(mockDeleteCall).not.toHaveBeenCalled();
      expect(signOut).not.toHaveBeenCalled();
    });

    it('revokeToken falha → não apaga (erro genérico)', async () => {
      (revokeToken as jest.Mock).mockRejectedValueOnce({ code: 'auth/invalid-credential' });
      await expect(deleteMyAccount(jest.fn())).rejects.toThrow('Algo correu mal. Tenta outra vez.');
      expect(mockDeleteCall).not.toHaveBeenCalled();
      expect(signOut).not.toHaveBeenCalled();
    });

    it('Android: sem pedido Apple (não disponível); segue pelo caminho normal', async () => {
      Platform.OS = 'android';
      mockUser.current = user('ua', ['apple.com', 'password']);
      await expect(deleteMyAccount(jest.fn())).resolves.toBe('deleted');
      expect(reauthenticateWithApple).not.toHaveBeenCalled();
      expect(revokeToken).not.toHaveBeenCalled();
    });
  });
});

describe('providerReauth', () => {
  it('Google ligado: reautenticação Google silenciosa/interativa', async () => {
    mockUser.current = user('u1', ['google.com', 'password']);
    (reauthenticateWithGoogle as jest.Mock).mockResolvedValue({ status: 'ok' });
    const askPassword = jest.fn();
    await expect(providerReauth(askPassword)()).resolves.toBe('ok');
    expect(askPassword).not.toHaveBeenCalled();
  });

  it('Google cancelado → cancelled', async () => {
    mockUser.current = user('u1', ['google.com']);
    (reauthenticateWithGoogle as jest.Mock).mockResolvedValue({ status: 'cancelled' });
    await expect(providerReauth(jest.fn())()).resolves.toBe('cancelled');
  });

  it('só password: abre a folha da password', async () => {
    mockUser.current = user('u1', ['password']);
    const askPassword = jest.fn(() => Promise.resolve('ok' as const));
    await expect(providerReauth(askPassword)()).resolves.toBe('ok');
    expect(askPassword).toHaveBeenCalledTimes(1);
    expect(reauthenticateWithGoogle).not.toHaveBeenCalled();
  });

  it('só Apple (iOS): novo pedido Apple', async () => {
    mockUser.current = user('u1', ['apple.com']);
    (reauthenticateWithApple as jest.Mock).mockResolvedValue({ status: 'ok', authorizationCode: 'c' });
    await expect(providerReauth(jest.fn())()).resolves.toBe('ok');
  });
});

describe('reauthenticateWithPassword', () => {
  it('reautentica com o email da sessão e a password', async () => {
    await reauthenticateWithPassword('secret1');
    expect(EmailAuthProvider.credential).toHaveBeenCalledWith('ze@x.pt', 'secret1');
    expect(reauthenticateWithCredential).toHaveBeenCalledWith(
      mockUser.current,
      expect.objectContaining({ providerId: 'password' }),
    );
  });

  it('password errada → mensagem de authErrorMessage', async () => {
    (reauthenticateWithCredential as jest.Mock).mockRejectedValueOnce({ code: 'auth/wrong-password' });
    await expect(reauthenticateWithPassword('x')).rejects.toThrow('Email ou password incorretos.');
  });
});

describe('updateDisplayName', () => {
  it('chama updateProfile só com displayName (avatarId ausente) e devolve o nome do servidor', async () => {
    const call = jest.fn(() => Promise.resolve({ data: { displayName: 'Leão 77', avatarId: 'a1' } }));
    (httpsCallable as jest.Mock).mockImplementation(() => call);
    await expect(updateDisplayName('  Leão   77 ')).resolves.toBe('Leão 77');
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'updateProfile');
    expect(call).toHaveBeenCalledWith({ displayName: '  Leão   77 ' });
  });

  it('erro da callable passa tal como vem', async () => {
    const err = Object.assign(new Error('TOO_LONG'), { code: 'invalid-argument' });
    (httpsCallable as jest.Mock).mockImplementation(() => jest.fn(() => Promise.reject(err)));
    await expect(updateDisplayName('x')).rejects.toBe(err);
  });
});
