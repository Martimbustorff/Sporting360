// Jogo no ecrã de bloqueio (Plano 10, ponto 2; só iPhone). A app:
// - regista o token de "push-to-start" (iOS 17.2+) em users/{uid}/liveActivityDevices/{token FCM}, com a pasta
//   partilhada onde guarda os emblemas; o servidor arranca a atividade ao apito inicial;
// - regista o token de cada atividade em users/{uid}/liveActivities/{id}, para o servidor a atualizar e terminar;
// - guarda os emblemas do próximo jogo na pasta partilhada (a extensão não vai à rede);
// - arranca a atividade sozinha se o jogo já vai a meio e não há nenhuma (app aberta depois do apito, iOS 16.1 a 17.1).
// Erros só com reportCode: nunca o token nem o uid.
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { addPushToStartTokenListener, widgetsDirectory } from 'expo-widgets';
import { getMessaging, getToken } from '@react-native-firebase/messaging';
import { deleteDoc, doc, serverTimestamp, setDoc } from '@react-native-firebase/firestore';
import { Platform } from 'react-native';
import type { EventItem, Match } from '@/data/schemas';
import { CREST_FILE, matchActivityProps } from '@/lib/matchActivity';
import { reportCode } from '@/lib/report';
import { db } from '@/services/firebase';
import MatchActivity from '../../widgets/MatchActivity';

const SPORTING_CREST = require('../../assets/images/sporting-cp-2026.png') as number;
/** Com o jogo há menos disto a decorrer, a atividade vem pelo servidor; depois, a app arranca-a se faltar. */
export const LOCAL_START_AFTER_MIN = 3;

export const liveActivitySupported = (): boolean => Platform.OS === 'ios' && Number.parseFloat(String(Platform.Version)) >= 16.1;

/** Pasta partilhada sem a barra final (o servidor junta "/crest_X.png"). */
export function sharedDir(): string | null {
  const d = widgetsDirectory;
  return d ? d.replace(/\/+$/, '') : null;
}

async function fcmToken(): Promise<string | null> {
  try {
    return (await getToken(getMessaging())) || null;
  } catch {
    return null;
  }
}

/** Ouve o token de "push-to-start" e grava-o (é emitido ao subscrever e sempre que o iOS o troca). */
export function watchPushToStart(uid: string): () => void {
  if (!liveActivitySupported()) return () => undefined;
  try {
    const sub = addPushToStartTokenListener(({ activityPushToStartToken }) => {
      void (async () => {
        const token = await fcmToken();
        if (!token || !activityPushToStartToken) return;
        await setDoc(doc(db(), `users/${uid}/liveActivityDevices/${token}`), {
          fcmToken: token,
          pushToStartToken: activityPushToStartToken,
          dir: sharedDir(),
          updatedAt: serverTimestamp(),
        });
      })().catch((e) => reportCode('liveActivity.pushToStart', e));
    });
    return () => sub.remove();
  } catch (e) {
    reportCode('liveActivity.pushToStart', e);
    return () => undefined;
  }
}

/** Atividades em curso: grava o token de cada uma para o jogo `matchId` (só há um jogo do Sporting de cada vez). */
export function watchActivities(uid: string, matchId: string): () => void {
  if (!liveActivitySupported()) return () => undefined;
  const subs: { remove: () => void }[] = [];
  try {
    for (const activity of MatchActivity.getInstances()) {
      const save = (activityToken: string) =>
        void (async () => {
          const token = await fcmToken();
          if (!token) return;
          await setDoc(doc(db(), `users/${uid}/liveActivities/${activity.getId()}`), {
            matchId,
            activityToken,
            fcmToken: token,
            dir: sharedDir(),
            updatedAt: serverTimestamp(),
          });
        })().catch((e) => reportCode('liveActivity.token', e));
      subs.push(activity.addPushTokenListener(({ pushToken }) => save(pushToken)));
      void activity.getPushToken().then((t) => (t ? save(t) : undefined));
    }
  } catch (e) {
    reportCode('liveActivity.token', e);
  }
  return () => subs.forEach((s) => s.remove());
}

/** Emblemas do jogo na pasta partilhada: o do Sporting vem da app; o adversário é descarregado uma vez. */
export async function cacheCrests(match: Match): Promise<void> {
  const dir = sharedDir();
  if (!liveActivitySupported() || !dir) return;
  try {
    for (const side of ['home', 'away'] as const) {
      const team = match[side];
      const target = new File(dir, CREST_FILE(team.id));
      if (target.exists) continue;
      if (side === match.sportingSide) {
        const asset = await Asset.fromModule(SPORTING_CREST).downloadAsync();
        if (asset.localUri) new File(asset.localUri).copy(target);
      } else if (team.logo) {
        await File.downloadFileAsync(team.logo, target, { idempotent: true });
      }
    }
  } catch (e) {
    reportCode('liveActivity.crests', e);
  }
}

/** Arranca a atividade na app quando o jogo já vai a meio e não há nenhuma. Devolve true se arrancou. */
export function startIfMissing(match: Match, events: EventItem[], now: Date): boolean {
  if (!liveActivitySupported() || match.sport !== 'football') return false;
  if (match.status !== 'LIVE' && match.status !== 'HT') return false;
  if ((match.elapsed ?? 0) < LOCAL_START_AFTER_MIN) return false;
  try {
    if (MatchActivity.getInstances().length > 0) return false;
    MatchActivity.start(matchActivityProps(match, events, now, sharedDir()), `s360://jogo/${match.id}`);
    return true;
  } catch (e) {
    reportCode('liveActivity.start', e);
    return false;
  }
}

/** Ao sair da conta: o servidor deixa de arrancar a atividade neste telemóvel. */
export async function unregisterLiveActivity(uid: string): Promise<void> {
  if (!liveActivitySupported()) return;
  try {
    const token = await fcmToken();
    if (token) await deleteDoc(doc(db(), `users/${uid}/liveActivityDevices/${token}`));
  } catch (e) {
    reportCode('liveActivity.unregister', e);
  }
}
