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

  it('aceitar com a gravação a falhar rejeita e não liga nada (o consentimento não fica dado)', async () => {
    const { a, fb, store } = load();
    (store.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('keychain'));
    await a.setAnalyticsUserId('u1');
    await expect(a.setAnalyticsConsent('granted')).rejects.toThrow('CONSENT_SAVE_FAILED');
    expect(fb.setAnalyticsCollectionEnabled).not.toHaveBeenCalledWith(expect.anything(), true);
    expect(fb.setUserId).not.toHaveBeenCalledWith(expect.anything(), 'u1');
    a.track('x');
    expect(fb.logEvent).not.toHaveBeenCalled();
    expect(await a.getAnalyticsConsent()).toBeNull();
  });
});

describe('recusar nunca falha em silêncio (fix round 1)', () => {
  it('grava "denied" antes de desligar a recolha', async () => {
    const { a, fb, store } = load();
    const order: string[] = [];
    (store.setItemAsync as jest.Mock).mockImplementationOnce(async () => {
      order.push('store');
    });
    (fb.setAnalyticsCollectionEnabled as jest.Mock).mockImplementation(async () => {
      order.push('collection');
    });
    await a.setAnalyticsConsent('denied');
    expect(order).toEqual(['store', 'collection']);
  });

  it('gravação falhada: apaga o "granted" guardado, desliga a recolha, limpa o uid e rejeita', async () => {
    const { a, fb, store } = load();
    await a.setAnalyticsConsent('granted');
    await a.setAnalyticsUserId('u1');
    (fb.setUserId as jest.Mock).mockClear();
    (store.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('keychain'));
    await expect(a.setAnalyticsConsent('denied')).rejects.toThrow('CONSENT_SAVE_FAILED');
    expect(store.deleteItemAsync).toHaveBeenCalledWith(KEY);
    expect(fb.setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(expect.anything(), false);
    expect(fb.setUserId).toHaveBeenCalledWith(expect.anything(), null);
    a.track('x');
    expect(fb.logEvent).not.toHaveBeenCalled();
    // Próximo arranque: sem escolha guardada (nunca o "granted" antigo), a folha volta a perguntar.
    expect(await a.getAnalyticsConsent()).toBeNull();
    await a.applyStoredConsent();
    expect(fb.setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(expect.anything(), false);
  });

  it('gravação e limpeza falhadas: mesmo assim desliga a recolha nesta sessão, limpa o uid e rejeita', async () => {
    const { a, fb, store } = load();
    await a.setAnalyticsConsent('granted');
    await a.setAnalyticsUserId('u1');
    (fb.setUserId as jest.Mock).mockClear();
    (store.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('keychain'));
    (store.deleteItemAsync as jest.Mock).mockRejectedValueOnce(new Error('keychain'));
    await expect(a.setAnalyticsConsent('denied')).rejects.toThrow('CONSENT_SAVE_FAILED');
    expect(fb.setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(expect.anything(), false);
    expect(fb.setUserId).toHaveBeenCalledWith(expect.anything(), null);
    a.track('x');
    expect(fb.logEvent).not.toHaveBeenCalled();
    await a.setAnalyticsUserId('u1');
    expect(fb.setUserId).not.toHaveBeenCalledWith(expect.anything(), 'u1');
  });

  it('desligar a recolha a falhar: "denied" fica guardado, uid limpo, eventos parados, rejeita', async () => {
    const { a, fb, store } = load();
    await a.setAnalyticsConsent('granted');
    (fb.setAnalyticsCollectionEnabled as jest.Mock).mockRejectedValueOnce(new Error('nativo'));
    await expect(a.setAnalyticsConsent('denied')).rejects.toThrow();
    expect(await store.getItemAsync(KEY)).toBe('denied');
    expect(fb.setUserId).toHaveBeenLastCalledWith(expect.anything(), null);
    (fb.logEvent as jest.Mock).mockClear();
    a.track('x');
    expect(fb.logEvent).not.toHaveBeenCalled();
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

describe('mudanças rápidas no interruptor (Task 26, minors da Task 6)', () => {
  it('leitura antiga não sobrepõe um "denied" escolhido durante a leitura: o uid não segue', async () => {
    const { a, fb, store } = load();
    await store.setItemAsync(KEY, 'granted');
    let release!: (v: string | null) => void;
    (store.getItemAsync as jest.Mock).mockImplementationOnce(() => new Promise((r) => (release = r)));
    const signIn = a.setAnalyticsUserId('u1');
    await a.setAnalyticsConsent('denied');
    (fb.setUserId as jest.Mock).mockClear();
    release('granted');
    await signIn;
    expect(fb.setUserId).not.toHaveBeenCalledWith(expect.anything(), 'u1');
  });

  it('aceitar e recusar logo a seguir: aplicados por ordem, fica recolha desligada e uid limpo no fim', async () => {
    const { a, fb } = load();
    await a.setAnalyticsUserId('u1');
    const calls: string[] = [];
    (fb.setAnalyticsCollectionEnabled as jest.Mock).mockImplementation(async (_x: unknown, on: boolean) => {
      calls.push(`collection:${on}`);
    });
    (fb.setUserId as jest.Mock).mockImplementation(async (_x: unknown, id: string | null) => {
      calls.push(`uid:${id}`);
    });
    await Promise.all([a.setAnalyticsConsent('granted'), a.setAnalyticsConsent('denied')]);
    expect(calls).toEqual(['collection:true', 'uid:u1', 'collection:false', 'uid:null']);
    a.track('x');
    expect(fb.logEvent).not.toHaveBeenCalled();
  });

  it('recusar com setAnalyticsCollectionEnabled a falhar ainda limpa o uid', async () => {
    const { a, fb } = load();
    await a.setAnalyticsConsent('granted');
    await a.setAnalyticsUserId('u1');
    (fb.setUserId as jest.Mock).mockClear();
    (fb.setAnalyticsCollectionEnabled as jest.Mock).mockRejectedValueOnce(new Error('nativo'));
    await expect(a.setAnalyticsConsent('denied')).rejects.toThrow('nativo');
    expect(fb.setUserId).toHaveBeenCalledWith(expect.anything(), null);
  });
});

afterEach(() => {
  (SecureStore as unknown as Store).__reset();
  jest.clearAllMocks();
});
