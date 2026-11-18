// Task 8: detalhe do jogo (estrutura, cabeçalho e tabs). `useMatch` mockado; expo-router mockado
// aqui (o de jest.setup não deixa escolher os parâmetros da rota).
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OFFLINE_TEXT } from '@/components/OfflineBanner';
import type { GameStatus, Match } from '@/data/schemas';

const mockMatch: { current: unknown } = { current: { status: 'loading' } };
const mockParams: { current: Record<string, string> } = { current: { id: '1001' } };

jest.mock('@/data/sports', () => ({
  useMatch: jest.fn(() => mockMatch.current),
  // Tab Sumário (Task 9): jogo sem detalhes ainda.
  useMatchDetail: jest.fn(() => ({ status: 'missing' })),
  useVenue: jest.fn(() => ({ status: 'missing' })),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => mockParams.current,
}));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: object) => <View {...props} /> };
});

import { useMatch } from '@/data/sports';
import Jogo from '../../app/(app)/jogo/[id]';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const ui = () => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <Jogo />
  </SafeAreaProvider>
);

const KICKOFF = new Date('2026-09-14T19:30:00Z'); // 20:30 em Lisboa
const NOW = new Date('2026-09-09T10:00:00Z');

function match(over: Partial<Match> = {}): Match {
  return {
    id: '1001',
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
    kickoff: KICKOFF,
    status: 'NS' as GameStatus,
    elapsed: null,
    elapsedExtra: null,
    score: { home: null, away: null, halftime: null, extratime: null, penalty: null },
    finishedAt: null,
    venue: null,
    referee: null,
    source: { provider: 'api-football', id: '1001', attribution: null },
    ...over,
  } as Match;
}

const ready = (data: Match, fromCache = false) => ({ status: 'ready', data, fromCache });
const tabLabels = () => screen.getAllByRole('tab').map((t) => within(t).getByText(/.+/).props.children as string);

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  mockParams.current = { id: '1001' };
  mockMatch.current = ready(match());
  (useMatch as jest.Mock).mockImplementation(() => mockMatch.current);
});
afterEach(() => jest.useRealTimers());

describe('futebol', () => {
  it('lê o jogo do id da rota e mostra o nome da competição no Header', async () => {
    await render(ui());
    expect(useMatch).toHaveBeenCalledWith('1001');
    expect(within(screen.getByTestId('header')).getByText('Liga Portugal')).toBeTruthy();
  });

  it('mostra as 7 tabs por esta ordem', async () => {
    await render(ui());
    expect(tabLabels()).toEqual([
      'Sumário',
      'Vídeos',
      'Estatísticas',
      'Formações',
      'Classificação',
      'Prognóstico',
      'MVP',
    ]);
  });

  it('abre no Sumário e mudar de tab troca o conteúdo', async () => {
    await render(ui());
    expect(screen.getByRole('tab', { name: 'Sumário' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByText('Disponível no dia de jogo')).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Formações' }));
    expect(screen.getByText('Os onzes são conhecidos cerca de uma hora antes do jogo.')).toBeTruthy();
    expect(screen.queryByText('Disponível no dia de jogo')).toBeNull();
  });

  it('?tab=prognostico abre o Prognóstico', async () => {
    mockParams.current = { id: '1001', tab: 'prognostico' };
    await render(ui());
    expect(screen.getByRole('tab', { name: 'Prognóstico' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByText('Prognóstico em breve.')).toBeTruthy();
  });

  it('um `tab` desconhecido cai no Sumário', async () => {
    mockParams.current = { id: '1001', tab: 'xpto' };
    await render(ui());
    expect(screen.getByRole('tab', { name: 'Sumário' }).props.accessibilityState.selected).toBe(true);
  });

  it('o cabeçalho do jogo não mostra o local (futebol tem Informação do Jogo)', async () => {
    mockMatch.current = ready(
      match({ venue: { id: 'v1', name: 'Estádio José Alvalade', city: 'Lisboa', capacity: null, image: null } }),
    );
    await render(ui());
    expect(screen.queryByTestId('game-venue')).toBeNull();
  });
});

describe('outras modalidades', () => {
  const futsal = match({
    id: '2001',
    sport: 'futsal',
    competition: {
      key: 'futsal_1_2026',
      id: '1',
      name: 'Liga Placard Futsal',
      type: 'league',
      season: '2026',
      round: 'Regular Season - 5',
      roundLabel: null,
    },
    venue: { id: 'v9', name: 'Pavilhão João Rocha', city: 'Lisboa', capacity: null, image: null },
    source: { provider: 'api-sports', id: '2001', attribution: 'API-SPORTS' },
  } as Partial<Match>);

  it('não mostra tabs e dá o nome da modalidade no Header', async () => {
    mockMatch.current = ready(futsal);
    await render(ui());
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(within(screen.getByTestId('header')).getByText('Futsal')).toBeTruthy();
  });

  it('mostra Competição, Data e Local, e o local também no cabeçalho', async () => {
    mockMatch.current = ready(futsal);
    await render(ui());
    expect(screen.getByText('Competição')).toBeTruthy();
    expect(screen.getByText('Liga Placard Futsal, J5')).toBeTruthy();
    expect(screen.getByText('Data')).toBeTruthy();
    expect(screen.getByText('14 Set 2026, 20:30')).toBeTruthy();
    expect(screen.getByText('Local')).toBeTruthy();
    expect(screen.getByText('Pavilhão João Rocha, Lisboa')).toBeTruthy();
    expect(screen.getByTestId('game-venue')).toBeTruthy();
  });

  it('com atribuição da fonte mostra "Fonte: ..."', async () => {
    mockMatch.current = ready(futsal);
    await render(ui());
    expect(screen.getByText('Fonte: API-SPORTS')).toBeTruthy();
  });

  it('sem local não mostra a linha Local', async () => {
    mockMatch.current = ready(match({ id: '2002', sport: 'handball' } as Partial<Match>));
    await render(ui());
    expect(screen.queryByText('Local')).toBeNull();
    expect(screen.getByText('Competição')).toBeTruthy();
  });
});

describe('carregamento, cache, ausência e erro (Review Focus 3)', () => {
  it('enquanto carrega mostra o esqueleto', async () => {
    mockMatch.current = { status: 'loading' };
    await render(ui());
    expect(screen.getByTestId('jogo-skeleton')).toBeTruthy();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  it('jogo inexistente mostra "Jogo não encontrado."', async () => {
    mockMatch.current = { status: 'missing' };
    await render(ui());
    expect(screen.getByText('Jogo não encontrado.')).toBeTruthy();
    expect(screen.queryByTestId('jogo-skeleton')).toBeNull();
  });

  it('erro mostra a mensagem e nenhum esqueleto', async () => {
    mockMatch.current = { status: 'error', error: new Error('x') };
    await render(ui());
    expect(screen.getByText('Não foi possível carregar o jogo.')).toBeTruthy();
    expect(screen.queryByTestId('jogo-skeleton')).toBeNull();
  });

  it('dados da cache mostram o aviso de falta de ligação', async () => {
    mockMatch.current = ready(match(), true);
    await render(ui());
    expect(screen.getByTestId('offline-banner')).toBeTruthy();
    expect(screen.getByText(OFFLINE_TEXT)).toBeTruthy();
  });

  it('com dados do servidor não há aviso', async () => {
    await render(ui());
    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });
});
