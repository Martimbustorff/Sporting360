import { PermissionsAndroid, Platform } from 'react-native';
import * as fm from '@react-native-firebase/messaging';
import { deleteDoc, doc, setDoc } from '@react-native-firebase/firestore';
import { recordError } from '@react-native-firebase/crashlytics';
import { DEFAULT_NOTIFICATION_PREFS } from '@/lib/profileFields';
import {
  PUSH_UNREGISTER_TIMEOUT_MS,
  onPushForeground,
  onPushOpen,
  onPushTokenRefresh,
  pushPermissionGranted,
  registerDevice,
  requestPushPermission,
  resetPushForTests,
  syncTopics,
  unregisterPush,
} from '@/services/push';

const m = jest.mocked(fm);
const originalOS = Platform.OS;
const originalVersion = Platform.Version;
const setPlatform = (os: 'ios' | 'android', version: number | string = 17) => {
  Platform.OS = os;
  Object.defineProperty(Platform, 'Version', { value: version, configurable: true });
};

beforeEach(() => {
  jest.clearAllMocks();
  resetPushForTests();
  setPlatform('ios', '18.0');
  m.getToken.mockResolvedValue('tok-1');
  m.requestPermission.mockResolvedValue(fm.AuthorizationStatus.AUTHORIZED);
  m.hasPermission.mockResolvedValue(fm.AuthorizationStatus.AUTHORIZED);
  m.subscribeToTopic.mockResolvedValue(undefined);
  m.unsubscribeFromTopic.mockResolvedValue(undefined);
  m.getInitialNotification.mockResolvedValue(null);
});
afterAll(() => {
  Platform.OS = originalOS;
  Object.defineProperty(Platform, 'Version', { value: originalVersion, configurable: true });
});

const flush = () => new Promise((r) => setImmediate(r));

describe('permissão', () => {
  it('iOS: AUTHORIZED e PROVISIONAL contam como permitido', async () => {
    m.requestPermission.mockResolvedValueOnce(fm.AuthorizationStatus.PROVISIONAL);
    expect(await requestPushPermission()).toBe(true);
    m.requestPermission.mockResolvedValueOnce(fm.AuthorizationStatus.DENIED);
    expect(await requestPushPermission()).toBe(false);
    m.requestPermission.mockResolvedValueOnce(fm.AuthorizationStatus.AUTHORIZED);
    expect(await requestPushPermission()).toBe(true);
    m.hasPermission.mockResolvedValueOnce(fm.AuthorizationStatus.NOT_DETERMINED);
    expect(await pushPermissionGranted()).toBe(false);
    m.hasPermission.mockResolvedValueOnce(fm.AuthorizationStatus.PROVISIONAL);
    expect(await pushPermissionGranted()).toBe(true);
  });

  it('Android 33+: pede POST_NOTIFICATIONS; Android 32: true sem pedir', async () => {
    const request = jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
    const check = jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    setPlatform('android', 33);
    expect(await requestPushPermission()).toBe(true);
    expect(request).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    request.mockResolvedValueOnce(PermissionsAndroid.RESULTS.DENIED);
    expect(await requestPushPermission()).toBe(false);
    expect(await pushPermissionGranted()).toBe(false);
    expect(check).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    expect(m.requestPermission).not.toHaveBeenCalled();
    request.mockClear();
    setPlatform('android', 32);
    expect(await requestPushPermission()).toBe(true);
    expect(await pushPermissionGranted()).toBe(true);
    expect(request).not.toHaveBeenCalled();
    request.mockRestore();
    check.mockRestore();
  });

  it('uma falha a pedir a permissão devolve false e só reporta o código', async () => {
    m.requestPermission.mockRejectedValueOnce(Object.assign(new Error('tok-1 alice@x.pt'), { code: 'messaging/unknown' }));
    expect(await requestPushPermission()).toBe(false);
    expect((jest.mocked(recordError).mock.calls[0]![1] as Error).message).toBe('push.permission messaging/unknown');
  });
});

describe('dispositivo', () => {
  it('registerDevice grava users/{uid}/devices/{token} com token, platform e updatedAt', async () => {
    expect(await registerDevice('alice')).toBe('tok-1');
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'users/alice/devices/tok-1');
    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/alice/devices/tok-1' }),
      { token: 'tok-1', platform: 'ios', updatedAt: { __kind: 'serverTimestamp' } },
      { merge: true },
    );
  });

  it('registerDevice sem token (falha do FCM) devolve null e não grava', async () => {
    m.getToken.mockRejectedValueOnce(new Error('x'));
    expect(await registerDevice('alice')).toBeNull();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('onPushTokenRefresh grava o token novo e devolve o unsubscribe', async () => {
    const unsub = onPushTokenRefresh('alice');
    const listener = m.onTokenRefresh.mock.calls[0]![1];
    listener('tok-2');
    await flush();
    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/alice/devices/tok-2' }),
      expect.objectContaining({ token: 'tok-2' }),
      { merge: true },
    );
    expect(typeof unsub).toBe('function');
  });
});

describe('tópicos', () => {
  it('syncTopics aplica o plano e uma falha não impede as outras nem lança', async () => {
    m.subscribeToTopic.mockRejectedValueOnce(new Error('offline'));
    await expect(syncTopics({ ...DEFAULT_NOTIFICATION_PREFS, news: false })).resolves.toBeUndefined();
    expect(m.subscribeToTopic.mock.calls.map((c) => c[1])).toEqual(['push_matchStart', 'push_goals', 'push_mvpOpen']);
    expect(m.unsubscribeFromTopic.mock.calls.map((c) => c[1])).toEqual(['push_news']);
  });

  it('syncTopics(null) tira os 4 tópicos', async () => {
    await syncTopics(null);
    expect(m.unsubscribeFromTopic).toHaveBeenCalledTimes(4);
    expect(m.subscribeToTopic).not.toHaveBeenCalled();
  });
});

describe('sair', () => {
  it('unregisterPush tira os 4 tópicos e apaga o dispositivo; offline não lança', async () => {
    await unregisterPush('alice');
    expect(m.unsubscribeFromTopic.mock.calls.map((c) => c[1]).sort()).toEqual(['push_goals', 'push_matchStart', 'push_mvpOpen', 'push_news']);
    expect(deleteDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/alice/devices/tok-1' }));

    jest.clearAllMocks();
    m.unsubscribeFromTopic.mockRejectedValue(new Error('offline'));
    jest.mocked(deleteDoc).mockRejectedValueOnce(new Error('offline'));
    await expect(unregisterPush('alice')).resolves.toBeUndefined();
    m.unsubscribeFromTopic.mockResolvedValue(undefined);
  });

  it('cada passo do desregisto tem um limite de tempo', async () => {
    jest.useFakeTimers();
    try {
      m.getToken.mockReturnValueOnce(new Promise(() => undefined));
      m.unsubscribeFromTopic.mockReturnValue(new Promise(() => undefined));
      const p = unregisterPush('alice');
      await jest.advanceTimersByTimeAsync(PUSH_UNREGISTER_TIMEOUT_MS * 3);
      await expect(p).resolves.toBeUndefined();
    } finally {
      jest.useRealTimers();
      m.unsubscribeFromTopic.mockResolvedValue(undefined);
    }
  });

  it('PUSH_UNREGISTER_TIMEOUT_MS', () => expect(PUSH_UNREGISTER_TIMEOUT_MS).toBe(4000));
});

describe('toque na notificação', () => {
  it('onPushOpen: toque com a app fechada e em segundo plano chamam o handler com a rota; rota inválida não', async () => {
    m.getInitialNotification.mockResolvedValueOnce({ data: { route: '/jogo/9002?tab=mvp' } });
    const handler = jest.fn();
    onPushOpen(handler);
    await flush();
    expect(handler).toHaveBeenCalledWith('/jogo/9002?tab=mvp');
    const listener = m.onNotificationOpenedApp.mock.calls[0]![1];
    listener({ data: { route: '/noticias?id=abc' } });
    listener({ data: { route: 'https://evil.pt' } });
    listener({});
    expect(handler.mock.calls).toEqual([['/jogo/9002?tab=mvp'], ['/noticias?id=abc']]);
  });

  it('getInitialNotification só é tratado uma vez', async () => {
    m.getInitialNotification.mockResolvedValue({ data: { route: '/jogo/1' } });
    const handler = jest.fn();
    const unsub = onPushOpen(handler);
    await flush();
    onPushOpen(handler);
    await flush();
    expect(m.getInitialNotification).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(typeof unsub).toBe('function');
  });
});

describe('módulo nativo em falta', () => {
  it('getMessaging a lançar: nenhuma função lança nem derruba quem a chama', async () => {
    const boom = () => {
      throw Object.assign(new Error('native module missing'), { code: 'messaging/native' });
    };
    m.getMessaging.mockImplementation(boom as never);
    try {
      await expect(syncTopics(DEFAULT_NOTIFICATION_PREFS)).resolves.toBeUndefined();
      await expect(unregisterPush('alice')).resolves.toBeUndefined();
      let stopOpen: (() => void) | undefined;
      expect(() => {
        stopOpen = onPushOpen(jest.fn());
      }).not.toThrow();
      expect(() => stopOpen!()).not.toThrow();
      let stopRefresh: (() => void) | undefined;
      expect(() => {
        stopRefresh = onPushTokenRefresh('alice');
      }).not.toThrow();
      expect(() => stopRefresh!()).not.toThrow();
      expect(await requestPushPermission()).toBe(false);
      expect(await pushPermissionGranted()).toBe(false);
      expect(await registerDevice('alice')).toBeNull();
      expect(jest.mocked(recordError)).toHaveBeenCalled();
    } finally {
      m.getMessaging.mockImplementation((() => ({ __mock: 'messaging' })) as never);
    }
  });
});

describe('notificação com a app aberta', () => {
  it('Android: onMessage chama o handler com título, corpo e rota validada', () => {
    setPlatform('android', 34);
    const handler = jest.fn();
    const stop = onPushForeground(handler);
    const listener = m.onMessage.mock.calls[0]![1];
    listener({ notification: { title: 'Golo do Sporting!', body: 'Pote (30\').' }, data: { route: '/jogo/9002' } });
    listener({ notification: { title: 'Notícia', body: 'x' }, data: { route: 'https://evil.pt' } });
    listener({ notification: { title: '  ' }, data: { route: '/jogo/1' } });
    listener({ data: { route: '/jogo/1' } });
    expect(handler.mock.calls).toEqual([
      [{ title: 'Golo do Sporting!', body: "Pote (30').", route: '/jogo/9002' }],
      [{ title: 'Notícia', body: 'x', route: null }],
    ]);
    expect(typeof stop).toBe('function');
  });

  it('iOS: não ouve onMessage (o sistema já mostra a notificação)', () => {
    setPlatform('ios', '18.0');
    const stop = onPushForeground(jest.fn());
    expect(m.onMessage).not.toHaveBeenCalled();
    expect(() => stop()).not.toThrow();
  });

  it('Android com o módulo nativo a falhar: não lança', () => {
    setPlatform('android', 34);
    m.getMessaging.mockImplementationOnce((() => {
      throw new Error('native');
    }) as never);
    expect(() => onPushForeground(jest.fn())()).not.toThrow();
  });
});
