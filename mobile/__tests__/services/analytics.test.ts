// Task 6: consentimento de Analytics. Módulos novos por teste (estado em memória) com SecureStore e Firebase mockados.
import * as SecureStore from 'expo-secure-store';

jest.mock('@react-native-firebase/analytics');

type Mod = typeof import('@/services/analytics');
type Fb = typeof import('@react-native-firebase/analytics');
type Store = typeof import('expo-secure-store') & { __reset: () => void };

function load(): { a: Mod; fb: Fb; store: Store } {
  let out!: { a: Mod; fb: Fb; store: Store };
  jest.isolateModules(() => {
    out = {
      a: require('@/services/analytics'),
      fb: require('@react-native-firebase/analytics'),
      store: require('expo-secure-store'),
    };
  });
  return out;
}

const KEY = 's360.analyticsConsent';

describe('analytics consent', () => {
  it('sem escolha gravada devolve null', async () => {
    const { a } = load();
    expect(await a.getAnalyticsConsent()).toBeNull();
  });

  it('track sem consentimento não chama logEvent', async () => {
    const { a, fb } = load();
    a.track('share_open', { n: 1 });
    expect(fb.logEvent).not.toHaveBeenCalled();
    await a.setAnalyticsConsent('denied');
    a.track('share_open');
    expect(fb.logEvent).not.toHaveBeenCalled();
  });

  it('com granted grava, liga a recolha e track chama logEvent', async () => {
    const { a, fb, store } = load();
    await a.setAnalyticsConsent('granted');
    expect(store.setItemAsync).toHaveBeenCalledWith(KEY, 'granted');
    expect(fb.setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(expect.anything(), true);
    a.track('share_prediction', { game: 'g1' });
    expect(fb.logEvent).toHaveBeenCalledWith(expect.anything(), 'share_prediction', { game: 'g1' });
    expect(await a.getAnalyticsConsent()).toBe('granted');
  });

  it('denied desliga a recolha e limpa o uid', async () => {
    const { a, fb } = load();
    await a.setAnalyticsConsent('denied');
    expect(fb.setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(expect.anything(), false);
    expect(fb.setUserId).toHaveBeenLastCalledWith(expect.anything(), null);
    expect(await a.getAnalyticsConsent()).toBe('denied');
  });

  it('track nunca lança, mesmo se logEvent falhar', async () => {
    const { a, fb } = load();
    await a.setAnalyticsConsent('granted');
    (fb.logEvent as jest.Mock).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(() => a.track('x')).not.toThrow();
    (fb.logEvent as jest.Mock).mockImplementationOnce(() => Promise.reject(new Error('boom')));
    expect(() => a.track('y')).not.toThrow();
  });

  it('applyStoredConsent: guardado granted liga; sem escolha fica desligado', async () => {
    const first = load();
    await first.store.setItemAsync(KEY, 'granted');
    await first.a.applyStoredConsent();
    expect(first.fb.setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(expect.anything(), true);
    first.store.__reset();
    await first.a.applyStoredConsent();
    expect(first.fb.setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(expect.anything(), false);
  });

  it('valor guardado inválido ou leitura que falha contam como sem escolha', async () => {
    const { a, store } = load();
    await store.setItemAsync(KEY, 'talvez');
    expect(await a.getAnalyticsConsent()).toBeNull();
    (store.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('keychain'));
    expect(await a.getAnalyticsConsent()).toBeNull();
  });

  it('setAnalyticsConsent não lança se a gravação falhar e vale na sessão', async () => {
    const { a, fb, store } = load();
    (store.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('keychain'));
    await expect(a.setAnalyticsConsent('granted')).resolves.toBeUndefined();
    a.track('x');
    expect(fb.logEvent).toHaveBeenCalled();
  });
});

// Task 17 (revisão): arranque a frio pelo link partilhado; `share_open` chega antes de a escolha guardada ser lida.
describe('eventos antes de a escolha guardada ser aplicada', () => {
  it('ficam em espera e seguem quando a escolha guardada é granted', async () => {
    const { a, fb, store } = load();
    await store.setItemAsync(KEY, 'granted');
    a.track('share_open', { game: '1001', src: 'share' });
    expect(fb.logEvent).not.toHaveBeenCalled();
    await a.applyStoredConsent();
    expect(fb.logEvent).toHaveBeenCalledTimes(1);
    expect(fb.logEvent).toHaveBeenCalledWith(expect.anything(), 'share_open', { game: '1001', src: 'share' });
    a.track('share_open', { game: '1002' });
    expect(fb.logEvent).toHaveBeenCalledTimes(2);
  });

  it('são descartados quando a escolha guardada é denied, e não voltam depois', async () => {
    const { a, fb, store } = load();
    await store.setItemAsync(KEY, 'denied');
    a.track('share_open', { game: '1001', src: 'share' });
    await a.applyStoredConsent();
    expect(fb.logEvent).not.toHaveBeenCalled();
    await a.setAnalyticsConsent('granted');
    expect(fb.logEvent).not.toHaveBeenCalled();
  });

  it('sem escolha guardada também são descartados', async () => {
    const { a, fb } = load();
    a.track('share_open', { game: '1001' });
    await a.applyStoredConsent();
    expect(fb.logEvent).not.toHaveBeenCalled();
  });

  it('a espera tem limite', async () => {
    const { a, fb, store } = load();
    await store.setItemAsync(KEY, 'granted');
    for (let i = 0; i < 30; i++) a.track('e', { i });
    await a.applyStoredConsent();
    expect(fb.logEvent).toHaveBeenCalledTimes(20);
  });
});

describe('setAnalyticsUserId (F14)', () => {
  it('denied: não chama setUserId com um uid', async () => {
    const { a, fb, store } = load();
    await store.setItemAsync(KEY, 'denied');
    await a.setAnalyticsUserId('u1');
    expect(fb.setUserId).not.toHaveBeenCalled();
  });

  it('sem escolha: não envia o uid', async () => {
    const { a, fb } = load();
    await a.setAnalyticsUserId('u1');
    expect(fb.setUserId).not.toHaveBeenCalled();
  });

  it('granted guardado e ainda não lido em memória: lê e envia o uid', async () => {
    const { a, fb, store } = load();
    await store.setItemAsync(KEY, 'granted');
    await a.setAnalyticsUserId('u1');
    expect(fb.setUserId).toHaveBeenCalledWith(expect.anything(), 'u1');
  });

  it('null passa sempre, mesmo sem consentimento', async () => {
    const { a, fb } = load();
    await a.setAnalyticsUserId(null);
    expect(fb.setUserId).toHaveBeenCalledWith(expect.anything(), null);
  });

  it('aceitar depois do início de sessão define o uid atual', async () => {
    const { a, fb } = load();
    await a.setAnalyticsUserId('u1');
    expect(fb.setUserId).not.toHaveBeenCalled();
    await a.setAnalyticsConsent('granted');
    expect(fb.setUserId).toHaveBeenCalledWith(expect.anything(), 'u1');
  });

  it('terminar sessão depois de aceitar limpa o uid e não o repõe ao reaplicar', async () => {
    const { a, fb } = load();
    await a.setAnalyticsConsent('granted');
    await a.setAnalyticsUserId('u1');
    await a.setAnalyticsUserId(null);
    (fb.setUserId as jest.Mock).mockClear();
    await a.applyStoredConsent();
    expect(fb.setUserId).not.toHaveBeenCalled();
  });
});

afterEach(() => {
  (SecureStore as unknown as Store).__reset();
  jest.clearAllMocks();
});
