// Consentimento de Analytics (Task 6). A recolha do Firebase Analytics está desligada em firebase.json
// e só liga depois de o utilizador aceitar. A escolha fica no dispositivo (SecureStore), não na conta.
// Só o uid é enviado como identificador, e só com consentimento: nunca email nem nome.
import { getAnalytics, logEvent, setAnalyticsCollectionEnabled, setUserId } from '@react-native-firebase/analytics';
import * as SecureStore from 'expo-secure-store';

export type Consent = 'granted' | 'denied';

const KEY = 's360.analyticsConsent';

// Estado em memória: `consent` é o último valor conhecido (null = ainda não lido ou sem escolha).
let consent: Consent | null = null;
let currentUid: string | null = null;

function isConsent(v: string | null): v is Consent {
  return v === 'granted' || v === 'denied';
}

/** Falha de leitura conta como sem escolha: nunca liga a recolha por causa do armazenamento. */
export async function getAnalyticsConsent(): Promise<Consent | null> {
  try {
    const v = await SecureStore.getItemAsync(KEY);
    return isConsent(v) ? v : null;
  } catch {
    return null;
  }
}

async function applyCollection(next: Consent | null): Promise<void> {
  consent = next;
  await setAnalyticsCollectionEnabled(getAnalytics(), next === 'granted');
  if (next === 'granted' && currentUid) await setUserId(getAnalytics(), currentUid);
}

export async function setAnalyticsConsent(c: Consent): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, c);
  } catch {
    // a escolha vale nesta sessão mesmo que não fique guardada
  }
  await applyCollection(c);
  if (c === 'denied') await setUserId(getAnalytics(), null);
}

/** Arranque: aplica a escolha guardada. Sem escolha, a recolha fica desligada. */
export async function applyStoredConsent(): Promise<void> {
  await applyCollection(await getAnalyticsConsent());
}

/**
 * Identificador do utilizador. `null` (terminar sessão) passa sempre. Um uid só segue com consentimento
 * `granted`; se o consentimento ainda não foi lido, lê-o aqui. Aceitar mais tarde define o uid atual.
 */
export async function setAnalyticsUserId(uid: string | null): Promise<void> {
  currentUid = uid;
  if (uid === null) {
    await setUserId(getAnalytics(), null);
    return;
  }
  if (consent === null) consent = await getAnalyticsConsent();
  if (consent === 'granted' && currentUid === uid) await setUserId(getAnalytics(), uid);
}

/** Evento de utilização. Só com `granted`; nunca lança. */
export function track(name: string, params?: Record<string, string | number>): void {
  if (consent !== 'granted') return;
  try {
    Promise.resolve(logEvent(getAnalytics(), name, params)).catch(() => {});
  } catch {
    // telemetria nunca bloqueia
  }
}
