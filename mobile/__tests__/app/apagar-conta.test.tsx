// Task 16: ecrã "Apagar conta" com o router real (expo-router/testing-library) e o serviço account real.
// Mockados: Firebase (callable, reauth), signOut (passa a sessão a signedOut), biometria, BiometricGate.
// R17: depois de apagar, a guarda de (app) leva ao Welcome e "Conta apagada." tem de aparecer.
jest.unmock('expo-router');
// Task 5: a Home (destino depois de entrar) lê dados e tem a folha GameBox; aqui ficam de fora.
// expo-router/testing-library troca o mock de Reanimated pelo oficial, que falha em Jest com a Sheet.
jest.mock('@/components/HomeGameboxSheet', () => ({ HomeGameboxSheet: () => null, useGameboxSheetCollapsedHeight: () => 116 }));
// Task 6: a folha de consentimento (também uma Sheet) tem o mesmo problema; testada em AnalyticsConsentSheet.test.
jest.mock('@/components/AnalyticsConsentSheet', () => ({ AnalyticsConsentSheet: () => null }));
jest.mock('@/data/hooks', () => ({
  useMyUser: () => ({ status: 'loading' }),
  usePublicProfile: () => ({ status: 'loading' }),
  useAppConfig: () => ({ status: 'loading' }),
}));
// Plano 7, Tarefa 4: o esqueleto do cartão do jogo usa Reanimated (mesmo problema do oficial em Jest); testado em NextMatchCard.test.
jest.mock('@/components/NextMatchCard', () => ({ NextMatchCard: () => null }));
jest.mock('@/data/sports', () => ({ useHomeMatches: () => ({ status: 'loading' }) }));
jest.mock('@/data/user', () => ({ useMyMvpVote: () => ({ status: 'missing' }) }));

type S = { status: 'loading' | 'signedOut' | 'signedIn'; user: unknown };
// Por omissão a conta entra com o Google (sem folha da password); `usePasswordAccount()` passa-a a só password (21b).
const SIGNED_IN: S = { status: 'signedIn', user: { uid: 'u1', email: 'ze@x.pt', providers: ['google.com'] } };
const SIGNED_IN_PASSWORD: S = { status: 'signedIn', user: { uid: 'u1', email: 'ze@x.pt', providers: ['password'] } };
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
const MOCK_USER = { uid: 'u1', email: 'ze@x.pt', providerData: [{ providerId: 'google.com' }] };
const PASSWORD_USER = { uid: 'u1', email: 'ze@x.pt', providerData: [{ providerId: 'password' }] };
const mockAuth: { currentUser: typeof MOCK_USER | typeof PASSWORD_USER | null } = { currentUser: MOCK_USER };
jest.mock('@/services/firebase', () => ({
  authInstance: jest.fn(() => ({ __mock: 'auth', currentUser: mockAuth.currentUser })),
  fns: jest.fn(() => ({ __mock: 'functions' })),
}));
jest.mock('@react-native-firebase/auth');
jest.mock('@react-native-firebase/functions');
jest.mock('@react-native-firebase/crashlytics');
jest.mock('@/services/auth', () => ({
  signInEmail: jest.fn(),
  signUpEmail: jest.fn(),
  sendReset: jest.fn(),
  // Como o Firebase: depois de um signOut bem-sucedido currentUser é null e a sessão passa a signedOut.
  signOut: jest.fn(async () => {
    mockAuth.currentUser = null;
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

import { StyleSheet } from 'react-native';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { reauthenticateWithCredential } from '@react-native-firebase/auth';
import { httpsCallable } from '@react-native-firebase/functions';
import { clearSignOutNotice } from '@/lib/signOutNotice';
import { signOut } from '@/services/auth';
import { colors } from '@/theme/tokens';
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
const usePasswordAccount = () => {
  mockStore.value = SIGNED_IN_PASSWORD;
  mockAuth.currentUser = PASSWORD_USER;
};

beforeEach(() => {
  jest.clearAllMocks();
  clearSignOutNotice();
  mockStore.value = SIGNED_IN;
  mockAuth.currentUser = MOCK_USER;
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

it('"Apagar conta" é o botão Branco (fundo branco, texto primary), nunca encarnado', async () => {
  await renderRouter(ROUTES, { initialUrl: '/apagar-conta' });
  const btn = StyleSheet.flatten(deleteBtn().props.style);
  expect(btn.backgroundColor).toBe(colors.white);
  expect(btn.backgroundColor).not.toBe(colors.danger);
  expect(StyleSheet.flatten(within(deleteBtn()).getByText('Apagar conta').props.style).color).toBe(colors.primary);
});

describe('21b: conta só com password', () => {
  beforeEach(usePasswordAccount);

  it('a folha "Confirma a tua password" abre antes de apagar, com o texto aprovado, e nada é apagado até confirmar', async () => {
    (reauthenticateWithCredential as jest.Mock).mockResolvedValue({ user: {} });
    const r = await renderRouter(ROUTES, { initialUrl: '/apagar-conta' });
    await fireEvent.changeText(confirmField(), 'APAGAR');
    await fireEvent.press(deleteBtn());
    await act(async () => {});
    expect(screen.getByText('Confirma a tua password')).toBeTruthy();
    expect(screen.getByText('Por segurança, indica a password antes de apagarmos a conta.')).toBeTruthy();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    // sem password escrita, "Confirmar" está desativado e não apaga
    expect(screen.getByRole('button', { name: 'Confirmar' }).props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar' }));
    expect(mockDelete).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Password'), 'certa1');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar' }));
    await act(async () => {});
    expect(reauthenticateWithCredential).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(r.getPathname()).toBe('/welcome');
    expect(screen.getByText('Conta apagada.')).toBeTruthy();
  });

  it('password errada mostra a mensagem e não apaga; a certa apaga', async () => {
    (reauthenticateWithCredential as jest.Mock)
      .mockRejectedValueOnce({ code: 'auth/wrong-password' })
      .mockResolvedValueOnce({ user: {} });
    await renderRouter(ROUTES, { initialUrl: '/apagar-conta' });
    await fireEvent.changeText(confirmField(), 'APAGAR');
    await fireEvent.press(deleteBtn());
    await act(async () => {});
    const pw = screen.getByLabelText('Password');
    expect(pw.props.textContentType).toBe('password');
    expect(pw.props.secureTextEntry).toBe(true);
    await fireEvent.changeText(pw, 'errada');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar' }));
    expect(screen.getByText('Email ou password incorretos.')).toBeTruthy();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Password'), 'certa1');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar' }));
    await act(async () => {});
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('cancelar a folha: fica no ecrã, nada apagado, sem signOut', async () => {
    const r = await renderRouter(ROUTES, { initialUrl: '/apagar-conta' });
    await fireEvent.changeText(confirmField(), 'APAGAR');
    await fireEvent.press(deleteBtn());
    await act(async () => {});
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    await act(async () => {});
    expect(screen.queryByLabelText('Password')).toBeNull();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    expect(r.getPathname()).toBe('/apagar-conta');
    expect(deleteBtn().props.accessibilityState.disabled).toBe(false);
  });

  it('se o servidor ainda pedir login recente (REAUTH_REQUIRED), pede a password outra vez e só então apaga', async () => {
    mockDelete.mockRejectedValueOnce(REAUTH).mockResolvedValueOnce({ data: { ok: true, deleted: 1 } });
    (reauthenticateWithCredential as jest.Mock).mockResolvedValue({ user: {} });
    const r = await renderRouter(ROUTES, { initialUrl: '/apagar-conta' });
    await fireEvent.changeText(confirmField(), 'APAGAR');
    await fireEvent.press(deleteBtn());
    await act(async () => {});
    await fireEvent.changeText(screen.getByLabelText('Password'), 'certa1');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar' }));
    await act(async () => {});
    // segunda folha (REAUTH_REQUIRED)
    await fireEvent.changeText(screen.getByLabelText('Password'), 'certa1');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar' }));
    await act(async () => {});
    expect(mockDelete).toHaveBeenCalledTimes(2);
    expect(r.getPathname()).toBe('/welcome');
  });
});

it('conta Google: sem folha da password, apaga direto (a reautenticação social mantém-se no serviço)', async () => {
  await renderRouter(ROUTES, { initialUrl: '/apagar-conta' });
  await fireEvent.changeText(confirmField(), 'APAGAR');
  await fireEvent.press(deleteBtn());
  await act(async () => {});
  expect(screen.queryByText('Confirma a tua password')).toBeNull();
  expect(mockDelete).toHaveBeenCalledTimes(1);
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

describe('signOut falha depois de apagar (fix round 1)', () => {
  it('tenta signOut outra vez e vai para o Welcome com o aviso; o botão deixa de carregar', async () => {
    (signOut as jest.Mock).mockRejectedValueOnce(new Error('x')); // dentro de deleteMyAccount
    const r = await renderRouter(ROUTES, { initialUrl: '/apagar-conta' });
    await fireEvent.changeText(confirmField(), 'APAGAR');
    await fireEvent.press(deleteBtn());
    await act(async () => {});
    expect(signOut).toHaveBeenCalledTimes(2);
    expect(r.getPathname()).toBe('/welcome');
    expect(screen.getByText('Conta apagada.')).toBeTruthy();
  });

  it('se o segundo signOut também falhar, não fica a carregar para sempre', async () => {
    (signOut as jest.Mock).mockRejectedValueOnce(new Error('x')).mockRejectedValueOnce(new Error('y'));
    const r = await renderRouter(ROUTES, { initialUrl: '/apagar-conta' });
    await fireEvent.changeText(confirmField(), 'APAGAR');
    await fireEvent.press(deleteBtn());
    await act(async () => {});
    expect(signOut).toHaveBeenCalledTimes(2);
    // Sessão local ainda signedIn: a guarda de (auth) devolve a /. O importante: navegou e não ficou preso.
    expect(r.getPathname()).not.toBe('/apagar-conta');
    expect(screen.queryByTestId('button-loading')).toBeNull();
  });
});
