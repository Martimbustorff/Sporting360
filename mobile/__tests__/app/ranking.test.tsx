// Task 19: ecrã do Ranking. Hooks de dados mockados (sem rede); nenhum acesso a `users`/`publicProfiles`.
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { LeaderboardEntry } from '@/data/schemas';

type L =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; data: unknown; fromCache?: boolean };

const mockBoard: { current: L } = { current: { status: 'loading' } };
const mockMine: { current: L } = { current: { status: 'missing' } };
const mockSession: { current: { status: 'signedIn' | 'signedOut' } } = { current: { status: 'signedIn' } };
const mockPosition = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));
jest.mock('@/providers/SessionProvider', () => ({
  useSession: () =>
    mockSession.current.status === 'signedIn'
      ? { status: 'signedIn', user: { uid: 'me', email: 'eu@exemplo.pt', providers: [] } }
      : { status: 'signedOut' },
}));
jest.mock('@/data/user', () => ({
  useLeaderboard: jest.fn(() => mockBoard.current),
  useMyLeaderboardEntry: jest.fn(() => mockMine.current),
  fetchMyPosition: (...a: unknown[]) => mockPosition(...a),
}));
// Se o ecrã lesse o utilizador (e o email) falharia aqui.
jest.mock('@/data/hooks', () => ({
  useMyUser: jest.fn(),
  usePublicProfile: jest.fn(),
  useDocument: jest.fn(),
  useCollection: jest.fn(),
}));
// 18 Nov 2026 (quarta, W47), Lisboa em hora de inverno.
jest.mock('@/data/clock', () => ({ useNow: () => new Date('2026-11-18T12:00:00Z') }));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: object) => <View {...props} /> };
});

import { useLeaderboard, useMyLeaderboardEntry } from '@/data/user';
import { useMyUser, usePublicProfile } from '@/data/hooks';
import Ranking from '../../app/(app)/ranking';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const renderScreen = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <Ranking />
    </SafeAreaProvider>,
  );
const ready = (data: unknown, fromCache?: boolean): L => ({ status: 'ready', data, fromCache });
const entry = (uid: string, points: number, displayName = `Nome ${uid}`): LeaderboardEntry => ({ uid, displayName, points });

beforeEach(() => {
  mockBoard.current = ready([entry('a', 10, 'Ana'), entry('b', 8, 'Rui'), entry('c', 8, 'Sofia'), entry('d', 5, 'Tomás')]);
  mockMine.current = { status: 'missing' };
  mockSession.current = { status: 'signedIn' };
  mockPosition.mockReset();
  mockPosition.mockResolvedValue(245);
  jest.clearAllMocks();
  mockPosition.mockResolvedValue(245);
});

describe('Ranking: filtros', () => {
  it('abre na Semana e subscreve a chave da semana', async () => {
    await renderScreen();
    expect(useLeaderboard).toHaveBeenLastCalledWith('week', '2026-W47');
    expect(useMyLeaderboardEntry).toHaveBeenLastCalledWith('week', '2026-W47', 'me');
  });

  it('Mês e Época mudam a subscrição (leaderboards/month_2026-11/entries)', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('tab', { name: 'Mês' }));
    expect(useLeaderboard).toHaveBeenLastCalledWith('month', '2026-11');
    await fireEvent.press(screen.getByRole('tab', { name: 'Época' }));
    expect(useLeaderboard).toHaveBeenLastCalledWith('season', '2026-2027');
    await fireEvent.press(screen.getByRole('tab', { name: 'Semana' }));
    expect(useLeaderboard).toHaveBeenLastCalledWith('week', '2026-W47');
  });
});

describe('Ranking: lista', () => {
  it('mostra posições com empate (1, 2, 2, 4) e só nomes públicos', async () => {
    await renderScreen();
    const rows = screen.getAllByTestId('ranking-row');
    expect(rows).toHaveLength(4);
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText('Tomás')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getAllByText('2')).toHaveLength(2);
  });

  it('nunca mostra email nem "@" e não lê o utilizador (users/publicProfiles)', async () => {
    mockMine.current = ready(entry('me', 3, 'Martim'));
    await renderScreen();
    expect(screen.queryByText(/@/)).toBeNull();
    expect(screen.queryByText(/eu@exemplo/)).toBeNull();
    expect(useMyUser).not.toHaveBeenCalled();
    expect(usePublicProfile).not.toHaveBeenCalled();
  });

  it('a linha do próprio nos 100 fica destacada e não há linha fixa', async () => {
    mockBoard.current = ready([entry('a', 10, 'Ana'), entry('me', 8, 'Martim'), entry('d', 5, 'Tomás')]);
    mockMine.current = ready(entry('me', 8, 'Martim'));
    await renderScreen();
    const rows = screen.getAllByTestId('ranking-row');
    expect(rows).toHaveLength(3);
    expect(rows.filter((r) => /^Tu,/.test(r.props.accessibilityLabel))).toHaveLength(1);
    expect(screen.queryByTestId('ranking-pinned')).toBeNull();
    expect(mockPosition).not.toHaveBeenCalled();
  });

  it('o próprio já na lista visível: sem nota "Ainda não pontuaste" mesmo que a entrada própria falte', async () => {
    mockBoard.current = ready([entry('a', 10, 'Ana'), entry('me', 8, 'Martim')]);
    mockMine.current = { status: 'missing' };
    await renderScreen();
    expect(screen.queryByText(/Ainda não pontuaste/)).toBeNull();
    expect(screen.queryByText('Não foi possível carregar a tua posição.')).toBeNull();
  });

  it('o próprio na lista e a leitura da entrada própria falha: sem nota de erro', async () => {
    mockBoard.current = ready([entry('a', 10, 'Ana'), entry('me', 8, 'Martim')]);
    mockMine.current = { status: 'error', error: new Error('x') };
    await renderScreen();
    expect(screen.queryByText('Não foi possível carregar a tua posição.')).toBeNull();
  });

  it('próprio fora dos 100: linha fixa em baixo com a posição de fetchMyPosition (245)', async () => {
    mockMine.current = ready(entry('me', 3, 'Martim'));
    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('ranking-pinned')).toBeTruthy());
    expect(mockPosition).toHaveBeenCalledWith('week', '2026-W47', 3);
    expect(screen.getByText('245')).toBeTruthy();
    expect(screen.getByText('Martim (tu)')).toBeTruthy();
    expect(screen.getAllByTestId('ranking-row')).toHaveLength(5);
  });

  it('falha ao obter a posição: aviso, sem linha fixa e sem mensagem de vazio', async () => {
    mockMine.current = ready(entry('me', 3, 'Martim'));
    mockPosition.mockRejectedValue(new Error('offline'));
    await renderScreen();
    await waitFor(() => expect(screen.getByText('Não foi possível carregar a tua posição.')).toBeTruthy());
    expect(screen.queryByTestId('ranking-pinned')).toBeNull();
    expect(screen.queryByText(/Ainda não pontuaste/)).toBeNull();
  });
});

describe('Ranking: estados', () => {
  it.each([
    ['Semana', 'nesta semana'],
    ['Mês', 'neste mês'],
    ['Época', 'nesta época'],
  ])('sem entrada própria (%s): "Ainda não pontuaste %s."', async (tab, tail) => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('tab', { name: tab }));
    expect(screen.getByText(`Ainda não pontuaste ${tail}.`)).toBeTruthy();
    expect(screen.getAllByTestId('ranking-row')).toHaveLength(4);
  });

  it.each([
    ['Semana', 'nesta semana'],
    ['Mês', 'neste mês'],
    ['Época', 'nesta época'],
  ])('lista vazia (%s): "Ainda não há pontos %s."', async (tab, tail) => {
    mockBoard.current = ready([]);
    await renderScreen();
    await fireEvent.press(screen.getByRole('tab', { name: tab }));
    expect(screen.getByText(`Ainda não há pontos ${tail}.`)).toBeTruthy();
    expect(screen.queryByTestId('ranking-row')).toBeNull();
  });

  it('a nota sobre o que conta aparece sempre que há dados', async () => {
    await renderScreen();
    expect(screen.getByText('Contam os pontos de prognósticos e votos MVP, na data do jogo.')).toBeTruthy();
  });

  it('a carregar: esqueleto, sem mensagem de vazio', async () => {
    mockBoard.current = { status: 'loading' };
    await renderScreen();
    expect(screen.getByTestId('ranking-loading')).toBeTruthy();
    expect(screen.queryByText(/Ainda não há pontos/)).toBeNull();
  });

  it('erro de leitura: estado de erro, nunca a mensagem de vazio', async () => {
    mockBoard.current = { status: 'error', error: new Error('permission-denied') };
    await renderScreen();
    expect(screen.getByText('Não foi possível carregar o ranking.')).toBeTruthy();
    expect(screen.queryByText(/Ainda não há pontos/)).toBeNull();
    expect(screen.queryByText(/Ainda não pontuaste/)).toBeNull();
  });

  it('erro na leitura da entrada própria: aviso, sem "Ainda não pontuaste"', async () => {
    mockMine.current = { status: 'error', error: new Error('unavailable') };
    await renderScreen();
    expect(screen.getByText('Não foi possível carregar a tua posição.')).toBeTruthy();
    expect(screen.queryByText(/Ainda não pontuaste/)).toBeNull();
    expect(screen.getAllByTestId('ranking-row')).toHaveLength(4);
  });

  it('em cache: aviso de sem ligação', async () => {
    mockBoard.current = ready([entry('a', 1, 'Ana')], true);
    await renderScreen();
    expect(await screen.findByText('Sem ligação. A mostrar os últimos dados guardados.', {}, { timeout: 3000 })).toBeTruthy();
  });

  it('sessão terminada: não lê a entrada própria nem mostra "Ainda não pontuaste"', async () => {
    mockSession.current = { status: 'signedOut' };
    await renderScreen();
    expect(useMyLeaderboardEntry).toHaveBeenLastCalledWith('week', '2026-W47', null);
    expect(screen.queryByText(/Ainda não pontuaste/)).toBeNull();
  });
});

describe('Ranking: nomes longos (Review Focus 4)', () => {
  const LONG = 'A'.repeat(20);
  it('nome público de 20 caracteres numa linha com reticências e pontos visíveis', async () => {
    mockBoard.current = ready([entry('a', 1234, LONG), entry('b', 12, 'Rui')]);
    await renderScreen();
    const name = screen.getByText(LONG);
    expect(name.props.numberOfLines).toBe(1);
    expect(name.props.ellipsizeMode ?? 'tail').toBe('tail');
    expect(screen.getByText('1234 pts')).toBeTruthy();
    const pts = screen.getByText('1234 pts');
    // Os pontos nunca encolhem (o nome é que cede).
    expect(JSON.stringify(pts.props.style)).toContain('"flexShrink":0');
  });

  it('o mesmo na linha fixa do próprio', async () => {
    mockMine.current = ready(entry('me', 7, LONG));
    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('ranking-pinned')).toBeTruthy());
    expect(screen.getByText(`${LONG} (tu)`).props.numberOfLines).toBe(1);
    expect(screen.getByText('245')).toBeTruthy();
    expect(screen.getByText('7 pts')).toBeTruthy();
  });
});

describe('Ranking: privacidade (frame 26)', () => {
  it('mostra só o nome público: sem avatar e sem inicial solta', async () => {
    mockBoard.current = ready([entry('a', 5, 'ana lopes')]);
    await renderScreen();
    expect(screen.getByText('ana lopes')).toBeTruthy();
    expect(screen.queryByTestId('ranking-avatar')).toBeNull();
    expect(screen.queryByText('A')).toBeNull();
    expect(useMyUser).not.toHaveBeenCalled();
    expect(usePublicProfile).not.toHaveBeenCalled();
  });
});
