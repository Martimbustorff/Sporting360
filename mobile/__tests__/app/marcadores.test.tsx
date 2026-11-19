// Task 12: ecrã /equipa/marcadores (frame 11). Hooks de dados mockados.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

type L = { status: 'loading' } | { status: 'error'; error: Error } | { status: 'ready'; data: unknown; fromCache?: boolean };
const mockStats: { current: L } = { current: { status: 'loading' } };
const mockPush = jest.fn();

jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a), back: jest.fn() } }));
jest.mock('@/data/sports', () => ({
  usePlayerStats: jest.fn(() => mockStats.current),
  useTeamData: jest.fn(() => ({ status: 'ready', data: { players: [{ id: '1', position: 'Attacker' }] } })),
}));
jest.mock('@/data/clock', () => ({ useNow: () => new Date('2026-11-18T12:00:00Z') }));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: object) => <View {...props} /> };
});

import Marcadores from '../../app/(app)/equipa/marcadores';

const METRICS = { frame: { x: 0, y: 0, width: 320, height: 568 }, insets: { top: 20, left: 0, right: 0, bottom: 0 } };
const wrap = () => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <Marcadores />
  </SafeAreaProvider>
);
const lg = (appearances: number, minutes: number, goals: number, assists: number) => ({ appearances, minutes, goals, assists });
const pl = (id: string, name: string, byLeague: Record<string, ReturnType<typeof lg>>) => {
  const v = Object.values(byLeague);
  const s = (k: 'appearances' | 'minutes' | 'goals' | 'assists') => v.reduce((n, l) => n + l[k], 0);
  return { id, name, photo: null, appearances: s('appearances'), minutes: s('minutes'), goals: s('goals'), assists: s('assists'), rating: null, yellow: 0, red: 0, byLeague };
};
const LONG = 'Francisco Domingos Trincão de Albuquerque Sousa';
const players = [
  pl('1', 'Gyökeres', { '94': lg(10, 870, 10, 2), '2': lg(4, 300, 4, 1) }),
  pl('2', LONG, { '94': lg(10, 700, 5, 5) }),
  pl('3', 'Pote', { '94': lg(10, 750, 2, 6) }),
];
const ready = (ps: unknown[]) => {
  mockStats.current = { status: 'ready', data: { players: ps } };
};

beforeEach(() => mockPush.mockClear());

describe('/equipa/marcadores', () => {
  it('líder com minutos por golo, ordem e chips só das competições com dados', async () => {
    ready(players);
    await render(wrap());
    expect(screen.getByText('Melhor marcador')).toBeTruthy();
    expect(screen.getByLabelText(/Gyökeres, 14 Golos, AV, 14 jogos, 1 golo a cada 84 min/)).toBeTruthy();
    expect(screen.getByTestId('chip-all')).toBeTruthy();
    expect(screen.getByTestId('chip-champions')).toBeTruthy();
    expect(screen.queryByTestId('chip-cups')).toBeNull();
    expect(screen.getByTestId('leader-row-2')).toBeTruthy();
  });

  it('o filtro muda o líder e a métrica reordena', async () => {
    ready(players);
    await render(wrap());
    await fireEvent.press(screen.getByTestId('chip-champions'));
    expect(screen.queryByTestId('leader-row-2')).toBeNull();
    await fireEvent.press(screen.getByTestId('chip-all'));
    await fireEvent.press(screen.getByTestId('metric-assists'));
    expect(screen.getByText('Melhor assistente')).toBeTruthy();
    expect(screen.getByLabelText(/Melhor assistente: Pote, 6 Assistências/)).toBeTruthy();
  });

  it('documento antigo sem byLeague: só "Todas" (sem chips) e os totais funcionam', async () => {
    ready(players.map(({ byLeague: _b, ...p }) => p));
    await render(wrap());
    expect(screen.queryByTestId('chip-league')).toBeNull();
    expect(screen.queryByTestId('chip-all')).toBeNull();
    expect(screen.getByTestId('leader-card')).toBeTruthy();
  });

  it('nome longo a 320 pt fica numa linha com reticências', async () => {
    ready(players);
    await render(wrap());
    expect(screen.getByText(LONG).props.numberOfLines).toBe(1);
  });

  it('erro de leitura mostra o erro', async () => {
    mockStats.current = { status: 'error', error: new Error('x') };
    await render(wrap());
    expect(screen.getByText('Não foi possível carregar os dados.')).toBeTruthy();
  });

  it('sem jogadores mostra o vazio', async () => {
    ready([]);
    await render(wrap());
    expect(screen.getByText('Sem estatísticas de jogadores nesta época.')).toBeTruthy();
  });

  it('toque na linha abre o jogador', async () => {
    ready(players);
    await render(wrap());
    await fireEvent.press(screen.getByTestId('leader-row-3'));
    expect(mockPush).toHaveBeenCalledWith('/equipa/jogador/3');
  });
});
