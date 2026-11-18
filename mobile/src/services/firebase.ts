import { Platform } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import { connectAuthEmulator, getAuth } from '@react-native-firebase/auth';
import { connectFirestoreEmulator, getFirestore } from '@react-native-firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from '@react-native-firebase/functions';
import {
  getCrashlytics,
  recordError,
  setCrashlyticsCollectionEnabled,
} from '@react-native-firebase/crashlytics';
import { getAnalytics, setUserId } from '@react-native-firebase/analytics';
import {
  initializeAppCheck,
  ReactNativeFirebaseAppCheckProvider,
} from '@react-native-firebase/app-check';

const REGION = 'europe-west1';
const AUTH_PORT = 9099;
const FIRESTORE_PORT = 8080;
const FUNCTIONS_PORT = 5001;

export function emulatorHost(platform: 'ios' | 'android', override?: string): string {
  if (override) return override;
  return platform === 'android' ? '10.0.2.2' : '127.0.0.1';
}

let initialized = false;
let functionsInstance: ReturnType<typeof getFunctions> | null = null;

export function fns() {
  if (!functionsInstance) functionsInstance = getFunctions(getApp(), REGION);
  return functionsInstance;
}

export function db() {
  return getFirestore();
}

export function authInstance() {
  return getAuth();
}

function reportError(e: unknown, context: string): void {
  const err = e instanceof Error ? e : new Error(String(e));
  if (__DEV__) {
    console.warn(`[firebase] ${context}`, err);
    return;
  }
  try {
    recordError(getCrashlytics(), err);
  } catch {
    // nothing else to do
  }
}

function setupAppCheck(): void {
  const provider = new ReactNativeFirebaseAppCheckProvider();
  provider.configure({
    android: { provider: __DEV__ ? 'debug' : 'playIntegrity' },
    apple: { provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback' },
    isTokenAutoRefreshEnabled: true,
  });
  // No enforcement on the backend yet: failures must never block the app.
  try {
    initializeAppCheck(getApp(), { provider, isTokenAutoRefreshEnabled: true });
  } catch (e) {
    reportError(e, 'app-check init failed');
  }
}

export function initFirebase(): void {
  if (initialized) return;
  initialized = true;

  const wantsEmulator = process.env.EXPO_PUBLIC_USE_EMULATOR === '1';
  if (wantsEmulator && !__DEV__) {
    console.warn('[firebase] EXPO_PUBLIC_USE_EMULATOR ignored outside __DEV__');
  }
  if (__DEV__ && wantsEmulator) {
    const os: 'ios' | 'android' = Platform.OS === 'android' ? 'android' : 'ios';
    const host = emulatorHost(os, process.env.EXPO_PUBLIC_EMULATOR_HOST);
    connectAuthEmulator(getAuth(), `http://${host}:${AUTH_PORT}`);
    connectFirestoreEmulator(getFirestore(), host, FIRESTORE_PORT);
    connectFunctionsEmulator(fns(), host, FUNCTIONS_PORT);
  }

  setupAppCheck();
  setCrashlyticsCollectionEnabled(getCrashlytics(), !__DEV__).catch((e) =>
    reportError(e, 'crashlytics collection toggle failed'),
  );
}

/** Only the uid is ever sent to analytics: never email or name. */
export async function setAnalyticsUser(uid: string | null): Promise<void> {
  await setUserId(getAnalytics(), uid);
}
