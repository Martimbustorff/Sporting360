// Plano 6: permissão, token do dispositivo, tópicos e toque na notificação (RNFirebase messaging).
// Erros só com reportCode: nunca o token nem o uid.
import { PermissionsAndroid, Platform } from 'react-native';
import {
  AuthorizationStatus,
  getInitialNotification,
  getMessaging,
  getToken,
  hasPermission,
  onNotificationOpenedApp,
  onTokenRefresh,
  requestPermission,
  subscribeToTopic,
  unsubscribeFromTopic,
} from '@react-native-firebase/messaging';
import { deleteDoc, doc, serverTimestamp, setDoc } from '@react-native-firebase/firestore';
import type { NotificationPrefs } from '@/data/schemas';
import { routeFromData, topicPlan } from '@/lib/pushTopics';
import { reportCode } from '@/lib/report';
import { db } from '@/services/firebase';

/** Limite de cada passo do desregisto ao sair: offline, sair nunca fica preso. */
export const PUSH_UNREGISTER_TIMEOUT_MS = 4000;

const ANDROID_RUNTIME_PERMISSION = 33;

let lastToken: string | null = null;
let initialHandled = false;

const messaging = () => getMessaging();

const granted = (s: number) => s === AuthorizationStatus.AUTHORIZED || s === AuthorizationStatus.PROVISIONAL;

function androidNeedsPermission(): boolean {
  return Platform.OS === 'android' && Number(Platform.Version) >= ANDROID_RUNTIME_PERMISSION;
}

function withTimeout<T>(p: Promise<T>, ms = PUSH_UNREGISTER_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'timeout' })), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** Pede a permissão (iOS: alerta do sistema; Android 13+: POST_NOTIFICATIONS). Só depois do login. */
export async function requestPushPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      if (!androidNeedsPermission()) return true;
      // O requestPermission do RNFB devolve sempre AUTHORIZED no Android: a permissão real é esta.
      const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      return r === PermissionsAndroid.RESULTS.GRANTED;
    }
    return granted(await requestPermission(messaging()));
  } catch (e) {
    reportCode('push.permission', e);
    return false;
  }
}

/** Estado atual da permissão, sem pedir nada. */
export async function pushPermissionGranted(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      if (!androidNeedsPermission()) return true;
      return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
    return granted(await hasPermission(messaging()));
  } catch (e) {
    reportCode('push.hasPermission', e);
    return false;
  }
}

function platform(): 'ios' | 'android' {
  return Platform.OS === 'android' ? 'android' : 'ios';
}

async function saveDevice(uid: string, token: string): Promise<void> {
  await setDoc(
    doc(db(), `users/${uid}/devices/${token}`),
    { token, platform: platform(), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/** Grava `users/{uid}/devices/{token}` (para o lembrete de prognóstico). Devolve o token ou null. */
export async function registerDevice(uid: string): Promise<string | null> {
  try {
    const token = await getToken(messaging());
    if (!token) return null;
    lastToken = token;
    await saveDevice(uid, token);
    return token;
  } catch (e) {
    reportCode('push.register', e);
    return null;
  }
}

/** Token novo do FCM: grava-o para o mesmo utilizador. */
export function onPushTokenRefresh(uid: string): () => void {
  try {
    return onTokenRefresh(messaging(), (token: string) => {
      lastToken = token;
      saveDevice(uid, token).catch((e) => reportCode('push.refresh', e));
    });
  } catch (e) {
    reportCode('push.refresh', e);
    return () => undefined;
  }
}

/** Subscreve e tira os tópicos para seguir as preferências. Nunca lança. */
export async function syncTopics(prefs: NotificationPrefs | null): Promise<void> {
  const plan = topicPlan(prefs);
  let m: ReturnType<typeof getMessaging>;
  try {
    m = messaging();
  } catch (e) {
    reportCode('push.topic', e);
    return;
  }
  const results = await Promise.allSettled([
    ...plan.subscribe.map((t) => subscribeToTopic(m, t)),
    ...plan.unsubscribe.map((t) => unsubscribeFromTopic(m, t)),
  ]);
  for (const r of results) if (r.status === 'rejected') reportCode('push.topic', r.reason);
}

/** Ao sair: tira os 4 tópicos e apaga o dispositivo deste utilizador. Nunca lança nem fica preso. */
export async function unregisterPush(uid: string): Promise<void> {
  let m: ReturnType<typeof getMessaging>;
  try {
    m = messaging();
  } catch (e) {
    reportCode('push.unregister', e);
    lastToken = null;
    return;
  }
  const topics = topicPlan(null).unsubscribe.map((t) =>
    withTimeout(unsubscribeFromTopic(m, t)).catch((e) => reportCode('push.unsubscribe', e)),
  );
  const device = (async () => {
    try {
      const token = lastToken ?? (await withTimeout(getToken(m)));
      if (token) await withTimeout(deleteDoc(doc(db(), `users/${uid}/devices/${token}`)));
    } catch (e) {
      reportCode('push.unregister', e);
    }
  })();
  await Promise.all([...topics, device]);
  lastToken = null;
}

/**
 * Toque na notificação: com a app em segundo plano (`onNotificationOpenedApp`) ou fechada
 * (`getInitialNotification`, tratado uma vez por processo). Só rotas validadas chegam ao handler.
 */
export function onPushOpen(handler: (route: string) => void): () => void {
  const open = (msg: unknown) => {
    const route = routeFromData((msg as { data?: unknown } | null | undefined)?.data);
    if (route) handler(route);
  };
  // Uma falha do módulo nativo nunca derruba a árvore de (app): sem ouvinte, o toque só abre a app.
  try {
    const m = messaging();
    const unsubscribe = onNotificationOpenedApp(m, open);
    if (!initialHandled) {
      initialHandled = true;
      getInitialNotification(m)
        .then(open)
        .catch((e) => reportCode('push.initial', e));
    }
    return unsubscribe;
  } catch (e) {
    reportCode('push.open', e);
    return () => undefined;
  }
}

/** Só para testes: volta ao estado de um processo novo. */
export function resetPushForTests(): void {
  lastToken = null;
  initialHandled = false;
}
