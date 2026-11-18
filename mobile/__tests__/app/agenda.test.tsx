// Task 7: Agenda multi-modalidade. Hooks de dados mockados; expo-router global (jest.setup).
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OFFLINE_TEXT } from '@/components/OfflineBanner';
import type { GameStatus, Match, Sport } from '@/data/schemas';

const mockUpcoming: { current: unknown } = { current: { status: 'loading' } };
const mockResults: { current: unknown } = { current: { status: 'loading' } };

jest.mock('@/data/sports', () => ({
  useUpcomingMatches: jest.fn(() => mockUpcoming.current),
  useResultMatches: jest.fn(() => mockResults.current),
}));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: object) => <View {...props} /> };
});

import { router } from 'expo-router';
import { useResultMatches, useUpcomingMatches } from '@/data/sports';
import Agenda from '../../app/(app)/agenda';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const ui = () => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <Agenda />
  </SafeAreaProvider>
);

function match(over: Partial<Match> & { id: string }): Match {
  return {
    sport: 'football',
    competition: {
      key: 'football_94_2026',
      id: '94',
      name: 'Liga Portugal',
      type: 'league',
      season: '2026',
      round: 'Regular Season - 16',
      roundLabel: null,
    },
    home: { id: '228', name: 'Sporting CP', logo: null },
    away: { id: '217', name: 'SC Braga', logo: null },
    sportingSide: 'home',
    kickoff: new Date('2026-11-22T20:30:00Z'),
    status: 'NS' as GameStatus,
    elapsed: null,
    elapsedExtra: null,
    score: { home: null, away: null, halftime: null, extratime: null, penalty: null },
    finishedAt: null,
    venue: null,
    referee: null,
    source: { provider: 'api-football', id: over.id, attribution: null },
    ...over,
  } as Match;
}

const ready = (data: Match[], fromCache = false) => ({ status: 'ready', data, fromCache });
const sportsAsked = () => (useUpcomingMatches as jest.Mock).mock.calls.map((c) => c[0] as Sport | null);

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-18T12:00:00Z'));
  mockUpcoming.current = ready([]);
  mockResults.current = ready([]);
  (useUpcomingMatches as jest.Mock).mockImplementation(() => mockUpcoming.current);
  (useResultMatches as jest.Mock).mockImplementation(() => mockResults.current);
});
afterEach(() => jest.useRealTimers());

describe('cabeçalho e filtro', () => {
  it('mostra o título AGENDA e o botão Plantel, que abre /equipa', async () => {
    await render(ui());
    expect(screen.getByRole('header', { name: 'AGENDA' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Plantel' }));
    expect(router.push).toHaveBeenCalledWith('/equipa');
  });

  it('começa no Futebol e mudar para Futsal volta a perguntar os jogos dessa modalidade', async () => {
    await render(ui());
    expect(sportsAsked()[0]).toBe('football');
    await fireEvent.press(screen.getByRole('tab', { name: 'Futsal' }));
    expect(useUpcomingMatches).toHaveBeenLastCalledWith('futsal', expect.any(Date));
    expect(useResultMatches).toHaveBeenLastCalledWith('futsal', expect.any(Date));
  });
});

describe('listas', () => {
  const ns = match({ id: '1001' });
  const older = match({
    id: '900',
    status: 'FT',
    kickoff: new Date('2026-11-01T20:30:00Z'),
    score: { home: 1, away: 0, halftime: null, extratime: null, penalty: null },
  } as Partial<Match> & { id: string });
  const newer = match({
    id: '901',
    status: 'FT',
    kickoff: new Date('2026-11-08T20:30:00Z'),
    score: { home: 2, away: 2, halftime: null, extratime: null, penalty: null },
  } as Partial<Match> & { id: string });

  it('Próximos mostra as linhas e carregar numa abre /jogo/{id}', async () => {
    mockUpcoming.current = ready([ns]);
    await render(ui());
    await fireEvent.press(screen.getByTestId('match-row-1001'));
    expect(router.push).toHaveBeenCalledWith('/jogo/1001');
  });

  it('o separador Resultados mostra a lista por data descendente', async () => {
    mockUpcoming.current = ready([ns]);
    mockResults.current = ready([older, newer]);
    await render(ui());
    expect(screen.queryByTestId('match-row-901')).toBeNull();
    await fireEvent.press(screen.getByRole('tab', { name: 'Resultados' }));
    const rowIds = screen.getAllByTestId(/^match-row-/).map((r) => r.props.testID as string);
    expect(rowIds).toEqual(['match-row-901', 'match-row-900']);
    expect(screen.queryByTestId('match-row-1001')).toBeNull();
  });

  it('mostra o cartão do próximo jogo da modalidade', async () => {
    mockUpcoming.current = ready([ns]);
    await render(ui());
    expect(screen.getByRole('button', { name: 'Próximo jogo' })).toBeTruthy();
  });

  it('fontes gratuitas com atribuição aparecem no fim da lista', async () => {
    mockUpcoming.current = ready([
      match({
        id: '2001',
        sport: 'futsal',
        source: { provider: 'api-sports', id: '2001', attribution: 'API-SPORTS' },
      } as Partial<Match> & { id: string }),
    ]);
    await render(ui());
    expect(screen.getByText('Fonte: API-SPORTS')).toBeTruthy();
  });

  it('sem jogos da modalidade mostra o estado vazio', async () => {
    await render(ui());
    await fireEvent.press(screen.getByRole('tab', { name: 'Futsal' }));
    expect(screen.getByTestId('empty-state')).toBeTruthy();
    expect(screen.getByText('Sem jogos de futsal agendados.')).toBeTruthy();
  });
});

describe('carregamento, cache e erro (Review Focus 3)', () => {
  it('enquanto carrega mostra o esqueleto e nenhum estado vazio', async () => {
    mockUpcoming.current = { status: 'loading' };
    await render(ui());
    expect(screen.getByTestId('agenda-skeleton')).toBeTruthy();
    expect(screen.queryByTestId('empty-state')).toBeNull();
  });

  it('dados da cache mostram o aviso de falta de ligação', async () => {
    mockUpcoming.current = ready([match({ id: '1001' })], true);
    await render(ui());
    expect(screen.getByTestId('offline-banner')).toBeTruthy();
    expect(screen.getByText(OFFLINE_TEXT)).toBeTruthy();
    expect(screen.getByTestId('match-row-1001')).toBeTruthy();
  });

  it('com dados do servidor não há aviso', async () => {
    mockUpcoming.current = ready([match({ id: '1001' })]);
    await render(ui());
    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });

  it('erro mostra a mensagem e nenhuma lista', async () => {
    mockResults.current = { status: 'error', error: new Error('x') };
    await render(ui());
    expect(screen.getByText('Não foi possível carregar a agenda.')).toBeTruthy();
    expect(screen.queryByTestId('agenda-skeleton')).toBeNull();
  });
});
