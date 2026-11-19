// Task 21: ecrã do Perfil e "meu jogo". Hooks de dados mockados (sem rede).
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

type L =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; data: unknown; fromCache?: boolean };

const mockUser: { current: L } = { current: { status: 'loading' } };
const mockProfile: { current: L } = { current: { status: 'loading' } };
const mockEvents: { current: L } = { current: { status: 'loading' } };
const mockPredictions: { current: L } = { current: { status: 'loading' } };
const mockSettlements: { current: L } = { current: { status: 'loading' } };
const mockEntry: { current: L } = { current: { status: 'missing' } };
const mockSquad: { current: L } = { current: { status: 'loading' } };
const mockPosition = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));
jest.mock('@/providers/SessionProvider', () => ({
  useSession: () => ({ status: 'signedIn', user: { uid: 'abcd1234', email: 'sessao@exemplo.pt', providers: [] } }),
}));
jest.mock('@/data/hooks', () => ({
  useMyUser: jest.fn(() => mockUser.current),
  usePublicProfile: jest.fn(() => mockProfile.current),
}));
const mockMatchOnce: { current: (id: string | null) => unknown } = { current: () => undefined };
jest.mock('@/data/sports', () => ({
  useTeamData: jest.fn(() => mockSquad.current),
  useMatchOnce: jest.fn((id: string | null) => mockMatchOnce.current(id)),
}));
jest.mock('@/data/user', () => ({
  useMyPointEvents: jest.fn(() => mockEvents.current),
  useMyPredictions: jest.fn(() => mockPredictions.current),
  useSettlements: jest.fn(() => mockSettlements.current),
  useMyLeaderboardEntry: jest.fn(() => mockEntry.current),
  fetchMyPosition: (...a: unknown[]) => mockPosition(...a),
}));
// 18 Nov 2026 (quarta, W47), Lisboa em hora de inverno.
jest.mock('@/data/clock', () => ({ useNow: () => new Date('2026-11-18T12:00:00Z') }));

import { useMyLeaderboardEntry, useSettlements } from '@/data/user';
import Perfil from '../../app/(app)/perfil/index';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const renderScreen = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <Perfil />
    </SafeAreaProvider>,
  );
const ready = (data: unknown, fromCache?: boolean): L => ({ status: 'ready', data, fromCache });
const day = (n: number) => new Date(Date.UTC(2026, 10, n, 20, 0));
const pred = (gameId: string, home: number, away: number) => ({ gameId, userId: 'abcd1234', home, away, createdAt: null, source: 'v2027' });
const ev = (gameId: string, type: string, points: number, n: number) => ({ uid: 'abcd1234', gameId, type, points, gameDate: day(n) });

const USER = {
  name: 'Maria Albuquerque Costa',
  email: 'maria.costa@exemplo.pt',
  partnerNumber: '03/1998',
  memberNumber: '123456',
  seasonSeat: 'Porta 7, Setor A, Fila 3, Lugar 12',
  favoriteSport: 'futsal',
  favoritePlayer: { id: '9', name: 'Francisco Trincão' },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUser.current = ready(USER);
  mockProfile.current = ready({ displayName: 'Maria C.', avatarId: null });
  mockSquad.current = ready({ players: [{ id: '9', name: 'Francisco Trincão', number: 17, photo: 'https://x/y.jpg' }] });
  mockPredictions.current = ready([pred('g5', 1, 0), pred('g4', 2, 1), pred('g3', 3, 0), pred('g2', 0, 0), pred('g1', 1, 1)]);
  mockSettlements.current = ready({
    g4: { finalHome: 2, finalAway: 1, officialMvp: [] },
    g3: { finalHome: 1, finalAway: 0, officialMvp: [] },
    g2: { finalHome: 0, finalAway: 2, officialMvp: [] },
    g1: { finalHome: 1, finalAway: 1, officialMvp: [] },
  });
  mockEvents.current = ready([
    ev('g5', 'prediction_participation', 1, 15),
    ev('g4', 'prediction_participation', 1, 12),
    ev('g4', 'prediction_exact', 5, 12),
    ev('g4', 'mvp_correct', 3, 12),
    ev('g3', 'prediction_participation', 1, 9),
    ev('g3', 'prediction_outcome', 2, 9),
    ev('g2', 'prediction_participation', 1, 6),
    ev('g1', 'prediction_participation', 1, 3),
    ev('g1', 'prediction_exact', 5, 3),
  ]);
  mockEntry.current = ready({ uid: 'abcd1234', displayName: 'Maria C.', points: 12 });
  mockPosition.mockResolvedValue(7);
});

describe('Perfil: identidade', () => {
  it('mostra o nome público, a inicial, sócio desde, número, lugar e favoritos', async () => {
    await renderScreen();
    expect(screen.getByTestId('perfil-name').props.children).toBe('Maria C.');
    expect(screen.getByTestId('perfil-avatar-initial', { includeHiddenElements: true }).props.children).toBe('M');
    expect(screen.getByText('03/1998')).toBeTruthy();
    expect(screen.getByText('123456')).toBeTruthy();
    expect(screen.getByText('Porta 7, Setor A, Fila 3, Lugar 12')).toBeTruthy();
    expect(screen.getByText('Futsal')).toBeTruthy();
    expect(screen.getByText('Francisco Trincão')).toBeTruthy();
  });

  it('sem publicProfiles usa a regra do nome público ("Maria C."), nunca o nome completo', async () => {
    mockProfile.current = { status: 'missing' };
    await renderScreen();
    expect(screen.getByTestId('perfil-name').props.children).toBe('Maria C.');
    expect(screen.queryByText('Maria Albuquerque Costa')).toBeNull();
  });

  it('o nome longo ocupa uma linha com reticências', async () => {
    mockProfile.current = ready({ displayName: 'Bartolomeu Gusmão XX', avatarId: null });
    await renderScreen();
    expect(screen.getByTestId('perfil-name').props).toMatchObject({ numberOfLines: 1, ellipsizeMode: 'tail' });
  });

  it('jogador favorito e lugar anual numa linha com reticências', async () => {
    await renderScreen();
    for (const v of ['Francisco Trincão', 'Porta 7, Setor A, Fila 3, Lugar 12']) {
      const t = screen.getByText(v);
      expect(t.props.numberOfLines).toBe(1);
      expect(t.props.ellipsizeMode).toBe('tail');
    }
  });

  it('jogador favorito mostra o PlayerPhoto com a foto e o número do plantel', async () => {
    await renderScreen();
    expect(screen.getByTestId('favorite-player-photo')).toBeTruthy();
    expect(screen.getByTestId('player-photo-image', { hidden: true }).props.source).toEqual([{ uri: 'https://x/y.jpg' }]);
    expect(screen.getByText('17')).toBeTruthy();
  });

  it('jogador favorito fora do plantel mostra a silhueta (sem foto) e continua com o nome', async () => {
    mockSquad.current = ready({ players: [] });
    await renderScreen();
    expect(screen.getByTestId('favorite-player-photo')).toBeTruthy();
    expect(screen.queryByTestId('player-photo-image', { hidden: true })).toBeNull();
    expect(screen.getByText('Francisco Trincão')).toBeTruthy();
  });

  it('"Editar" (nome público) tem alvo de toque mínimo de 44 pt', async () => {
    await renderScreen();
    const st = StyleSheet.flatten(screen.getByRole('button', { name: 'Editar nome público' }).props.style);
    expect(st.minHeight).toBeGreaterThanOrEqual(44);
    expect(st.minWidth).toBeGreaterThanOrEqual(44);
  });

  it('jogador favorito com nome longo: etiqueta não encolhe e o nome ocupa uma linha com reticências (320 pt)', async () => {
    mockUser.current = ready({ ...USER, favoritePlayer: { id: '9', name: 'Francisco Fernando Trincão da Silva Albuquerque' } });
    await renderScreen();
    const name = screen.getByText('Francisco Fernando Trincão da Silva Albuquerque');
    expect(name.props.numberOfLines).toBe(1);
    expect(StyleSheet.flatten(name.props.style).flex).toBe(1);
    const label = StyleSheet.flatten(screen.getByText('Jogador favorito').props.style);
    expect(label.flexShrink).toBe(0);
    expect(label.flex).toBeUndefined();
    // Nenhum irmão com flex 1 além do nome (senão dividiria o espaço livre com ele).
    const row = screen.getByText('Jogador favorito').parent;
    const flexed = (row?.children ?? []).filter((c) => typeof c !== 'string' && StyleSheet.flatten(c.props.style)?.flex === 1);
    expect(flexed).toHaveLength(1);
    expect(flexed[0]).toBe(name);
  });

  it('o email (users e sessão) nunca aparece', async () => {
    await renderScreen();
    expect(screen.queryByText(/@/)).toBeNull();
    expect(JSON.stringify(screen.toJSON())).not.toMatch(/exemplo\.pt/);
  });

  it('users a carregar: secção Sócio em carregamento, sem "Não indicado"', async () => {
    mockUser.current = { status: 'loading' };
    await renderScreen();
    expect(screen.getByTestId('socio-loading')).toBeTruthy();
    expect(screen.queryByText('Não indicado')).toBeNull();
    expect(screen.queryByText('Número de sócio')).toBeNull();
  });

  it('users com leitura falhada: erro da secção, nunca "Não indicado"', async () => {
    mockUser.current = { status: 'error', error: new Error('permission-denied') };
    await renderScreen();
    expect(screen.getByText('Não foi possível carregar esta secção.')).toBeTruthy();
    expect(screen.queryByText('Não indicado')).toBeNull();
  });

  it('sem documento users: os campos dizem "Não indicado"', async () => {
    mockUser.current = { status: 'missing' };
    await renderScreen();
    expect(screen.getAllByText('Não indicado')).toHaveLength(5);
  });

  it('campos por preencher dizem "Não indicado"', async () => {
    mockUser.current = ready({ name: 'Maria Costa' });
    await renderScreen();
    expect(screen.getAllByText('Não indicado')).toHaveLength(5);
  });
});

describe('Perfil: ligações', () => {
  it.each([
    ['Editar nome público', '/perfil/nome'],
    ['Editar perfil', '/perfil/editar'],
    ['Preferências de notificação', '/perfil/notificacoes'],
    ['Apagar conta', '/apagar-conta'],
  ])('%s abre %s', async (label, href) => {
    await renderScreen();
    await fireEvent.press(screen.getByLabelText(label));
    expect(mockPush).toHaveBeenCalledWith(href);
  });
});

describe('Perfil: meu jogo', () => {
  it('mostra acerto, exatos, MVPs certos e série atual', async () => {
    await renderScreen();
    expect(screen.getByTestId('stat-accuracy').props.children).toBe('75 %');
    expect(screen.getByTestId('stat-exact').props.children).toBe('2');
    expect(screen.getByTestId('stat-mvp').props.children).toBe('1');
    expect(screen.getByTestId('stat-streak').props.children).toBe('2');
    expect(screen.getByText('4 jogos liquidados')).toBeTruthy();
  });

  it('pede os liquidados dos jogos com prognóstico', async () => {
    await renderScreen();
    expect(useSettlements).toHaveBeenLastCalledWith(['g5', 'g4', 'g3', 'g2', 'g1']);
  });

  it('histórico com palpite, final e pontos; por liquidar quando não há liquidação', async () => {
    await renderScreen();
    const rows = screen.getAllByTestId('history-row');
    expect(rows).toHaveLength(5);
    expect(screen.getByLabelText('15 novembro, prognóstico 1-0, por liquidar, 1 ponto')).toBeTruthy();
    expect(screen.getByLabelText('12 novembro, prognóstico 2-1, final 2-1, 6 pontos')).toBeTruthy();
    // Figma 22: pontos positivos com sinal ("+6 PTS"); zero sem sinal ("0 PTS").
    expect(screen.getAllByText('+6 PTS').length).toBeGreaterThan(0);
    expect(screen.queryByText('+0 PTS')).toBeNull();
  });

  it('histórico: sem o jogo (a chegar ou em falta) fica "{data} · Final {x}-{y}"', async () => {
    mockMatchOnce.current = () => undefined;
    await renderScreen();
    expect(screen.getByText('12 novembro · Final 2-1')).toBeTruthy();
    expect(screen.queryByText('Sporting CP 2-1 FC Porto')).toBeNull();
  });

  it('histórico: com o jogo o título é "{casa} {x}-{y} {fora}"; por liquidar nunca leva as equipas', async () => {
    mockMatchOnce.current = () => ({
      id: 'g4',
      sport: 'football',
      home: { id: '228', name: 'Sporting CP', logo: null },
      away: { id: '212', name: 'FC Porto', logo: null },
      sportingSide: 'home',
      kickoff: new Date(),
      status: 'FT',
      score: { home: 2, away: 1 },
      competition: { key: 'k', name: 'Liga', round: null, roundLabel: null },
    });
    await renderScreen();
    expect(screen.getAllByText('Sporting CP 2-1 FC Porto')).toHaveLength(1);
    expect(screen.getByLabelText('Sporting CP 2-1 FC Porto, 12 novembro, prognóstico 2-1, final 2-1, 6 pontos')).toBeTruthy();
    expect(screen.getByText('15 novembro')).toBeTruthy();
  });

  it('sem liquidados mostra "Ainda sem jogos liquidados."', async () => {
    mockSettlements.current = ready({});
    await renderScreen();
    expect(screen.getByText('Ainda sem jogos liquidados.')).toBeTruthy();
    expect(screen.queryByTestId('stat-accuracy')).toBeNull();
  });

  it('leitura falhada mostra erro, nunca a mensagem de vazio', async () => {
    mockSettlements.current = { status: 'error', error: new Error('permission-denied') };
    await renderScreen();
    expect(screen.getByText('Não foi possível carregar o teu jogo.')).toBeTruthy();
    expect(screen.queryByText('Ainda sem jogos liquidados.')).toBeNull();
  });

  it('falha nos eventos também é erro', async () => {
    mockEvents.current = { status: 'error', error: new Error('x') };
    await renderScreen();
    expect(screen.getByText('Não foi possível carregar o teu jogo.')).toBeTruthy();
  });
});

describe('Perfil: pontos e posição por período', () => {
  it('Semana por defeito, com pontos e posição', async () => {
    await renderScreen();
    expect(useMyLeaderboardEntry).toHaveBeenLastCalledWith('week', '2026-W47', 'abcd1234');
    expect(screen.getByTestId('period-points').props.children).toBe('12');
    await waitFor(() => expect(screen.getByTestId('period-position').props.children).toBe('7.º'));
    expect(mockPosition).toHaveBeenCalledWith('week', '2026-W47', 12);
  });

  it('Mês e Época mudam a entrada lida', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('tab', { name: 'Mês' }));
    expect(useMyLeaderboardEntry).toHaveBeenLastCalledWith('month', '2026-11', 'abcd1234');
    await fireEvent.press(screen.getByRole('tab', { name: 'Época' }));
    expect(useMyLeaderboardEntry).toHaveBeenLastCalledWith('season', '2026-2027', 'abcd1234');
  });

  it('sem pontos no período: 0 pontos e sem posição', async () => {
    mockEntry.current = { status: 'missing' };
    await renderScreen();
    expect(screen.getByTestId('period-points').props.children).toBe('0');
    expect(screen.getByText('Ainda não pontuaste nesta semana.')).toBeTruthy();
    expect(mockPosition).not.toHaveBeenCalled();
  });

  it('falha na entrada ou na posição mostra erro', async () => {
    mockPosition.mockRejectedValue(new Error('x'));
    await renderScreen();
    await waitFor(() => expect(screen.getByText('Não foi possível carregar a tua posição.')).toBeTruthy());
    mockEntry.current = { status: 'error', error: new Error('x') };
    await renderScreen();
    expect(screen.getAllByText('Não foi possível carregar a tua posição.').length).toBeGreaterThan(0);
  });
});
