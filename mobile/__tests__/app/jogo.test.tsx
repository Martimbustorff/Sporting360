// Task 8: detalhe do jogo (estrutura, cabeçalho e tabs). `useMatch` mockado; expo-router mockado
// aqui (o de jest.setup não deixa escolher os parâmetros da rota).
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OFFLINE_TEXT } from '@/components/OfflineBanner';
import type { GameStatus, Match } from '@/data/schemas';

const mockMatch: { current: unknown } = { current: { status: 'loading' } };
const mockDetail: { current: Record<string, unknown> } = { current: {} };
const mockUser: { current: { prediction: unknown; settlement: unknown; points: unknown } } = {
  current: { prediction: { status: 'loading' }, settlement: { status: 'missing' }, points: { status: 'loading' } },
};
const mockParams: { current: Record<string, string> } = { current: { id: '1001' } };

jest.mock('@/data/sports', () => ({
  useMatch: jest.fn(() => mockMatch.current),
  // Tab Sumário (Task 9): jogo sem detalhes ainda.
  useMatchDetail: jest.fn((_id: string, kind: string) => mockDetail.current[kind] ?? { status: 'missing' }),
  useVenue: jest.fn(() => ({ status: 'missing' })),
}));
jest.mock('@/data/user', () => ({
  useMyPrediction: jest.fn(() => mockUser.current.prediction),
  useSettlement: jest.fn(() => mockUser.current.settlement),
  useMyGamePoints: jest.fn(() => mockUser.current.points),
}));
jest.mock('@/providers/SessionProvider', () => ({
  useSession: () => ({ status: 'signedIn', user: { uid: 'u1' } }),
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
  mockDetail.current = {};
  mockUser.current = { prediction: { status: 'loading' }, settlement: { status: 'missing' }, points: { status: 'loading' } };
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

  it('mostra as 6 tabs por esta ordem (o prognóstico é um cartão no Sumário)', async () => {
    await render(ui());
    expect(tabLabels()).toEqual([
      'Sumário',
      'Vídeos',
      'Estatísticas',
      'Formações',
      'Classificação',
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

  it('?tab=prognostico (links e push antigos) abre o Sumário com o cartão do prognóstico', async () => {
    mockParams.current = { id: '1001', tab: 'prognostico' };
    await render(ui());
    expect(screen.getByRole('tab', { name: 'Sumário' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('prediction-card')).toBeTruthy();
    // Task 16: sem sessão (sem SessionProvider) o prognóstico fica a carregar.
    expect(screen.getByTestId('prediction-loading')).toBeTruthy();
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

describe('cabeçalho compacto com o scroll (frames 06 e 08)', () => {
  const liveMatch = () =>
    match({
      status: 'LIVE' as GameStatus,
      elapsed: 67,
      score: { home: 2, away: 1, halftime: null, extratime: null, penalty: null },
    });
  const scrollTo = async (y: number) =>
    fireEvent.scroll(screen.getByTestId('summary-tab'), { nativeEvent: { contentOffset: { x: 0, y } } });

  it('mostra marcadores e o cartão do prognóstico quando existe', async () => {
    mockMatch.current = ready(liveMatch());
    mockDetail.current = {
      events: {
        status: 'ready',
        data: { items: [{ minute: 23, extra: null, teamId: '228', playerId: null, playerName: 'L. Suárez', assistId: null, assistName: null, type: 'goal', detail: 'Normal Goal', comments: null }] },
      },
    };
    mockUser.current.prediction = { status: 'ready', data: { gameId: '1001', home: 2, away: 1 } };
    await render(ui());
    expect(screen.getByText('L. Suárez 23’')).toBeTruthy();
    expect(screen.getByTestId('prediction-pick').props.children).toBe('2-1');
    // Ao vivo 2-1 com palpite 2-1: pontos provisórios (participação 1 + exato 3).
    expect(within(screen.getByTestId('prediction-points')).getByText('+4 PTS')).toBeTruthy();
    expect(screen.getByText('Estás a acertar no resultado exato')).toBeTruthy();
  });

  it.each([
    [{ home: 1, away: 0 }, '+2 PTS', 'Estás a acertar no vencedor'],
    [{ home: 0, away: 3 }, '+1 PTS', 'Para já só tens o ponto da participação'],
  ])('ao vivo com palpite %j mostra %s e a linha certa', async (pick, chip, note) => {
    mockMatch.current = ready(liveMatch());
    mockUser.current.prediction = { status: 'ready', data: { gameId: '1001', ...pick } };
    await render(ui());
    expect(within(screen.getByTestId('prediction-points')).getByText(chip)).toBeTruthy();
    expect(screen.getByText(note)).toBeTruthy();
  });

  it('ao vivo empatado com palpite de empate diz "no empate"', async () => {
    mockMatch.current = ready({ ...liveMatch(), score: { home: 1, away: 1, halftime: null, extratime: null, penalty: null } });
    mockUser.current.prediction = { status: 'ready', data: { gameId: '1001', home: 0, away: 0 } };
    await render(ui());
    expect(screen.getByText('Estás a acertar no empate')).toBeTruthy();
  });

  it('terminado e ainda por liquidar mostra só o palpite, sem pontos', async () => {
    mockMatch.current = ready({ ...liveMatch(), status: 'FT' as GameStatus });
    mockUser.current.prediction = { status: 'ready', data: { gameId: '1001', home: 2, away: 1 } };
    await render(ui());
    expect(screen.getByTestId('prediction-pick')).toBeTruthy();
    expect(screen.queryByTestId('prediction-points')).toBeNull();
    expect(screen.queryByTestId('prediction-note')).toBeNull();
  });

  it('sem prognóstico o cartão fica escondido', async () => {
    mockMatch.current = ready(liveMatch());
    await render(ui());
    expect(screen.queryByTestId('prediction-summary')).toBeNull();
  });

  it('terminado e liquidado mostra os pontos do servidor', async () => {
    mockMatch.current = ready(
      match({ status: 'FT' as GameStatus, score: { home: 2, away: 1, halftime: null, extratime: null, penalty: null } }),
    );
    mockUser.current = {
      prediction: { status: 'ready', data: { gameId: '1001', home: 2, away: 1 } },
      settlement: { status: 'ready', data: { finalHome: 2, finalAway: 1 } },
      points: {
        status: 'ready',
        data: [
          { type: 'prediction_participation', points: 1 },
          { type: 'prediction_exact', points: 3 },
          { type: 'mvp_correct', points: 2 },
        ],
      },
    };
    await render(ui());
    expect(within(screen.getByTestId('prediction-points')).getByText('+4 PTS')).toBeTruthy();
  });

  it('o cabeçalho completo e os separadores aparecem juntos; o compacto está escondido', async () => {
    mockMatch.current = ready(liveMatch());
    await render(ui());
    expect(screen.getByText('Ao vivo · 2.ª parte')).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(6);
    // Ao vivo o Sumário é o do jogo: o cartão do prognóstico já saiu (Martim 20/11).
    expect(screen.queryByTestId('prediction-card')).toBeNull();
    expect(screen.queryByTestId('game-header-compact')).toBeNull(); // oculto à acessibilidade
    expect(screen.getByTestId('game-header-compact', { includeHiddenElements: true })).toBeTruthy();
  });

  it('com scroll o compacto passa a ser o rótulo acessível e os separadores ficam', async () => {
    mockMatch.current = ready(liveMatch());
    await render(ui());
    await scrollTo(100);
    expect(screen.getByTestId('game-header-compact').props.accessibilityLabel).toBe(
      'Sporting CP 2, SC Braga 1, ao vivo, 67’',
    );
    expect(screen.getAllByRole('tab')).toHaveLength(6);
    await scrollTo(0);
    expect(screen.queryByTestId('game-header-compact')).toBeNull();
  });

  it('mudar de separador reabre o cabeçalho', async () => {
    mockMatch.current = ready(liveMatch());
    await render(ui());
    await scrollTo(100);
    expect(screen.getByTestId('game-header-compact')).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Formações' }));
    expect(screen.queryByTestId('game-header-compact')).toBeNull();
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

  it('não mostra tabs e põe a competição na barra (frame 34)', async () => {
    mockMatch.current = ready(futsal);
    await render(ui());
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    const header = within(screen.getByTestId('header'));
    expect(header.getByText('Liga Placard Futsal')).toBeTruthy();
    expect(header.getByText('J5')).toBeTruthy();
  });

  it('mostra data, hora e local só no cabeçalho do jogo', async () => {
    mockMatch.current = ready(futsal);
    await render(ui());
    expect(screen.getByText('Próximo jogo')).toBeTruthy();
    expect(screen.getByTestId('game-date').props.children).toBe('SEG 14 SET');
    expect(screen.getByTestId('game-time').props.children).toBe('20:30');
    expect(screen.getByTestId('game-venue').props.children).toBe('Pavilhão João Rocha, Lisboa');
    expect(screen.queryByText('Competição')).toBeNull();
  });

  it('com atribuição da fonte mostra "Fonte: ..."', async () => {
    mockMatch.current = ready(futsal);
    await render(ui());
    expect(screen.getByText('Fonte: API-SPORTS')).toBeTruthy();
  });

  it('sem local não mostra a linha do local', async () => {
    mockMatch.current = ready(match({ id: '2002', sport: 'handball' } as Partial<Match>));
    await render(ui());
    expect(screen.queryByTestId('game-venue')).toBeNull();
    expect(screen.getByTestId('game-time')).toBeTruthy();
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
