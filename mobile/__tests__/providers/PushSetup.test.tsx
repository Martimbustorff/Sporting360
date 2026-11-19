import React from 'react';
import { act, render } from '@testing-library/react-native';
import { router } from 'expo-router';

jest.mock('@/data/hooks', () => ({ useMyUser: jest.fn() }));
jest.mock('@/services/push', () => ({
  requestPushPermission: jest.fn(() => Promise.resolve(true)),
  registerDevice: jest.fn(() => Promise.resolve('tok-1')),
  onPushTokenRefresh: jest.fn(() => jest.fn()),
  syncTopics: jest.fn(() => Promise.resolve()),
  onPushOpen: jest.fn(() => jest.fn()),
}));

import { useMyUser } from '@/data/hooks';
import { DEFAULT_NOTIFICATION_PREFS } from '@/lib/profileFields';
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
