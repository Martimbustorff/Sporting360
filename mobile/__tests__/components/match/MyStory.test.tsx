// Plano 10 (Figma 52c e 54): a minha história, só para quem fez prognóstico.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Match } from '@/data/schemas';

type L = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; data: unknown };
const mockData: Record<'prediction' | 'settlement' | 'points' | 'vote' | 'players', L> = {
  prediction: { status: 'missing' },
  settlement: { status: 'missing' },
  points: { status: 'ready', data: [] },
  vote: { status: 'missing' },
  players: { status: 'missing' },
};
jest.mock('@react-native-firebase/crashlytics');
jest.mock('@/providers/SessionProvider', () => ({
  useSession: () => ({ status: 'signedIn', user: { uid: 'u1', email: null, providers: [] } }),
}));
jest.mock('@/services/analytics', () => ({ track: jest.fn() }));
jest.mock('@/data/user', () => ({
  useMyPrediction: jest.fn(() => mockData.prediction),
  useSettlement: jest.fn(() => mockData.settlement),
  useMyGamePoints: jest.fn(() => mockData.points),
  useMyMvpVote: jest.fn(() => mockData.vote),
}));
jest.mock('@/data/sports', () => ({ useMatchDetail: jest.fn(() => mockData.players) }));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: object) => <View {...props} /> };
});

import Share from 'react-native-share';
import { captureRef } from 'react-native-view-shot';
import { track } from '@/services/analytics';
import { MyStory } from '@/components/match/MyStory';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 44, left: 0, right: 0, bottom: 34 } };
const wrapper = ({ children }: { children: ReactNode }) => <SafeAreaProvider initialMetrics={METRICS}>{children}</SafeAreaProvider>;

const match = (): Match =>
  ({
    id: '1001',
    sport: 'football',
    competition: { key: 'football_94_2026', id: '94', name: 'Liga Portugal', type: 'league', season: '2026', round: 'Regular Season - 12', roundLabel: null },
    home: { id: '228', name: 'Sporting CP', logo: null },
    away: { id: '212', name: 'FC Porto', logo: null },
    sportingSide: 'home',
    kickoff: new Date('2026-12-21T20:30:00Z'),
    status: 'FT',
    elapsed: 90,
    elapsedExtra: null,
    score: { home: 2, away: 1, halftime: null, extratime: null, penalty: null },
    finishedAt: new Date('2026-12-21T22:25:00Z'),
    venue: null,
    referee: null,
    source: { provider: 'api-football', id: '1001', attribution: null },
  }) as unknown as Match;

beforeEach(() => {
  jest.clearAllMocks();
  mockData.prediction = { status: 'missing' };
  mockData.vote = { status: 'missing' };
  mockData.players = { status: 'missing' };
});

describe('MyStory', () => {
  it('sem prognóstico: nada', async () => {
    await render(<MyStory match={match()} />, { wrapper });
    expect(screen.queryByText('Partilhar a minha história')).toBeNull();
  });

  it('com prognóstico exato: cartão com o resultado, o palpite e +4 pts', async () => {
    mockData.prediction = { status: 'ready', data: { gameId: '1001', userId: 'u1', home: 2, away: 1 } };
    await render(<MyStory match={match()} />, { wrapper });
    await fireEvent.press(screen.getByText('Partilhar a minha história'));
    expect(screen.getByTestId('story-card')).toBeTruthy();
    expect(screen.getByTestId('story-pick').props.children).toBe('2 - 1');
    expect(screen.getByText('+4 pts')).toBeTruthy();
    expect(screen.getByTestId('story-date').props.children).toMatch(/Final$/);
    expect(screen.queryByTestId('story-mvp')).toBeNull();
  });

  it('com voto no MVP: mostra o nome do jogador votado', async () => {
    mockData.prediction = { status: 'ready', data: { gameId: '1001', userId: 'u1', home: 0, away: 1 } };
    mockData.vote = { status: 'ready', data: { gameId: '1001', userId: 'u1', playerId: '10' } };
    mockData.players = {
      status: 'ready',
      data: { teams: [{ teamId: '228', players: [{ playerId: '10', name: 'Trincão', number: 17, minutes: 90, rating: 8 }] }] },
    };
    await render(<MyStory match={match()} />, { wrapper });
    await fireEvent.press(screen.getByText('Partilhar a minha história'));
    expect(screen.getByTestId('story-mvp').props.children).toBe('Trincão');
    expect(screen.getByText('+1 pts')).toBeTruthy();
  });

  it('partilha a imagem 1080x1920 e mede share_story', async () => {
    mockData.prediction = { status: 'ready', data: { gameId: '1001', userId: 'u1', home: 2, away: 1 } };
    await render(<MyStory match={match()} />, { wrapper });
    await fireEvent.press(screen.getByText('Partilhar a minha história'));
    await act(async () => {
      fireEvent.press(screen.getByText('Partilhar'));
    });
    expect(captureRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ width: 1080, height: 1920 }));
    expect(Share.open).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('share_story', { game: '1001' });
  });
});
