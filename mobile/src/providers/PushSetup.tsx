// Plano 6: depois do login (dentro de (app) e da folha de consentimento), pede a permissão, regista o
// dispositivo e mantém os tópicos FCM iguais às preferências de users/{uid}. O toque abre a rota da notificação.
// No Android, com a app aberta, mostra o aviso PushBanner (a rota passa pela mesma lista de rotas aceites).
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { PUSH_BANNER_MS, PushBanner } from '@/components/PushBanner';
import { useMyUser } from '@/data/hooks';
import { DEFAULT_NOTIFICATION_PREFS } from '@/lib/profileFields';
import {
  onPushForeground,
  onPushOpen,
  onPushTokenRefresh,
  pushPermissionGranted,
  registerDevice,
  requestPushPermission,
  syncTopics,
  type ForegroundPush,
} from '@/services/push';

export function PushSetup({ uid, ready }: { uid: string; ready: boolean }) {
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

  // Android com a app aberta: aviso dentro da app (no iOS o sistema já mostra a notificação).
  const [banner, setBanner] = useState<{ push: ForegroundPush; seq: number } | null>(null);
  useEffect(() => {
    let seq = 0;
    return onPushForeground((push) => {
      seq += 1;
      setBanner({ push, seq });
    });
  }, []);
  useEffect(() => {
    if (!banner) return undefined;
    const t = setTimeout(() => setBanner(null), PUSH_BANNER_MS);
    return () => clearTimeout(t);
  }, [banner]);

  if (!banner) return null;
  return (
    <PushBanner
      push={banner.push}
      onPress={() => {
        const route = banner.push.route;
        setBanner(null);
        if (route) router.push(route as Href);
      }}
    />
  );
}
