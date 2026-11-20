import { celebrationScorer, nextGoalWatch } from '@/lib/goalCelebration';
import type { EventItem, Match } from '@/data/schemas';

const m = (over: Partial<Match> = {}): Match =>
  ({
    id: 'g1',
    status: 'LIVE',
    sportingSide: 'home',
    home: { id: '228', name: 'Sporting CP', logo: null },
    away: { id: '212', name: 'FC Porto', logo: null },
    score: { home: 1, away: 0, halftime: null, extratime: null, penalty: null },
    ...over,
  }) as Match;
const score = (home: number, away: number) => ({ home, away, halftime: null, extratime: null, penalty: null });

describe('nextGoalWatch', () => {
  it('a primeira leitura só guarda o resultado (abrir a app a meio do jogo não celebra)', () => {
    expect(nextGoalWatch(null, m())).toEqual({ watch: { id: 'g1', goals: 1 }, goal: false });
  });
  it('golo do Sporting ao vivo: celebra', () => {
    expect(nextGoalWatch({ id: 'g1', goals: 1 }, m({ score: score(2, 0) }))).toEqual({ watch: { id: 'g1', goals: 2 }, goal: true });
  });
  it('Sporting fora: conta os golos de fora', () => {
    const away = m({ sportingSide: 'away', score: score(0, 1) });
    expect(nextGoalWatch({ id: 'g1', goals: 0 }, away).goal).toBe(true);
  });
  it('golo do adversário: não celebra', () => {
    expect(nextGoalWatch({ id: 'g1', goals: 1 }, m({ score: score(1, 1) })).goal).toBe(false);
  });
  it('golo anulado (o resultado desce): não celebra e baixa a referência', () => {
    expect(nextGoalWatch({ id: 'g1', goals: 2 }, m())).toEqual({ watch: { id: 'g1', goals: 1 }, goal: false });
  });
  it('outro jogo: só guarda', () => {
    expect(nextGoalWatch({ id: 'g0', goals: 0 }, m({ score: score(3, 0) })).goal).toBe(false);
  });
  it('fora de jogo ao vivo (intervalo, terminado): não celebra', () => {
    expect(nextGoalWatch({ id: 'g1', goals: 1 }, m({ status: 'HT', score: score(2, 0) })).goal).toBe(false);
    expect(nextGoalWatch({ id: 'g1', goals: 1 }, m({ status: 'FT', score: score(2, 0) })).goal).toBe(false);
  });
  it('sem jogo: esquece', () => {
    expect(nextGoalWatch({ id: 'g1', goals: 1 }, null)).toEqual({ watch: null, goal: false });
  });
});

describe('celebrationScorer', () => {
  const goal = (minute: number, teamId: string, playerName: string): EventItem =>
    ({ minute, extra: null, teamId, playerId: '1', playerName, assistId: null, assistName: null, type: 'goal', detail: 'Normal Goal', comments: null }) as EventItem;

  it('o último golo do Sporting quando os lances já chegaram', () => {
    expect(celebrationScorer(m({ score: score(2, 1) }), [goal(23, '228', 'L. Suárez'), goal(38, '212', 'Samu'), goal(54, '228', 'Trincão')])).toBe('Trincão 54’');
  });
  it('lances ainda atrasados (menos golos do que o resultado): sem marcador', () => {
    expect(celebrationScorer(m({ score: score(2, 0) }), [goal(23, '228', 'L. Suárez')])).toBeNull();
  });
});
