// Plano 6: depois do login (dentro de (app) e da folha de consentimento), pede a permissão, regista o
// dispositivo e mantém os tópicos FCM iguais às preferências de users/{uid}. O toque abre a rota da notificação.
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useMyUser } from '@/data/hooks';
import { DEFAULT_NOTIFICATION_PREFS } from '@/lib/profileFields';
import {
  onPushOpen,
  onPushTokenRefresh,
  pushPermissionGranted,
  registerDevice,
  requestPushPermission,
  syncTopics,
} from '@/services/push';

export function PushSetup({ uid, ready }: { uid: string; ready: boolean }): null {
  const user = useMyUser(uid);

  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    let registered = false;
    let stopRefresh: (() => void) | null = null;
    const register = async () => {
      registered = true;
      await registerDevice(uid);
      if (alive) stopRefresh = onPushTokenRefresh(uid);
    };
    (async () => {
      const granted = await requestPushPermission();
      if (alive && granted && !registered) await register();
    })();
    // Permissão ligada mais tarde nas definições do telemóvel: regista ao voltar, sem arranque a frio.
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || registered) return;
      pushPermissionGranted().then((granted) => {
        if (alive && granted && !registered) void register();
      });
    });
    return () => {
      alive = false;
      sub.remove();
      stopRefresh?.();
    };
  }, [uid, ready]);

  // Só com o documento lido (ou confirmado inexistente): nunca valores por omissão por um erro de leitura.
  const stored = user.status === 'ready' ? (user.data.notificationPrefs ?? null) : null;
  const prefsKey = user.status === 'ready' || user.status === 'missing' ? JSON.stringify(stored) : null;
  useEffect(() => {
    if (!ready || prefsKey === null) return;
    const prefs = JSON.parse(prefsKey) as typeof stored;
    syncTopics(prefs ?? DEFAULT_NOTIFICATION_PREFS);
  }, [uid, ready, prefsKey]);

  useEffect(() => onPushOpen((route) => router.push(route as Href)), []);

  return null;
}
