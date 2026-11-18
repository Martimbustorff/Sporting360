import { Platform } from 'react-native';
import { connectAuthEmulator } from '@react-native-firebase/auth';
import { connectFirestoreEmulator } from '@react-native-firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from '@react-native-firebase/functions';
import { setUserId, setUserProperty } from '@react-native-firebase/analytics';
import { initializeAppCheck } from '@react-native-firebase/app-check';
import {
  recordError,
  setCrashlyticsCollectionEnabled,
} from '@react-native-firebase/crashlytics';

jest.mock('@react-native-firebase/app');
jest.mock('@react-native-firebase/auth');
jest.mock('@react-native-firebase/firestore');
jest.mock('@react-native-firebase/functions');
jest.mock('@react-native-firebase/crashlytics');
jest.mock('@react-native-firebase/analytics');
jest.mock('@react-native-firebase/app-check');

type FirebaseModule = typeof import('@/services/firebase');

function load(): FirebaseModule {
  let mod!: FirebaseModule;
  jest.isolateModules(() => {
    mod = require('@/services/firebase');
  });
  return mod;
}

describe('emulatorHost', () => {
  it('uses 10.0.2.2 on android, 127.0.0.1 on ios, and the override', () => {
    const { emulatorHost } = load();
    expect(emulatorHost('android')).toBe('10.0.2.2');
    expect(emulatorHost('ios')).toBe('127.0.0.1');
    expect(emulatorHost('android', '192.168.1.20')).toBe('192.168.1.20');
  });
});

const g = globalThis as unknown as { __DEV__: boolean };
const originalDev = g.__DEV__;
const originalSwitch = process.env.EXPO_PUBLIC_USE_EMULATOR;
const originalHost = process.env.EXPO_PUBLIC_EMULATOR_HOST;

afterEach(() => {
  g.__DEV__ = originalDev;
  Platform.OS = 'ios';
  if (originalSwitch === undefined) delete process.env.EXPO_PUBLIC_USE_EMULATOR;
  else process.env.EXPO_PUBLIC_USE_EMULATOR = originalSwitch;
  if (originalHost === undefined) delete process.env.EXPO_PUBLIC_EMULATOR_HOST;
  else process.env.EXPO_PUBLIC_EMULATOR_HOST = originalHost;
});

describe('initFirebase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_USE_EMULATOR = '1';
    delete process.env.EXPO_PUBLIC_EMULATOR_HOST;
    Platform.OS = 'android';
  });

  it('connects emulators once, even when called twice', () => {
    const { initFirebase } = load();
    initFirebase();
    initFirebase();
    expect(connectAuthEmulator).toHaveBeenCalledTimes(1);
    expect(connectAuthEmulator).toHaveBeenCalledWith(expect.anything(), 'http://10.0.2.2:9099');
    expect(connectFirestoreEmulator).toHaveBeenCalledTimes(1);
    expect(connectFirestoreEmulator).toHaveBeenCalledWith(expect.anything(), '10.0.2.2', 8080);
    expect(connectFunctionsEmulator).toHaveBeenCalledTimes(1);
    expect(connectFunctionsEmulator).toHaveBeenCalledWith(expect.anything(), '10.0.2.2', 5001);
    expect(initializeAppCheck).toHaveBeenCalledTimes(1);
  });

  it('honours the host override', () => {
    process.env.EXPO_PUBLIC_EMULATOR_HOST = '192.168.1.20';
    const { initFirebase } = load();
    initFirebase();
    expect(connectAuthEmulator).toHaveBeenCalledWith(expect.anything(), 'http://192.168.1.20:9099');
  });

  it('ignores the emulator switch outside __DEV__', () => {
    g.__DEV__ = false;
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { initFirebase } = load();
    initFirebase();
    expect(connectAuthEmulator).not.toHaveBeenCalled();
    expect(connectFirestoreEmulator).not.toHaveBeenCalled();
    expect(connectFunctionsEmulator).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it.each([
    [true, 'android', 'debug'],
    [false, 'android', 'playIntegrity'],
    [true, 'ios', 'debug'],
    [false, 'ios', 'appAttestWithDeviceCheckFallback'],
  ] as const)('app check provider for __DEV__=%s on %s is %s', (dev, os, expected) => {
    g.__DEV__ = dev;
    Platform.OS = os;
    const { initFirebase } = load();
    initFirebase();
    const opts = (initializeAppCheck as jest.Mock).mock.calls[0][1];
    const cfg = opts.provider.providerOptions;
    expect(os === 'android' ? cfg.android.provider : cfg.apple.provider).toBe(expected);
  });

  it('collects crashlytics only outside __DEV__', () => {
    g.__DEV__ = false;
    load().initFirebase();
    expect(setCrashlyticsCollectionEnabled).toHaveBeenLastCalledWith(expect.anything(), true);
    jest.clearAllMocks();
    g.__DEV__ = true;
    load().initFirebase();
    expect(setCrashlyticsCollectionEnabled).toHaveBeenLastCalledWith(expect.anything(), false);
  });

  it('records app check init failures in crashlytics outside __DEV__', () => {
    g.__DEV__ = false;
    (initializeAppCheck as jest.Mock).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    load().initFirebase();
    expect(recordError).toHaveBeenCalledTimes(1);
  });

  it('does not touch emulators when the switch is off', () => {
    process.env.EXPO_PUBLIC_USE_EMULATOR = '0';
    const { initFirebase } = load();
    initFirebase();
    expect(connectAuthEmulator).not.toHaveBeenCalled();
    expect(connectFirestoreEmulator).not.toHaveBeenCalled();
    expect(connectFunctionsEmulator).not.toHaveBeenCalled();
  });
});

describe('fns', () => {
  it('asks for europe-west1', () => {
    jest.clearAllMocks();
    const { fns } = load();
    fns();
    expect(getFunctions).toHaveBeenCalledWith(expect.anything(), 'europe-west1');
  });
});

describe('setAnalyticsUser', () => {
  // O consentimento vive em services/analytics: carrega-se no mesmo registo de módulos que o firebase.ts.
  function loadBoth() {
    let out!: { fb: FirebaseModule; store: typeof import('expo-secure-store') };
    jest.isolateModules(() => {
      out = { fb: require('@/services/firebase'), store: require('expo-secure-store') };
    });
    return out;
  }

  it('com consentimento envia só o uid, nunca uma propriedade com email', async () => {
    jest.clearAllMocks();
    const { fb, store } = loadBoth();
    await store.setItemAsync('s360.analyticsConsent', 'granted');
    await fb.setAnalyticsUser('abc');
    expect(setUserId).toHaveBeenCalledWith(expect.anything(), 'abc');
    const withAt = (setUserProperty as jest.Mock).mock.calls.filter((c) => String(c[2]).includes('@'));
    expect(withAt).toHaveLength(0);
    await fb.setAnalyticsUser(null);
    expect(setUserId).toHaveBeenLastCalledWith(expect.anything(), null);
  });

  it('sem consentimento não envia o uid, mas limpar com null funciona', async () => {
    jest.clearAllMocks();
    const { fb, store } = loadBoth();
    await store.setItemAsync('s360.analyticsConsent', 'denied');
    await fb.setAnalyticsUser('abc');
    expect(setUserId).not.toHaveBeenCalled();
    await fb.setAnalyticsUser(null);
    expect(setUserId).toHaveBeenLastCalledWith(expect.anything(), null);
  });
});

describe('initFirebase e o consentimento guardado', () => {
  it('aplica a escolha guardada ao arrancar', async () => {
    jest.clearAllMocks();
    let fb!: FirebaseModule;
    let store!: typeof import('expo-secure-store');
    let analytics!: typeof import('@react-native-firebase/analytics');
    jest.isolateModules(() => {
      fb = require('@/services/firebase');
      store = require('expo-secure-store');
      analytics = require('@react-native-firebase/analytics');
    });
    await store.setItemAsync('s360.analyticsConsent', 'granted');
    fb.initFirebase();
    await new Promise((r) => setImmediate(r));
    expect(analytics.setAnalyticsCollectionEnabled).toHaveBeenCalledWith(expect.anything(), true);
  });
});
