import React from 'react';
import { AppState, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

jest.mock('@/services/biometrics');
jest.mock('@/services/auth', () => ({ signOut: jest.fn(() => Promise.resolve()) }));
jest.mock('@/providers/SessionProvider', () => ({
  useSession: jest.fn(() => ({ status: 'signedIn', user: { uid: 'u1', email: 'a@b.pt', providers: ['password'] } })),
}));

import { BiometricGate, resetBiometricGateForTests } from '@/providers/BiometricGate';
import { signOut } from '@/services/auth';
import * as bio from '@/services/biometrics';

const m = bio as jest.Mocked<typeof bio>;
type AppStateHandler = (s: string) => void;
let emit: AppStateHandler;
let now = 1_000_000;

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const tree = () => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <BiometricGate>
      <Text>conteudo</Text>
    </BiometricGate>
  </SafeAreaProvider>
);
const flush = () => act(async () => {});
const setAppState = (s: string) => Object.defineProperty(AppState, 'currentState', { configurable: true, get: () => s });

beforeEach(() => {
  jest.clearAllMocks();
  resetBiometricGateForTests();
  now = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  setAppState('active');
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_t: string, h: AppStateHandler) => {
    emit = h;
    return { remove: jest.fn() };
  }) as never);
  m.isBiometricEnabled.mockResolvedValue(true);
  m.setBiometricEnabled.mockResolvedValue(undefined);
  m.biometricStatus.mockResolvedValue('available');
  m.biometricLabel.mockResolvedValue('Face ID');
  m.unlock.mockResolvedValue(true);
  m.hasBiometricPromptAnswered.mockResolvedValue(true);
  m.setBiometricPromptAnswered.mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('BiometricGate: arranque a frio', () => {
  it('opção ligada, unlock true: mostra os filhos', async () => {
    await render(tree());
    await waitFor(() => expect(screen.getByText('conteudo')).toBeTruthy());
    expect(m.unlock).toHaveBeenCalledTimes(1);
  });

  it('unlock false: fica no bloqueio com "Tentar outra vez" e os filhos não existem', async () => {
    m.unlock.mockResolvedValue(false);
    await render(tree());
    await waitFor(() => expect(screen.getByText('Tentar outra vez')).toBeTruthy());
    expect(screen.queryByText('conteudo')).toBeNull();
    m.unlock.mockResolvedValue(true);
    fireEvent.press(screen.getByText('Tentar outra vez'));
    await waitFor(() => expect(screen.getByText('conteudo')).toBeTruthy());
    expect(m.unlock).toHaveBeenCalledTimes(2);
  });

  it('antes de falhar mostra "Desbloquear com {label}" e "Entrar com outra conta"', async () => {
    m.unlock.mockImplementation(() => new Promise(() => {}));
    await render(tree());
    await waitFor(() => expect(screen.getByText('Desbloquear com Face ID')).toBeTruthy());
    expect(screen.getByText('Entrar com outra conta')).toBeTruthy();
    expect(screen.getByLabelText('Desbloquear com Face ID')).toBeTruthy();
  });

  it('opção desligada: filhos logo, sem unlock', async () => {
    m.isBiometricEnabled.mockResolvedValue(false);
    await render(tree());
    await waitFor(() => expect(screen.getByText('conteudo')).toBeTruthy());
    expect(m.unlock).not.toHaveBeenCalled();
  });

  it('Review Focus 3: ligada mas notEnrolled: desliga, mostra filhos e não chama unlock', async () => {
    m.biometricStatus.mockResolvedValue('notEnrolled');
    await render(tree());
    await waitFor(() => expect(screen.getByText('conteudo')).toBeTruthy());
    expect(m.setBiometricEnabled).toHaveBeenCalledWith('u1', false);
    expect(m.unlock).not.toHaveBeenCalled();
  });

  it('"Entrar com outra conta" faz signOut e desliga a opção', async () => {
    m.unlock.mockResolvedValue(false);
    await render(tree());
    await waitFor(() => expect(screen.getByText('Entrar com outra conta')).toBeTruthy());
    fireEvent.press(screen.getByText('Entrar com outra conta'));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(m.setBiometricEnabled).toHaveBeenCalledWith('u1', false);
  });

  it('não pede biometria enquanto a app está em background; pede quando fica ativa', async () => {
    setAppState('background');
    await render(tree());
    await flush();
    expect(m.unlock).not.toHaveBeenCalled();
    setAppState('active');
    await act(async () => emit('active'));
    await waitFor(() => expect(m.unlock).toHaveBeenCalledTimes(1));
  });

  it('o ecrã de bloqueio esconde o conteúdo das tecnologias de apoio', async () => {
    m.unlock.mockResolvedValue(false);
    await render(tree());
    await waitFor(() => expect(screen.getByText('Tentar outra vez')).toBeTruthy());
    expect(screen.getByTestId('lock-screen').props.accessibilityViewIsModal).toBe(true);
  });
});

describe('BiometricGate: regresso do background', () => {
  async function unlocked() {
    await render(tree());
    await waitFor(() => expect(screen.getByText('conteudo')).toBeTruthy());
    m.unlock.mockClear();
  }

  it('4 min 59 s: não bloqueia; 5 min: bloqueia e pede unlock', async () => {
    await unlocked();
    await act(async () => emit('background'));
    now += 299_000;
    await act(async () => emit('active'));
    await flush();
    expect(m.unlock).not.toHaveBeenCalled();

    await act(async () => emit('background'));
    now += 300_000;
    m.unlock.mockResolvedValue(false);
    await act(async () => emit('active'));
    await waitFor(() => expect(m.unlock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('Tentar outra vez')).toBeTruthy());
  });

  it('inactive (ex.: diálogo do Face ID) não conta como background', async () => {
    await unlocked();
    await act(async () => emit('inactive'));
    now += 600_000;
    await act(async () => emit('active'));
    await flush();
    expect(m.unlock).not.toHaveBeenCalled();
    expect(screen.getByText('conteudo')).toBeTruthy();
  });

  it('depois de desbloquear uma vez, o regresso usa a regra dos 5 min (não é arranque a frio)', async () => {
    await unlocked();
    await act(async () => emit('background'));
    now += 1000;
    await act(async () => emit('active'));
    await flush();
    expect(m.unlock).not.toHaveBeenCalled();
  });
});

describe('BiometricGate: folha "Ativar {label}?"', () => {
  beforeEach(() => {
    m.isBiometricEnabled.mockResolvedValue(false);
    m.hasBiometricPromptAnswered.mockResolvedValue(false);
  });

  it('aparece uma vez; "Agora não" grava a resposta e fecha', async () => {
    await render(tree());
    await waitFor(() => expect(screen.getByText('Ativar Face ID?')).toBeTruthy());
    fireEvent.press(screen.getByText('Agora não'));
    await waitFor(() => expect(m.setBiometricPromptAnswered).toHaveBeenCalledWith('u1'));
    expect(m.setBiometricEnabled).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Ativar Face ID?')).toBeNull());
  });

  it('"Ativar" liga a opção e grava a resposta', async () => {
    await render(tree());
    await waitFor(() => expect(screen.getByText('Ativar Face ID?')).toBeTruthy());
    fireEvent.press(screen.getByText('Ativar'));
    await waitFor(() => expect(m.setBiometricEnabled).toHaveBeenCalledWith('u1', true));
    expect(m.setBiometricPromptAnswered).toHaveBeenCalledWith('u1');
  });

  it('não aparece se já foi respondida', async () => {
    m.hasBiometricPromptAnswered.mockResolvedValue(true);
    await render(tree());
    await waitFor(() => expect(screen.getByText('conteudo')).toBeTruthy());
    expect(screen.queryByText('Ativar Face ID?')).toBeNull();
  });

  it('não aparece sem biometria disponível', async () => {
    m.biometricStatus.mockResolvedValue('notEnrolled');
    await render(tree());
    await waitFor(() => expect(screen.getByText('conteudo')).toBeTruthy());
    expect(screen.queryByText(/^Ativar /)).toBeNull();
  });
});
