import { getCrashlytics, recordError } from '@react-native-firebase/crashlytics';

export function codeOf(e: unknown): string | undefined {
  return typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : undefined;
}

/** Crashlytics só recebe a etiqueta e o código do erro: nunca a mensagem (pode conter email), tokens ou nonces. */
export function reportCode(tag: string, e: unknown): void {
  const code = (codeOf(e) ?? 'unknown').replace(/[^\w/.-]/g, '').slice(0, 64) || 'unknown';
  try {
    recordError(getCrashlytics(), new Error(`${tag} ${code}`));
  } catch {
    // nada mais a fazer
  }
}
