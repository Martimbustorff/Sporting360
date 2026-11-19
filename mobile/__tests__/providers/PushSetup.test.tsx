import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState } from 'react-native';
import { router } from 'expo-router';

jest.mock('@/data/hooks', () => ({ useMyUser: jest.fn() }));
jest.mock('@/services/push', () => ({
  requestPushPermission: jest.fn(() => Promise.resolve(true)),
  pushPermissionGranted: jest.fn(() => Promise.resolve(false)),
  registerDevice: jest.fn(() => Promise.resolve('tok-1')),
  onPushTokenRefresh: jest.fn(() => jest.fn()),
  syncTopics: jest.fn(() => Promise.resolve()),
  onPushOpen: jest.fn(() => jest.fn()),
  onPushForeground: jest.fn(() => jest.fn()),
}));

import { useMyUser } from '@/data/hooks';
import { DEFAULT_NOTIFICATION_PREFS } from '@/lib/profileFields';
import { PUSH_BANNER_MS, PUSH_BANNER_TEXT } from '@/components/PushBanner';
import { PushSetup } from '@/providers/PushSetup';
import * as push from '@/services/push';

const p = jest.mocked(push);
const mockUser = useMyUser as jest.Mock;
const ready = (data: object) => ({ status: 'ready', data });
const flush = () => act(async () => {
  await new Promise((r) => setImmediate(r));
});

beforeEach(() => {
  jest.clearAllMocks();
  p.requestPushPermission.mockResolvedValue(true);
  mockUser.mockReturnValue(ready({}));
});

describe('PushSetup', () => {
  it('ready false: não pede permissão', async () => {
    await render(<PushSetup uid="alice" ready={false} />);
    await flush();
    expect(p.requestPushPermission).not.toHaveBeenCalled();
    expect(p.registerDevice).not.toHaveBeenCalled();
    expect(p.syncTopics).not.toHaveBeenCalled();
  });

  it('ready true: pede permissão uma vez e regista o dispositivo se permitido', async () => {
    const view = await render(<PushSetup uid="alice" ready />);
    await flush();
    await view.rerender(<PushSetup uid="alice" ready />);
    await flush();
    expect(p.requestPushPermission).toHaveBeenCalledTimes(1);
    expect(p.registerDevice).toHaveBeenCalledWith('alice');
    expect(p.onPushTokenRefresh).toHaveBeenCalledWith('alice');
  });

  it('passa de ready false a true: só então pede a permissão', async () => {
    const view = await render(<PushSetup uid="alice" ready={false} />);
    await flush();
    expect(p.requestPushPermission).not.toHaveBeenCalled();
    await view.rerender(<PushSetup uid="alice" ready />);
    await flush();
    expect(p.requestPushPermission).toHaveBeenCalledTimes(1);
  });

  it('permissão recusada: não regista, mas sincroniza os tópicos', async () => {
    p.requestPushPermission.mockResolvedValue(false);
    await render(<PushSetup uid="alice" ready />);
    await flush();
    expect(p.registerDevice).not.toHaveBeenCalled();
    expect(p.syncTopics).toHaveBeenCalledTimes(1);
  });

  it('sem notificationPrefs: subscreve os 4 tópicos', async () => {
    await render(<PushSetup uid="alice" ready />);
    await flush();
    expect(p.syncTopics).toHaveBeenCalledWith(DEFAULT_NOTIFICATION_PREFS);
  });

  it('documento users/{uid} ainda inexistente: valores por omissão', async () => {
    mockUser.mockReturnValue({ status: 'missing' });
    await render(<PushSetup uid="alice" ready />);
    await flush();
    expect(p.syncTopics).toHaveBeenCalledWith(DEFAULT_NOTIFICATION_PREFS);
  });

  it('o documento muda goals para false: unsubscribe push_goals', async () => {
    const view = await render(<PushSetup uid="alice" ready />);
    await flush();
    const off = { ...DEFAULT_NOTIFICATION_PREFS, goals: false };
    mockUser.mockReturnValue(ready({ notificationPrefs: off }));
    await view.rerender(<PushSetup uid="alice" ready />);
    await flush();
    expect(p.syncTopics).toHaveBeenLastCalledWith(off);
    expect(p.syncTopics).toHaveBeenCalledTimes(2);
    // Outro snapshot com as mesmas preferências (ex.: confirmado pelo servidor): não volta a sincronizar.
    mockUser.mockReturnValue(ready({ notificationPrefs: { ...off }, displayName: 'x' }));
    await view.rerender(<PushSetup uid="alice" ready />);
    await flush();
    expect(p.syncTopics).toHaveBeenCalledTimes(2);
  });

  it('leitura do users/{uid} com erro ou a carregar: não sincroniza (nunca valores por omissão)', async () => {
    mockUser.mockReturnValue({ status: 'error', error: new Error('x') });
    const view = await render(<PushSetup uid="alice" ready />);
    await flush();
    mockUser.mockReturnValue({ status: 'loading' });
    await view.rerender(<PushSetup uid="alice" ready />);
    await flush();
    expect(p.syncTopics).not.toHaveBeenCalled();
  });

  it('toque com rota válida: router.push(rota)', async () => {
    await render(<PushSetup uid="alice" ready />);
    await flush();
    expect(p.onPushOpen).toHaveBeenCalledTimes(1);
    const handler = p.onPushOpen.mock.calls[0]![0];
    handler('/jogo/9002?tab=mvp');
    expect(router.push).toHaveBeenCalledWith('/jogo/9002?tab=mvp');
  });

  it('outra conta (uid novo): regista o dispositivo para o uid novo e volta a sincronizar', async () => {
    const view = await render(<PushSetup uid="alice" ready />);
    await flush();
    mockUser.mockReturnValue(ready({}));
    await view.rerender(<PushSetup uid="bob" ready />);
    await flush();
    expect(p.registerDevice.mock.calls.map((c) => c[0])).toEqual(['alice', 'bob']);
    expect(p.onPushTokenRefresh.mock.calls.map((c) => c[0])).toEqual(['alice', 'bob']);
    expect(p.syncTopics).toHaveBeenCalledTimes(2);
    expect(mockUser).toHaveBeenLastCalledWith('bob');
  });

  it('ao desmontar, deixa de ouvir o token e o toque', async () => {
    const stopRefresh = jest.fn();
    const stopOpen = jest.fn();
    p.onPushTokenRefresh.mockReturnValue(stopRefresh);
    p.onPushOpen.mockReturnValue(stopOpen);
    const view = await render(<PushSetup uid="alice" ready />);
    await flush();
    await view.unmount();
    expect(stopRefresh).toHaveBeenCalled();
    expect(stopOpen).toHaveBeenCalled();
  });
});

describe('PushSetup: permissão ligada mais tarde nas definições', () => {
  const original = AppState.addEventListener;
  let listeners: ((s: string) => void)[] = [];
  const remove = jest.fn();
  beforeEach(() => {
    listeners = [];
    AppState.addEventListener = jest.fn((_t: string, l: (s: string) => void) => {
      listeners.push(l);
      return { remove };
    }) as never;
  });
  afterEach(() => {
    AppState.addEventListener = original;
  });
  const emit = (s: string) => act(async () => {
    listeners.forEach((l) => l(s));
    await new Promise((r) => setImmediate(r));
  });

  it('recusada ao entrar, ligada depois: ao voltar ao primeiro plano regista o dispositivo', async () => {
    p.requestPushPermission.mockResolvedValue(false);
    const view = await render(<PushSetup uid="alice" ready />);
    await flush();
    expect(p.registerDevice).not.toHaveBeenCalled();
    p.pushPermissionGranted.mockResolvedValue(false);
    await emit('active');
    expect(p.registerDevice).not.toHaveBeenCalled();
    p.pushPermissionGranted.mockResolvedValue(true);
    await emit('background');
    expect(p.registerDevice).not.toHaveBeenCalled();
    await emit('active');
    expect(p.registerDevice).toHaveBeenCalledTimes(1);
    expect(p.registerDevice).toHaveBeenCalledWith('alice');
    expect(p.onPushTokenRefresh).toHaveBeenCalledWith('alice');
    // Já registado: voltar outra vez não regista de novo.
    await emit('active');
    expect(p.registerDevice).toHaveBeenCalledTimes(1);
    await view.unmount();
    expect(remove).toHaveBeenCalled();
  });

  it('ready false: voltar ao primeiro plano não faz nada', async () => {
    p.pushPermissionGranted.mockResolvedValue(true);
    await render(<PushSetup uid="alice" ready={false} />);
    await flush();
    await emit('active');
    expect(p.registerDevice).not.toHaveBeenCalled();
    expect(p.pushPermissionGranted).not.toHaveBeenCalled();
  });
});

describe('PushSetup: aviso com a app aberta (Android)', () => {
  const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
  const tree = () => (
    <SafeAreaProvider initialMetrics={METRICS}>
      <PushSetup uid="alice" ready />
    </SafeAreaProvider>
  );
  const arrive = (n: { title: string; body: string; route: string | null }) =>
    act(async () => {
      p.onPushForeground.mock.calls[0]![0](n);
    });

  it('mostra título e corpo; tocar segue a rota e fecha o aviso', async () => {
    await render(tree());
    await flush();
    expect(p.onPushForeground).toHaveBeenCalledTimes(1);
    await arrive({ title: 'Golo do Sporting!', body: "Pote (30'). Sporting CP 2-0 Benfica", route: '/jogo/9002' });
    expect(screen.getByText('Golo do Sporting!')).toBeTruthy();
    expect(screen.getByText("Pote (30'). Sporting CP 2-0 Benfica")).toBeTruthy();
    const banner = screen.getByRole('button', { name: "Golo do Sporting!. Pote (30'). Sporting CP 2-0 Benfica" });
    expect(banner.props.accessibilityHint).toBe(PUSH_BANNER_TEXT.openHint);
    await fireEvent.press(banner);
    expect(router.push).toHaveBeenCalledWith('/jogo/9002');
    expect(screen.queryByText('Golo do Sporting!')).toBeNull();
  });

  it('sem rota válida: tocar só fecha o aviso', async () => {
    await render(tree());
    await flush();
    await arrive({ title: 'Notícia', body: 'Resumo', route: null });
    const banner = screen.getByRole('button', { name: 'Notícia. Resumo' });
    expect(banner.props.accessibilityHint).toBe(PUSH_BANNER_TEXT.closeHint);
    await fireEvent.press(banner);
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.queryByText('Notícia')).toBeNull();
  });

  it(`fecha sozinho ao fim de ${PUSH_BANNER_MS} ms; um aviso novo substitui o anterior`, async () => {
    jest.useFakeTimers();
    try {
      await render(tree());
      await act(async () => undefined);
      await arrive({ title: 'Primeiro', body: 'a', route: null });
      await act(async () => {
        jest.advanceTimersByTime(PUSH_BANNER_MS - 1000);
      });
      await arrive({ title: 'Segundo', body: 'b', route: null });
      expect(screen.queryByText('Primeiro')).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(PUSH_BANNER_MS - 1);
      });
      expect(screen.getByText('Segundo')).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(1);
      });
      expect(screen.queryByText('Segundo')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('ao desmontar deixa de ouvir', async () => {
    const stop = jest.fn();
    p.onPushForeground.mockReturnValue(stop);
    const view = await render(tree());
    await flush();
    await view.unmount();
    expect(stop).toHaveBeenCalled();
  });
});
