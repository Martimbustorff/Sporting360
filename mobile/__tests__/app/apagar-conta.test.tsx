// Task 16: ecrã "Apagar conta" com o router real (expo-router/testing-library) e o serviço account real.
// Mockados: Firebase (callable, reauth), signOut (passa a sessão a signedOut), biometria, BiometricGate.
// R17: depois de apagar, a guarda de (app) leva ao Welcome e "Conta apagada." tem de aparecer.
jest.unmock('expo-router');

type S = { status: 'loading' | 'signedOut' | 'signedIn'; user: unknown };
const SIGNED_IN: S = { status: 'signedIn', user: { uid: 'u1', email: 'ze@x.pt', providers: ['password'] } };
const mockStore = {
  value: SIGNED_IN as S,
  listeners: new Set<() => void>(),
  set(v: S) {
    this.value = v;
    this.listeners.forEach((l) => l());
  },
};
jest.mock('@/providers/SessionProvider', () => ({
  useSession: () =>
    require('react').useSyncExternalStore(
      (l: () => void) => {
        mockStore.listeners.add(l);
        return () => mockStore.listeners.delete(l);
      },
      () => mockStore.value,
    ),
}));
jest.mock('@/providers/BiometricGate', () => ({ BiometricGate: ({ children }: { children: unknown }) => children }));
const mockUser = { uid: 'u1', email: 'ze@x.pt', providerData: [{ providerId: 'password' }] };
jest.mock('@/services/firebase', () => ({
  authInstance: jest.fn(() => ({ __mock: 'auth', currentUser: mockUser })),
  fns: jest.fn(() => ({ __mock: 'functions' })),
}));
jest.mock('@react-native-firebase/auth');
jest.mock('@react-native-firebase/functions');
jest.mock('@react-native-firebase/crashlytics');
jest.mock('@/services/auth', () => ({
  signInEmail: jest.fn(),
  signUpEmail: jest.fn(),
  sendReset: jest.fn(),
  signOut: jest.fn(async () => {
    mockStore.set({ status: 'signedOut', user: null });
  }),
}));
jest.mock('@/services/biometrics', () => ({ setBiometricEnabled: jest.fn(() => Promise.resolve()) }));
jest.mock('@/services/social', () => ({
  signInWithGoogle: jest.fn(),
  signInWithApple: jest.fn(),
  reauthenticateWithApple: jest.fn(),
  reauthenticateWithGoogle: jest.fn(),
  NEEDS_EXISTING_LOGIN_MESSAGE: 'nota',
}));
jest.mock('expo-apple-authentication', () => {
  const { Pressable } = require('react-native');
  const R = require('react');
  return {
    AppleAuthenticationButton: (p: { onPress: () => void; testID?: string }) =>
      R.createElement(Pressable, { testID: p.testID, onPress: p.onPress, accessibilityRole: 'button' }),
    AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 },
    AppleAuthenticationButtonStyle: { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 },
  };
});

import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { reauthenticateWithCredential } from '@react-native-firebase/auth';
import { httpsCallable } from '@react-native-firebase/functions';
import { clearSignOutNotice } from '@/lib/signOutNotice';
import { signOut } from '@/services/auth';
import { setBiometricEnabled } from '@/services/biometrics';

import AuthLayout from '../../app/(auth)/_layout';
import Welcome from '../../app/(auth)/welcome';
import Entrar from '../../app/(auth)/entrar';
import AppLayout from '../../app/(app)/_layout';
import Home from '../../app/(app)/index';
import ApagarConta from '../../app/(app)/apagar-conta';

const ROUTES = {
  '(auth)/_layout': AuthLayout,
  '(auth)/welcome': Welcome,
  '(auth)/entrar': Entrar,
  '(app)/_layout': AppLayout,
  '(app)/index': Home,
  '(app)/apagar-conta': ApagarConta,
};

const mockDelete = jest.fn();
const REAUTH = Object.assign(new Error('REAUTH_REQUIRED'), { code: 'failed-precondition' });
const deleteBtn = () => screen.getByRole('button', { name: 'Apagar conta' });
const confirmField = () => screen.getByLabelText('Escreve APAGAR');

beforeEach(() => {
  jest.clearAllMocks();
  clearSignOutNotice();
  mockStore.value = SIGNED_IN;
  (httpsCallable as jest.Mock).mockImplementation(() => mockDelete);
  mockDelete.mockResolvedValue({ data: { ok: true, deleted: 2 } });
});

it('explica o que se apaga', async () => {
  await renderRouter(ROUTES, { initialUrl: '/apagar-conta' });
  expect(screen.getByText(/perfil, GameBox, prognósticos, votos e pontos/)).toBeTruthy();
});

it('"Apagar conta" só fica ativo com APAGAR escrito exatamente (maiúsculas, sem espaços)', async () => {
  await renderRouter(ROUTES, { initialUrl: '/apagar-conta' });
  expect(deleteBtn().props.accessibilityState.disabled).toBe(true);
  for (const v of ['apagar', 'APAGA', ' APAGAR', 'APAGAR ', 'Apagar']) {
    await fireEvent.changeText(confirmField(), v);
    expect(deleteBtn().props.accessibilityState.disabled).toBe(true);
  }
  await fireEvent.press(deleteBtn());
  expect(mockDelete).not.toHaveBeenCalled();
  await fireEvent.changeText(confirmField(), 'APAGAR');
  expect(deleteBtn().props.accessibilityState.disabled).toBe(false);
});

it('R17: depois de apagar vai para o Welcome e mostra "Conta apagada."', async () => {
  const r = await renderRouter(ROUTES, { initialUrl: '/apagar-conta' });
  await fireEvent.changeText(confirmField(), 'APAGAR');
  await fireEvent.press(deleteBtn());
  await act(async () => {});
  expect(mockDelete).toHaveBeenCalledTimes(1);
  expect(setBiometricEnabled).toHaveBeenCalledWith('u1', false);
  expect(signOut).toHaveBeenCalledTimes(1);
  expect(r.getPathname()).toBe('/welcome');
  expect(screen.getByText('Conta apagada.')).toBeTruthy();
});

it('o aviso só aparece uma vez: um signOut normal depois não o mostra', async () => {
  const r = await renderRouter(ROUTES, { initialUrl: '/apagar-conta' });
  await fireEvent.changeText(confirmField(), 'APAGAR');
  await fireEvent.press(deleteBtn());
  await act(async () => {});
  expect(screen.getByText('Conta apagada.')).toBeTruthy();
  // nova sessão e signOut normal
  await act(async () => mockStore.set(SIGNED_IN));
  expect(r.getPathname()).toBe('/');
  await act(async () => mockStore.set({ status: 'signedOut', user: null }));
  expect(r.getPathname()).toBe('/welcome');
  expect(screen.queryByText('Conta apagada.')).toBeNull();
});

it('REAUTH_REQUIRED com password: folha da password; errada mostra a mensagem; certa apaga', async () => {
  mockDelete.mockRejectedValueOnce(REAUTH).mockResolvedValueOnce({ data: { ok: true, deleted: 1 } });
  (reauthenticateWithCredential as jest.Mock)
    .mockRejectedValueOnce({ code: 'auth/wrong-password' })
    .mockResolvedValueOnce({ user: {} });
  const r = await renderRouter(ROUTES, { initialUrl: '/apagar-conta' });
  await fireEvent.changeText(confirmField(), 'APAGAR');
  await fireEvent.press(deleteBtn());
  await act(async () => {});
  const pw = screen.getByLabelText('Password');
  expect(pw.props.textContentType).toBe('password');
  expect(pw.props.secureTextEntry).toBe(true);
  await fireEvent.changeText(pw, 'errada');
  await fireEvent.press(screen.getByRole('button', { name: 'Confirmar' }));
  expect(screen.getByText('Email ou password incorretos.')).toBeTruthy();
  expect(signOut).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('Password'), 'certa1');
  await fireEvent.press(screen.getByRole('button', { name: 'Confirmar' }));
  await act(async () => {});
  expect(mockDelete).toHaveBeenCalledTimes(2);
  expect(r.getPathname()).toBe('/welcome');
  expect(screen.getByText('Conta apagada.')).toBeTruthy();
});

it('folha da password cancelada: fica no ecrã, sem signOut', async () => {
  mockDelete.mockRejectedValueOnce(REAUTH);
  const r = await renderRouter(ROUTES, { initialUrl: '/apagar-conta' });
  await fireEvent.changeText(confirmField(), 'APAGAR');
  await fireEvent.press(deleteBtn());
  await act(async () => {});
  await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
  await act(async () => {});
  expect(screen.queryByLabelText('Password')).toBeNull();
  expect(signOut).not.toHaveBeenCalled();
  expect(r.getPathname()).toBe('/apagar-conta');
  expect(deleteBtn().props.accessibilityState.disabled).toBe(false);
});

it('outro erro da callable: mensagem genérica, sessão mantém-se', async () => {
  mockDelete.mockRejectedValueOnce(Object.assign(new Error('DELETE_FAILED'), { code: 'internal' }));
  const r = await renderRouter(ROUTES, { initialUrl: '/apagar-conta' });
  await fireEvent.changeText(confirmField(), 'APAGAR');
  await fireEvent.press(deleteBtn());
  await act(async () => {});
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(screen.getByText('Algo correu mal. Tenta outra vez.')).toBeTruthy();
  expect(signOut).not.toHaveBeenCalled();
  expect(r.getPathname()).toBe('/apagar-conta');
});
