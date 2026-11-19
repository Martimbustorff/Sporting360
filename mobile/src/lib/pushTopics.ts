// Plano 6: tópicos FCM por preferência e validação da rota que chega na notificação.
import type { NotificationPrefs } from '@/data/schemas';

export type PushTopic = 'push_mvpOpen';

/** Tópicos que já não existem no servidor (início, golos, notícias). Tirados sempre, para limpar telemóveis que os subscreveram em builds de teste. */
export const RETIRED_TOPICS = ['push_matchStart', 'push_goals', 'push_news'] as const;

/** Preferências que são tópicos. O lembrete de prognóstico não é tópico: vai por dispositivo. */
export const TOPIC_BY_PREF: Record<'mvpOpen', PushTopic> = {
  mvpOpen: 'push_mvpOpen',
};

/** O que subscrever e tirar para seguir as preferências. `null` (sem sessão): tudo fora. Os tópicos antigos saem sempre. */
export function topicPlan(prefs: NotificationPrefs | null): { subscribe: PushTopic[]; unsubscribe: (PushTopic | (typeof RETIRED_TOPICS)[number])[] } {
  const subscribe: PushTopic[] = [];
  const unsubscribe: (PushTopic | (typeof RETIRED_TOPICS)[number])[] = [];
  (prefs?.mvpOpen === true ? subscribe : unsubscribe).push(TOPIC_BY_PREF.mvpOpen);
  unsubscribe.push(...RETIRED_TOPICS);
  return { subscribe, unsubscribe };
}

const ROUTES = [/^\/jogo\/[A-Za-z0-9_-]+\?tab=(mvp|prognostico)$/];

/** Rota de `data.route`, só nas formas que o servidor envia; tudo o resto `null` (nunca abre outro ecrã). */
export function routeFromData(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const route = (data as { route?: unknown }).route;
  if (typeof route !== 'string') return null;
  return ROUTES.some((re) => re.test(route)) ? route : null;
}
