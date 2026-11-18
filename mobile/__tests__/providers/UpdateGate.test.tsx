import React from 'react';
import { Linking, Platform, Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';

jest.mock('expo-splash-screen', () => ({ hideAsync: jest.fn(() => Promise.resolve()), preventAutoHideAsync: jest.fn() }));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '7.0.0' }));
jest.mock('@/data/hooks', () => ({ useAppConfig: jest.fn() }));

import { useAppConfig } from '@/data/hooks';
import { UpdateGate } from '@/providers/UpdateGate';
import { STORE_URLS } from '@/lib/version';
import { AppConfigSchema } from '@/data/schemas';

const mockConfig = useAppConfig as jest.Mock;
const ready = (data: object) => ({ status: 'ready', data });
const setOS = (os: 'ios' | 'android') => Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });

const tree = (fontsReady = true) => (
  <UpdateGate fontsReady={fontsReady}>
    <Text>filhos</Text>
  </UpdateGate>
);

let openURL: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  setOS('ios');
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
});

describe('UpdateGate', () => {
  it('blocks when the installed version is below the minimum and opens the iOS store', async () => {
    mockConfig.mockReturnValue(ready({ minVersion: { ios: '7.1.0', android: '1.0.0' } }));
    await render(tree());
    expect(screen.getByText('Atualização obrigatória')).toBeTruthy();
    expect(screen.getByText('Há uma versão nova da S360. Atualiza a app para continuar.')).toBeTruthy();
    expect(screen.queryByText('filhos')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Atualizar'));
    expect(openURL).toHaveBeenCalledWith(STORE_URLS.ios);
  });

  it('shows the config texts when present', async () => {
    mockConfig.mockReturnValue(
      ready({
        minVersion: { ios: '7.1.0', android: '1.0.0' },
        texts: { updateRequiredTitle: 'Título X', updateRequiredBody: 'Corpo X', updateButton: 'Botão X' },
      }),
    );
    await render(tree());
    expect(screen.getByText('Título X')).toBeTruthy();
    expect(screen.getByText('Corpo X')).toBeTruthy();
    expect(screen.queryByText('Atualização obrigatória')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Botão X'));
    expect(openURL).toHaveBeenCalledWith(STORE_URLS.ios);
  });

  it('still blocks with the STORE_URLS fallback when storeUrls is malformed but minVersion is valid', async () => {
    const parsed = AppConfigSchema.safeParse({ minVersion: { ios: '7.1.0', android: '1.0.0' }, storeUrls: 'lixo' });
    expect(parsed.success).toBe(true);
    mockConfig.mockReturnValue(ready(parsed.success ? parsed.data : {}));
    await render(tree());
    expect(screen.getByText('Atualização obrigatória')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Atualizar'));
    expect(openURL).toHaveBeenCalledWith(STORE_URLS.ios);
  });

  it('falls back to the default copy when texts is malformed', async () => {
    const parsed = AppConfigSchema.safeParse({ minVersion: { ios: '7.1.0', android: '1.0.0' }, texts: 42 });
    expect(parsed.success).toBe(true);
    mockConfig.mockReturnValue(ready(parsed.success ? parsed.data : {}));
    await render(tree());
    expect(screen.getByText('Atualização obrigatória')).toBeTruthy();
    expect(screen.getByText('Há uma versão nova da S360. Atualiza a app para continuar.')).toBeTruthy();
    expect(screen.getByLabelText('Atualizar')).toBeTruthy();
  });

  it('opens the Android store on Android', async () => {
    setOS('android');
    mockConfig.mockReturnValue(ready({ minVersion: { ios: '1.0.0', android: '7.1.0' } }));
    await render(tree());
    await fireEvent.press(screen.getByLabelText('Atualizar'));
    expect(openURL).toHaveBeenCalledWith(STORE_URLS.android);
  });

  it('uses a valid storeUrls override and ignores a tampered one', async () => {
    mockConfig.mockReturnValue(
      ready({ minVersion: { ios: '7.1.0', android: '1.0.0' }, storeUrls: { ios: 'https://apps.apple.com/pt/app/id9' } }),
    );
    const { unmount } = await render(tree());
    await fireEvent.press(screen.getByLabelText('Atualizar'));
    expect(openURL).toHaveBeenLastCalledWith('https://apps.apple.com/pt/app/id9');
    await unmount();
    mockConfig.mockReturnValue(
      ready({ minVersion: { ios: '7.1.0', android: '1.0.0' }, storeUrls: { ios: 'https://evil.example.com/x' } }),
    );
    await render(tree());
    await fireEvent.press(screen.getByLabelText('Atualizar'));
    expect(openURL).toHaveBeenLastCalledWith(STORE_URLS.ios);
  });

  it('does not crash when Linking.openURL rejects or throws', async () => {
    mockConfig.mockReturnValue(ready({ minVersion: { ios: '7.1.0', android: '1.0.0' } }));
    await render(tree());
    openURL.mockRejectedValueOnce(new Error('x'));
    await fireEvent.press(screen.getByLabelText('Atualizar'));
    await act(async () => {});
    openURL.mockImplementationOnce(() => {
      throw new Error('sync');
    });
    await fireEvent.press(screen.getByLabelText('Atualizar'));
    expect(screen.getByText('Atualização obrigatória')).toBeTruthy();
  });

  it('shows children when only the other platform requires an update', async () => {
    mockConfig.mockReturnValue(ready({ minVersion: { ios: '1.0.0', android: '7.1.0' } }));
    await render(tree());
    expect(screen.getByText('filhos')).toBeTruthy();
    expect(screen.queryByText('Atualização obrigatória')).toBeNull();
  });

  it('shows children when the version is equal or above the minimum', async () => {
    mockConfig.mockReturnValue(ready({ minVersion: { ios: '7.0.0', android: '7.0.0' } }));
    await render(tree());
    expect(screen.getByText('filhos')).toBeTruthy();
  });

  it.each([
    ['loading', { status: 'loading' }],
    ['missing', { status: 'missing' }],
    ['error', { status: 'error', error: new Error('malformado') }],
  ])('shows children when config is %s', async (_n, value) => {
    mockConfig.mockReturnValue(value);
    await render(tree());
    expect(screen.getByText('filhos')).toBeTruthy();
  });

  it('blocks without restart when the live document raises the minimum', async () => {
    mockConfig.mockReturnValue(ready({ minVersion: { ios: '7.0.0', android: '7.0.0' } }));
    const { rerender } = await render(tree());
    expect(screen.getByText('filhos')).toBeTruthy();
    mockConfig.mockReturnValue(ready({ minVersion: { ios: '7.2.0', android: '7.2.0' } }));
    await rerender(tree());
    expect(screen.getByText('Atualização obrigatória')).toBeTruthy();
  });

  it('hides the native splash when blocking (children, and so RootStack, are not mounted)', async () => {
    mockConfig.mockReturnValue(ready({ minVersion: { ios: '7.1.0', android: '1.0.0' } }));
    await render(tree());
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });

  it('keeps the splash up until fonts are ready, then shows the screen', async () => {
    mockConfig.mockReturnValue(ready({ minVersion: { ios: '7.1.0', android: '1.0.0' } }));
    const { rerender } = await render(tree(false));
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
    expect(screen.queryByText('Atualização obrigatória')).toBeNull();
    await rerender(tree(true));
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
    expect(screen.getByText('Atualização obrigatória')).toBeTruthy();
  });

  it('does not touch the splash when not blocking', async () => {
    mockConfig.mockReturnValue({ status: 'loading' });
    await render(tree());
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });
});
