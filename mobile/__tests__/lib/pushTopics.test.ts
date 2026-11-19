import { DEFAULT_NOTIFICATION_PREFS } from '@/lib/profileFields';
import { RETIRED_TOPICS, TOPIC_BY_PREF, routeFromData, topicPlan } from '@/lib/pushTopics';

const RETIRED = ['push_matchStart', 'push_goals', 'push_news'];

describe('topicPlan', () => {
  it('tudo ligado: só o MVP subscrito, os três antigos sempre fora', () =>
    expect(topicPlan(DEFAULT_NOTIFICATION_PREFS)).toEqual({
      subscribe: ['push_mvpOpen'],
      unsubscribe: RETIRED,
    }));

  it('mesmo com as chaves antigas a true, os três tópicos antigos saem sempre', () => {
    const plan = topicPlan({ ...DEFAULT_NOTIFICATION_PREFS, matchStart: true, goals: true, news: true });
    expect(plan.subscribe).toEqual(['push_mvpOpen']);
    expect(plan.unsubscribe).toEqual(expect.arrayContaining(RETIRED));
    expect(plan.unsubscribe).not.toContain('push_mvpOpen');
  });

  it('MVP desligado: sai também o MVP; o lembrete não é tópico', () => {
    const plan = topicPlan({ ...DEFAULT_NOTIFICATION_PREFS, mvpOpen: false, predictionReminder: false });
    expect(plan.subscribe).toEqual([]);
    expect(plan.unsubscribe).toEqual(['push_mvpOpen', ...RETIRED]);
  });

  it('sem sessão: tudo fora', () => {
    expect(topicPlan(null).subscribe).toEqual([]);
    expect(topicPlan(null).unsubscribe).toEqual(['push_mvpOpen', ...RETIRED]);
  });

  it('TOPIC_BY_PREF e RETIRED_TOPICS', () => {
    expect(TOPIC_BY_PREF).toEqual({ mvpOpen: 'push_mvpOpen' });
    expect(RETIRED_TOPICS).toEqual(RETIRED);
  });
});

describe('routeFromData', () => {
  it.each(['/jogo/9002?tab=mvp', '/jogo/9002?tab=prognostico'])(
    'aceita %s',
    (r) => expect(routeFromData({ route: r })).toBe(r),
  );
  it.each([
    'https://evil.pt',
    '/jogo/9002',
    '/noticias?id=record-pt-abc',
    '/noticias?id=a%20b',
    '/jogo/9002?tab=x',
    '/definicoes',
    '/jogo/../apagar-conta',
    '/jogo/9002/../../apagar-conta',
    '/jogo/9002?tab=mvp&x=1',
    '/noticias?id=a/b',
    '/noticias',
    '//evil.pt/jogo/1',
    '',
    undefined,
  ])('recusa %s', (r) => expect(routeFromData({ route: r })).toBeNull());
  it('recusa dados que não são objeto', () => {
    expect(routeFromData(null)).toBeNull();
    expect(routeFromData('/jogo/1')).toBeNull();
    expect(routeFromData({ route: 5 })).toBeNull();
  });
});
