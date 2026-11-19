import { DEFAULT_NOTIFICATION_PREFS } from '@/lib/profileFields';
import { TOPIC_BY_PREF, routeFromData, topicPlan } from '@/lib/pushTopics';

describe('topicPlan', () => {
  it('tudo ligado', () =>
    expect(topicPlan(DEFAULT_NOTIFICATION_PREFS)).toEqual({
      subscribe: ['push_matchStart', 'push_goals', 'push_mvpOpen', 'push_news'],
      unsubscribe: [],
    }));

  it('golos desligados; o lembrete não é tópico', () => {
    const plan = topicPlan({ ...DEFAULT_NOTIFICATION_PREFS, goals: false, predictionReminder: false });
    expect(plan.unsubscribe).toEqual(['push_goals']);
    expect(plan.subscribe).toEqual(['push_matchStart', 'push_mvpOpen', 'push_news']);
  });

  it('sem sessão: tudo fora', () => {
    expect(topicPlan(null).subscribe).toEqual([]);
    expect(topicPlan(null).unsubscribe).toEqual(['push_matchStart', 'push_goals', 'push_mvpOpen', 'push_news']);
  });

  it('TOPIC_BY_PREF', () =>
    expect(TOPIC_BY_PREF).toEqual({ matchStart: 'push_matchStart', goals: 'push_goals', mvpOpen: 'push_mvpOpen', news: 'push_news' }));
});

describe('routeFromData', () => {
  it.each(['/jogo/9002', '/jogo/9002?tab=mvp', '/jogo/9002?tab=prognostico', '/noticias?id=record-pt-abc', '/noticias?id=a%20b'])(
    'aceita %s',
    (r) => expect(routeFromData({ route: r })).toBe(r),
  );
  it.each([
    'https://evil.pt',
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
