import { Platform } from 'react-native';
import { connectAuthEmulator } from '@react-native-firebase/auth';
import { connectFirestoreEmulator } from '@react-native-firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from '@react-native-firebase/functions';
import { setUserId, setUserProperty } from '@react-native-firebase/analytics';
import { initializeAppCheck } from '@react-native-firebase/app-check';

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
  it('sets only the uid, never an email-like property', async () => {
    jest.clearAllMocks();
    const { setAnalyticsUser } = load();
    await setAnalyticsUser('abc');
    expect(setUserId).toHaveBeenCalledWith(expect.anything(), 'abc');
    const withAt = (setUserProperty as jest.Mock).mock.calls.filter((c) => String(c[2]).includes('@'));
    expect(withAt).toHaveLength(0);
    await setAnalyticsUser(null);
    expect(setUserId).toHaveBeenLastCalledWith(expect.anything(), null);
  });
});
