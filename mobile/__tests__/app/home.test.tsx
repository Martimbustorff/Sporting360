// Task 5: Home. Dados mockados (hooks); expo-router global (jest.setup) com `router.push` estável.
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Match } from '@/data/schemas';

const mockUser: { current: unknown } = { current: { status: 'loading' } };
const mockProfile: { current: unknown } = { current: { status: 'missing' } };
const mockConfig: { current: unknown } = { current: { status: 'loading' } };
const mockNext: { current: unknown } = { current: { status: 'ready', data: null } };

jest.mock('@/providers/SessionProvider', () => ({
  useSession: () => ({ status: 'signedIn', user: { uid: 'abcd1234', email: 'x@y.pt', providers: ['password'] } }),
}));
jest.mock('@/data/hooks', () => ({
  useMyUser: jest.fn(() => mockUser.current),
  usePublicProfile: jest.fn(() => mockProfile.current),
  useAppConfig: jest.fn(() => mockConfig.current),
}));
jest.mock('@/data/sports', () => ({ useNextFootballMatch: jest.fn(() => mockNext.current) }));

import { router } from 'expo-router';
import { useNextFootballMatch } from '@/data/sports';
import Home from '../../app/(app)/index';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const ui = () => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <GestureHandlerRootView>
      <Home />
    </GestureHandlerRootView>
  </SafeAreaProvider>
);

const MATCH = {
  id: '1001',
  sport: 'football',
  competition: {
    key: 'football_94_2026',
    id: '94',
    name: 'Liga Portugal',
    type: 'league',
    season: '2026',
    round: 'Regular Season - 11',
    roundLabel: 'J11',
  },
  home: { id: '228', name: 'Sporting CP', logo: null },
  away: { id: '211', name: 'Benfica', logo: null },
  sportingSide: 'home',
  kickoff: new Date('2026-11-22T20:30:00Z'),
  status: 'NS',
  elapsed: null,
  elapsedExtra: null,
  score: { home: null, away: null, halftime: null, extratime: null, penalty: null },
  finishedAt: null,
  venue: { id: '1', name: 'Estádio José Alvalade', city: 'Lisboa', capacity: 50000, image: null },
  referee: null,
  source: { provider: 'api-football', id: '1001', attribution: null },
} as unknown as Match;

const config = (features: Record<string, unknown> | undefined) => ({
  status: 'ready',
  data: { comunidadeLeonina: [], ...(features ? { features } : { features: { comunidadeLeonina: false } }) },
});
const menuLabels = () =>
  within(screen.getByTestId('home-menu'))
    .getAllByRole('button')
    .map((b) => b.props.accessibilityLabel as string);

beforeEach(() => {
  jest.clearAllMocks();
  mockUser.current = { status: 'ready', data: { name: 'João Oliveira Simões', partnerNumber: '05/2008' } };
  mockProfile.current = { status: 'missing' };
  mockConfig.current = config(undefined);
  mockNext.current = { status: 'ready', data: null };
  (useNextFootballMatch as jest.Mock).mockImplementation(() => mockNext.current);
});

describe('menu', () => {
  const BASE = ['NOTÍCIAS', 'AGENDA', 'RANKING', 'MAPA DO ESTÁDIO', 'SITES DO CLUBE'];

  it('sem a flag (ou ainda a carregar) não mostra a Comunidade Leonina', async () => {
    mockConfig.current = { status: 'loading' };
    await render(ui());
    expect(menuLabels()).toEqual(BASE);
  });

  it('com features.comunidadeLeonina false não mostra a Comunidade Leonina', async () => {
    mockConfig.current = config({ comunidadeLeonina: false });
    await render(ui());
    expect(menuLabels()).toEqual(BASE);
  });

  it('com features.comunidadeLeonina true mostra-a entre o Mapa e os Sites', async () => {
    mockConfig.current = config({ comunidadeLeonina: true });
    await render(ui());
    expect(menuLabels()).toEqual(['NOTÍCIAS', 'AGENDA', 'RANKING', 'MAPA DO ESTÁDIO', 'COMUNIDADE LEONINA', 'SITES DO CLUBE']);
  });

  it.each([
    ['NOTÍCIAS', '/noticias'],
    ['AGENDA', '/agenda'],
    ['RANKING', '/ranking'],
    ['MAPA DO ESTÁDIO', '/estadio'],
    ['SITES DO CLUBE', '/sites'],
  ])('%s abre %s', async (label, href) => {
    await render(ui());
    await fireEvent.press(screen.getByRole('button', { name: label }));
    expect(router.push).toHaveBeenCalledWith(href);
  });

  it('COMUNIDADE LEONINA abre /comunidade', async () => {
    mockConfig.current = config({ comunidadeLeonina: true });
    await render(ui());
    await fireEvent.press(screen.getByRole('button', { name: 'COMUNIDADE LEONINA' }));
    expect(router.push).toHaveBeenCalledWith('/comunidade');
  });
});

describe('cabeçalho', () => {
  it('ícone de definições abre /definicoes', async () => {
    await render(ui());
    await fireEvent.press(screen.getByRole('button', { name: 'Definições' }));
    expect(router.push).toHaveBeenCalledWith('/definicoes');
  });

  it('mostra o nome e o "sócio desde" tal como está gravado; tocar abre o perfil', async () => {
    await render(ui());
    expect(screen.getByText('João Oliveira Simões')).toBeTruthy();
    expect(screen.getByText('Sócio desde')).toBeTruthy();
    expect(screen.getByText('05/2008')).toBeTruthy();
    await fireEvent.press(screen.getByText('João Oliveira Simões'));
    expect(router.push).toHaveBeenCalledWith('/perfil');
  });

  it('sem partnerNumber esconde a linha "Sócio desde"', async () => {
    mockUser.current = { status: 'ready', data: { name: 'João Oliveira Simões' } };
    await render(ui());
    expect(screen.queryByText('Sócio desde')).toBeNull();
  });

  it('partnerNumber numérico (V2) mostra-se com String(v)', async () => {
    mockUser.current = { status: 'ready', data: { name: 'Ana', partnerNumber: 52008 } };
    await render(ui());
    expect(screen.getByText('52008')).toBeTruthy();
  });

  it('nunca mostra o email: sem name usa o nome público', async () => {
    mockUser.current = { status: 'ready', data: { name: '', email: 'x@y.pt' } };
    mockProfile.current = { status: 'ready', data: { displayName: 'Leão 77', avatarId: null } };
    await render(ui());
    expect(screen.queryByText(/@/)).toBeNull();
    expect(screen.getByText('Leão 77')).toBeTruthy();
  });

  it('sem name nem perfil público mostra o nome automático, nunca o email', async () => {
    mockUser.current = { status: 'ready', data: { email: 'x@y.pt' } };
    await render(ui());
    expect(screen.queryByText(/@/)).toBeNull();
    expect(screen.getByText('Sportinguista #1234')).toBeTruthy();
  });

  it('um name gravado com @ (email) também não aparece', async () => {
    mockUser.current = { status: 'ready', data: { name: 'x@y.pt', email: 'x@y.pt' } };
    await render(ui());
    expect(screen.queryByText(/@/)).toBeNull();
  });
});

describe('próximo jogo', () => {
  it('mostra competição e jornada; tocar abre /jogo/1001', async () => {
    mockNext.current = { status: 'ready', data: MATCH };
    await render(ui());
    expect(screen.getByText('Liga Portugal')).toBeTruthy();
    expect(screen.getByText('J11')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Próximo jogo' }));
    expect(router.push).toHaveBeenCalledWith('/jogo/1001');
  });

  it('sem jogo não há cartão nem erro', async () => {
    await render(ui());
    expect(screen.queryByRole('button', { name: 'Próximo jogo' })).toBeNull();
    expect(screen.queryByText(/erro/i)).toBeNull();
  });

  it('o relógio anda com a Home montada: depois dos jogos acabarem aparece o seguinte', async () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-11-18T22:55:00Z'));
      const after = new Date('2026-11-18T23:00:00Z').getTime();
      // A query do bloco antigo só traz jogos terminados (null); a do bloco seguinte traz o 1001.
      (useNextFootballMatch as jest.Mock).mockImplementation((now: Date) =>
        now.getTime() >= after ? { status: 'ready', data: MATCH } : { status: 'ready', data: null },
      );
      await render(ui());
      expect(screen.queryByRole('button', { name: 'Próximo jogo' })).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(5 * 60_000);
      });
      expect(screen.getByRole('button', { name: 'Próximo jogo' })).toBeTruthy();
      expect(screen.getByText('J11')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('a carregar ou com erro também não há cartão', async () => {
    mockNext.current = { status: 'error', error: new Error('x') };
    await render(ui());
    expect(screen.queryByRole('button', { name: 'Próximo jogo' })).toBeNull();
  });
});

it('mostra a folha GameBox em baixo', async () => {
  await render(ui());
  expect(screen.getByRole('button', { name: 'GameBox Digital' })).toBeTruthy();
});
