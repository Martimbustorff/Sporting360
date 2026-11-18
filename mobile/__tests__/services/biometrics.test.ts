import { Platform } from 'react-native';
import * as LA from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import {
  biometricLabel,
  biometricStatus,
  hasBiometricPromptAnswered,
  isBiometricEnabled,
  setBiometricEnabled,
  setBiometricPromptAnswered,
  unlock,
} from '@/services/biometrics';

const la = LA as unknown as Record<"hasHardwareAsync" | "isEnrolledAsync" | "supportedAuthenticationTypesAsync" | "authenticateAsync", jest.Mock>;
const ss = SecureStore as unknown as { __reset: () => void };
const setOS = (os: 'ios' | 'android') => Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });

beforeEach(() => {
  jest.clearAllMocks();
  ss.__reset();
  setOS('ios');
  la.hasHardwareAsync.mockResolvedValue(true);
  la.isEnrolledAsync.mockResolvedValue(true);
  la.supportedAuthenticationTypesAsync.mockResolvedValue([2]);
  la.authenticateAsync.mockResolvedValue({ success: true });
});

describe('biometricStatus', () => {
  it('available', async () => expect(await biometricStatus()).toBe('available'));
  it('noHardware', async () => {
    la.hasHardwareAsync.mockResolvedValue(false);
    expect(await biometricStatus()).toBe('noHardware');
  });
  it('notEnrolled', async () => {
    la.isEnrolledAsync.mockResolvedValue(false);
    expect(await biometricStatus()).toBe('notEnrolled');
  });
  it('native failure degrades to noHardware', async () => {
    la.hasHardwareAsync.mockRejectedValue(new Error('x'));
    expect(await biometricStatus()).toBe('noHardware');
  });
});

describe('biometricLabel', () => {
  it('iOS face', async () => expect(await biometricLabel()).toBe('Face ID'));
  it('iOS fingerprint', async () => {
    la.supportedAuthenticationTypesAsync.mockResolvedValue([1]);
    expect(await biometricLabel()).toBe('Touch ID');
  });
  it('Android fingerprint', async () => {
    setOS('android');
    la.supportedAuthenticationTypesAsync.mockResolvedValue([1]);
    expect(await biometricLabel()).toBe('impressão digital');
  });
  it('Android face falls back to generic', async () => {
    setOS('android');
    expect(await biometricLabel()).toBe('biometria');
  });
  it('unknown', async () => {
    la.supportedAuthenticationTypesAsync.mockResolvedValue([]);
    expect(await biometricLabel()).toBe('biometria');
  });
});

describe('storage', () => {
  it('enabled flag is per uid under s360.biometric.<uid>', async () => {
    expect(await isBiometricEnabled('u1')).toBe(false);
    await setBiometricEnabled('u1', true);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('s360.biometric.u1', '1');
    expect(await isBiometricEnabled('u1')).toBe(true);
    expect(await isBiometricEnabled('u2')).toBe(false);
    await setBiometricEnabled('u1', false);
    expect(await isBiometricEnabled('u1')).toBe(false);
  });
  it('prompt answer is per uid and independent of the flag', async () => {
    expect(await hasBiometricPromptAnswered('u1')).toBe(false);
    await setBiometricPromptAnswered('u1');
    expect(await hasBiometricPromptAnswered('u1')).toBe(true);
    expect(await hasBiometricPromptAnswered('u2')).toBe(false);
    expect(await isBiometricEnabled('u1')).toBe(false);
  });
  it('storage failure reads as off and never nags with the prompt', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('x'));
    expect(await isBiometricEnabled('u1')).toBe(false);
    expect(await hasBiometricPromptAnswered('u1')).toBe(true);
  });
});

describe('unlock', () => {
  it('passes the exact options', async () => {
    expect(await unlock()).toBe(true);
    expect(la.authenticateAsync).toHaveBeenCalledWith({
      promptMessage: 'Desbloquear a S360',
      cancelLabel: 'Cancelar',
      disableDeviceFallback: false,
    });
  });
  it('false on cancel or error', async () => {
    la.authenticateAsync.mockResolvedValue({ success: false });
    expect(await unlock()).toBe(false);
    la.authenticateAsync.mockRejectedValue(new Error('x'));
    expect(await unlock()).toBe(false);
  });
});
