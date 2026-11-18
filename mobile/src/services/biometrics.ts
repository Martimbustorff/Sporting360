import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// 'error' = leitura nativa falhou (transitório): nunca desliga a opção.
export type BiometricStatus = 'available' | 'notEnrolled' | 'noHardware' | 'error';
export type BiometricLabel = 'Face ID' | 'Touch ID' | 'impressão digital' | 'biometria';

const enabledKey = (uid: string) => `s360.biometric.${uid}`;
const answeredKey = (uid: string) => `s360.biometric.asked.${uid}`;

export async function biometricStatus(): Promise<BiometricStatus> {
  try {
    if (!(await LocalAuthentication.hasHardwareAsync())) return 'noHardware';
    if (!(await LocalAuthentication.isEnrolledAsync())) return 'notEnrolled';
    return 'available';
  } catch {
    return 'error';
  }
}

export async function biometricLabel(): Promise<BiometricLabel> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const { FACIAL_RECOGNITION, FINGERPRINT } = LocalAuthentication.AuthenticationType;
    if (Platform.OS === 'ios') {
      if (types.includes(FACIAL_RECOGNITION)) return 'Face ID';
      if (types.includes(FINGERPRINT)) return 'Touch ID';
    } else if (types.includes(FINGERPRINT)) {
      return 'impressão digital';
    }
  } catch {
    // cai no rótulo genérico
  }
  return 'biometria';
}

/** Falha de leitura conta como desligado: nunca bloqueia o utilizador por causa do armazenamento. */
export async function isBiometricEnabled(uid: string): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(enabledKey(uid))) === '1';
  } catch {
    return false;
  }
}

export async function setBiometricEnabled(uid: string, on: boolean): Promise<void> {
  if (on) await SecureStore.setItemAsync(enabledKey(uid), '1');
  else await SecureStore.deleteItemAsync(enabledKey(uid));
}

/** Estado "já respondeu à pergunta Ativar?" por uid. Com falha de leitura assume-se respondido (não insistir). */
export async function hasBiometricPromptAnswered(uid: string): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(answeredKey(uid))) === '1';
  } catch {
    return true;
  }
}

export async function setBiometricPromptAnswered(uid: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(answeredKey(uid), '1');
  } catch {
    // sem armazenamento: a pergunta pode repetir-se, nada a fazer
  }
}

export async function unlock(): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Desbloquear a S360',
      cancelLabel: 'Cancelar',
      disableDeviceFallback: false,
    });
    return r.success;
  } catch {
    return false;
  }
}
