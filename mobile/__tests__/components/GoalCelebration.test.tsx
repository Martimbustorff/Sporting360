// Plano 10 · Figma 55: celebração do golo do Sporting.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState } from 'react-native';
import type { Match } from '@/data/schemas';

type L = { status: 'loading' } | { status: 'ready'; data: unknown };
const mockMatches: { current: L } = { current: { status: 'loading' } };
const mockEvents: { current: L } = { current: { status: 'loading' } };
jest.mock('@/data/sports', () => ({
  useHomeMatches: jest.fn(() => mockMatches.current),
  useMatchDetail: jest.fn(() => mockEvents.current),
}));
jest.mock('@/data/clock', () => ({ useNow: () => new Date('2026-12-21T21:10:00Z') }));
const mockGoal = jest.fn();
jest.mock('@/lib/haptics', () => ({ haptic: { goal: () => mockGoal() } }));

import { GoalCelebration } from '@/components/GoalCelebration';

const game = (home: number, away: number, status = 'LIVE'): Match =>
  ({
    id: 'g1',
    sport: 'football',
    status,
    kickoff: new Date('2026-12-21T20:30:00Z'),
    finishedAt: null,
    sportingSide: 'home',
    home: { id: '228', name: 'Sporting', logo: null },
    away: { id: '212', name: 'FC Porto', logo: null },
    score: { home, away, halftime: null, extratime: null, penalty: null },
  }) as unknown as Match;
const feed = (m: Match) => (mockMatches.current = { status: 'ready', data: [m] });

beforeEach(() => {
  jest.useFakeTimers();
  mockGoal.mockClear();
  mockEvents.current = { status: 'loading' };
});
afterEach(() => jest.useRealTimers());

describe('GoalCelebration', () => {
  it('abrir a app a meio do jogo não celebra', async () => {
    feed(game(1, 0));
    await render(<GoalCelebration />);
    expect(screen.queryByTestId('goal-celebration')).toBeNull();
    expect(mockGoal).not.toHaveBeenCalled();
  });

  it('golo do Sporting: "GOLO!", resultado e vibração tripla; fecha sozinho ao fim de 2 s', async () => {
    feed(game(1, 0));
    const r = await render(<GoalCelebration />);
    feed(game(2, 1));
    await r.rerender(<GoalCelebration />);
    expect(screen.getByText('Golo!')).toBeTruthy();
    expect(screen.getByText('Sporting 2 - 1 FC Porto')).toBeTruthy();
    expect(mockGoal).toHaveBeenCalledTimes(1);
    await act(() => jest.advanceTimersByTime(2000));
    expect(screen.queryByTestId('goal-celebration')).toBeNull();
  });

  it('mostra o marcador quando os lances já chegaram', async () => {
    feed(game(0, 0));
    const r = await render(<GoalCelebration />);
    mockEvents.current = {
      status: 'ready',
      data: { items: [{ minute: 54, extra: null, teamId: '228', playerId: '9', playerName: 'Trincão', assistId: null, assistName: null, type: 'goal', detail: 'Normal Goal', comments: null }] },
    };
    feed(game(1, 0));
    await r.rerender(<GoalCelebration />);
    expect(screen.getByText('Trincão 54’')).toBeTruthy();
  });

  it('um toque fecha', async () => {
    feed(game(0, 0));
    const r = await render(<GoalCelebration />);
    feed(game(1, 0));
    await r.rerender(<GoalCelebration />);
    await fireEvent.press(screen.getByLabelText('Fechar'));
    expect(screen.queryByTestId('goal-celebration')).toBeNull();
  });

  it('golo do adversário: nada', async () => {
    feed(game(1, 0));
    const r = await render(<GoalCelebration />);
    feed(game(1, 1));
    await r.rerender(<GoalCelebration />);
    expect(screen.queryByTestId('goal-celebration')).toBeNull();
  });

  it('voltar do segundo plano com mais golos: não celebra golos que já passaram', async () => {
    const listeners: ((s: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, fn) => {
      listeners.push(fn as (s: string) => void);
      return { remove: jest.fn() } as never;
    });
    feed(game(0, 0));
    const r = await render(<GoalCelebration />);
    await act(() => listeners.forEach((l) => l('background')));
    feed(game(2, 0));
    await r.rerender(<GoalCelebration />);
    expect(screen.queryByTestId('goal-celebration')).toBeNull();
  });
});
