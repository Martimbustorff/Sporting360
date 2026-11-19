// Plano 6: tópicos FCM por preferência e validação da rota que chega na notificação.
import type { NotificationPrefs } from '@/data/schemas';

export type PushTopic = 'push_matchStart' | 'push_goals' | 'push_mvpOpen' | 'push_news';

/** Preferências que são tópicos. O lembrete de prognóstico não é tópico: vai por dispositivo. */
export const TOPIC_BY_PREF: Record<'matchStart' | 'goals' | 'mvpOpen' | 'news', PushTopic> = {
  matchStart: 'push_matchStart',
  goals: 'push_goals',
  mvpOpen: 'push_mvpOpen',
  news: 'push_news',
};

const PREF_KEYS = Object.keys(TOPIC_BY_PREF) as (keyof typeof TOPIC_BY_PREF)[];

/** O que subscrever e tirar para seguir as preferências. `null` (sem sessão): tudo fora. */
export function topicPlan(prefs: NotificationPrefs | null): { subscribe: PushTopic[]; unsubscribe: PushTopic[] } {
  const subscribe: PushTopic[] = [];
  const unsubscribe: PushTopic[] = [];
  for (const key of PREF_KEYS) (prefs?.[key] === true ? subscribe : unsubscribe).push(TOPIC_BY_PREF[key]);
  return { subscribe, unsubscribe };
}

const ROUTES = [
  /^\/jogo\/[A-Za-z0-9_-]+$/,
  /^\/jogo\/[A-Za-z0-9_-]+\?tab=(mvp|prognostico)$/,
  /^\/noticias\?id=[A-Za-z0-9%._~-]+$/,
];

/** Rota de `data.route`, só nas formas que o servidor envia; tudo o resto `null` (nunca abre outro ecrã). */
export function routeFromData(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const route = (data as { route?: unknown }).route;
  if (typeof route !== 'string') return null;
  return ROUTES.some((re) => re.test(route)) ? route : null;
}
