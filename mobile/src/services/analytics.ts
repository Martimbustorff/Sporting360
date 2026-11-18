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
// Task 17: até a escolha guardada ser aplicada (arranque a frio, por exemplo ao abrir o link partilhado), os eventos
// esperam aqui. Aplicada: `granted` envia-os, `denied` ou sem escolha descarta-os. Limite para nunca crescer.
let settled = false;
const MAX_PENDING = 20;
let pending: { name: string; params?: Record<string, string | number> }[] = [];
// Task 26: o interruptor das Definições pode mudar depressa. As escolhas aplicam-se uma de cada vez, pela ordem.
let queue: Promise<void> = Promise.resolve();

function serial(fn: () => Promise<void>): Promise<void> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

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
  if (consent === 'granted' && currentUid) await setUserId(getAnalytics(), currentUid);
  settled = true;
  const queued = pending;
  pending = [];
  if (consent === 'granted') for (const e of queued) send(e.name, e.params);
}

function send(name: string, params?: Record<string, string | number>): void {
  try {
    Promise.resolve(logEvent(getAnalytics(), name, params)).catch(() => {});
  } catch {
    // telemetria nunca bloqueia
  }
}

export function setAnalyticsConsent(c: Consent): Promise<void> {
  // Já em memória: um início de sessão a meio desta escolha nunca envia o uid depois de um "denied".
  consent = c;
  return serial(async () => {
    try {
      await SecureStore.setItemAsync(KEY, c);
    } catch {
      // a escolha vale nesta sessão mesmo que não fique guardada
    }
    if (c === 'granted') {
      await applyCollection(c);
      return;
    }
    // Recusar limpa sempre o uid, mesmo que desligar a recolha falhe.
    try {
      await applyCollection(c);
    } finally {
      await setUserId(getAnalytics(), null);
    }
  });
}

/** Arranque: aplica a escolha guardada. Sem escolha, a recolha fica desligada. */
export function applyStoredConsent(): Promise<void> {
  return serial(async () => applyCollection(await getAnalyticsConsent()));
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
  if (consent === null) {
    const stored = await getAnalyticsConsent();
    // Uma escolha feita durante a leitura vale mais do que o valor lido (que pode já estar desatualizado).
    if (consent === null) consent = stored;
  }
  if (consent === 'granted' && currentUid === uid) await setUserId(getAnalytics(), uid);
}

/**
 * Evento de utilização. Só com `granted`; nunca lança. Antes de a escolha guardada ser aplicada o evento fica em
 * espera (ver `pending`) em vez de se perder.
 */
export function track(name: string, params?: Record<string, string | number>): void {
  if (!settled) {
    if (pending.length < MAX_PENDING) pending.push({ name, params });
    return;
  }
  if (consent === 'granted') send(name, params);
}
