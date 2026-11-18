// Task 11: tab Formações. Hooks de dados e router mockados (sem rede).
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { GameStatus, LineupPlayer, Match } from '@/data/schemas';

type L =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; data: unknown; fromCache?: boolean };
const mockDetails: { current: Record<string, L> } = { current: {} };
const mockPush = jest.fn();

jest.mock('@/data/sports', () => ({
  useMatchDetail: jest.fn((_id: string | null, kind: string) => mockDetails.current[kind] ?? { status: 'missing' }),
  useVenue: jest.fn(() => ({ status: 'missing' })),
}));
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a), replace: jest.fn(), back: jest.fn() } }));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: object) => <View {...props} /> };
});

import { LineupsTab } from '@/components/match/LineupsTab';
import { SummaryTab } from '@/components/match/SummaryTab';

function match(status: GameStatus = 'LIVE', sportingSide: 'home' | 'away' = 'home'): Match {
  const sporting = { id: '228', name: 'Sporting CP', logo: null };
  const other = { id: '217', name: 'SC Braga', logo: null };
  return {
    id: '1001',
    sport: 'football',
    competition: { key: 'football_94_2026', id: '94', name: 'Liga Portugal', type: 'league', season: '2026', round: 'Regular Season - 16', roundLabel: null },
    home: sportingSide === 'home' ? sporting : other,
    away: sportingSide === 'home' ? other : sporting,
    sportingSide,
    kickoff: new Date('2026-09-14T19:30:00Z'),
    status,
    elapsed: null,
    elapsedExtra: null,
    score: { home: null, away: null, halftime: null, extratime: null, penalty: null },
    finishedAt: null,
    venue: null,
    referee: null,
    source: { provider: 'api-football', id: '1001', attribution: null },
  } as Match;
}

const GRID_433 = ['1:1', '2:4', '2:3', '2:2', '2:1', '3:3', '3:2', '3:1', '4:3', '4:2', '4:1'];
const xi = (base: number): LineupPlayer[] =>
  GRID_433.map((grid, i) => ({ playerId: String(base + i), name: `A. Jogador${base + i}`, number: i + 1, pos: null, grid }));

const team = (teamId: string, base: number, formation: string, coach: string) => ({
  teamId,
  formation,
  coach: { id: null, name: coach, photo: null },
  startXI: xi(base),
  substitutes: [{ playerId: String(base + 50), name: `B. Suplente${base}`, number: 99, pos: 'M', grid: null }],
});

const lineups = (teams = [team('228', 100, '4-3-3', 'Rui Borges'), team('217', 200, '4-4-2', 'Carlos Vicens')]) => ({
  status: 'ready' as const,
  data: { teams },
});

const players = {
  status: 'ready' as const,
  data: {
    teams: [
      { teamId: '228', players: [{ playerId: '100', rating: 7.25 }, { playerId: '150', rating: 6.8 }] },
      { teamId: '217', players: [{ playerId: '200', rating: 6 }] },
    ],
  },
};

beforeEach(() => {
  mockDetails.current = {};
  mockPush.mockClear();
});

describe('Formações', () => {
  it('dois onzes: tática, treinador, 22 jogadores no campo, suplentes e notas', async () => {
    mockDetails.current = { lineups: lineups(), players };
    await render(<LineupsTab match={match('LIVE')} />);
    expect(screen.getByText('4-3-3')).toBeTruthy();
    expect(screen.getByText('4-4-2')).toBeTruthy();
    expect(screen.getByText('Rui Borges')).toBeTruthy();
    expect(screen.getByText('Carlos Vicens')).toBeTruthy();
    expect(screen.getAllByTestId('pitch-player')).toHaveLength(22);
    expect(screen.getByText('7,3')).toBeTruthy();
    expect(screen.getByText('6,0')).toBeTruthy();
    expect(screen.getByText('B. Suplente100')).toBeTruthy();
    expect(screen.getByText('6,8')).toBeTruthy();
    expect(screen.getAllByTestId('sub-row')).toHaveLength(2);
  });

  it('casa na metade de cima a começar no guarda-redes; fora na de baixo, guarda-redes no fim', async () => {
    mockDetails.current = { lineups: lineups() };
    await render(<LineupsTab match={match('LIVE')} />);
    const home = screen.getAllByTestId('pitch-row-home');
    const away = screen.getAllByTestId('pitch-row-away');
    expect(home).toHaveLength(4);
    expect(away).toHaveLength(4);
    const names = screen.getAllByTestId('pitch-name').map((n) => n.props.children);
    expect(names[0]).toBe('Jogador100');
    expect(names[names.length - 1]).toBe('Jogador200');
  });

  it('tocar num jogador do Sporting abre /equipa/jogador/{id}; os do adversário não são botões', async () => {
    mockDetails.current = { lineups: lineups() };
    await render(<LineupsTab match={match('LIVE')} />);
    await fireEvent.press(screen.getByLabelText('1 A. Jogador100'));
    expect(mockPush).toHaveBeenCalledWith('/equipa/jogador/100');
    await fireEvent.press(screen.getByLabelText('Suplente B. Suplente100'));
    expect(mockPush).toHaveBeenLastCalledWith('/equipa/jogador/150');
    expect(screen.getByLabelText('1 A. Jogador200').props.accessibilityRole).not.toBe('button');
    await fireEvent.press(screen.getByLabelText('1 A. Jogador200'));
    expect(mockPush).toHaveBeenCalledTimes(2);
  });

  it('Sporting fora: a equipa tocável é a de fora', async () => {
    mockDetails.current = { lineups: lineups([team('217', 200, '4-4-2', 'X'), team('228', 100, '4-3-3', 'Y')]) };
    await render(<LineupsTab match={match('LIVE', 'away')} />);
    await fireEvent.press(screen.getByLabelText('1 A. Jogador100'));
    expect(mockPush).toHaveBeenCalledWith('/equipa/jogador/100');
  });

  it('sem documento lineups (Review Focus 1): campo vazio e quando saem os onzes', async () => {
    await render(<LineupsTab match={match('NS')} />);
    expect(screen.getByText('Os onzes são conhecidos cerca de uma hora antes do jogo.')).toBeTruthy();
    expect(screen.getByTestId('pitch')).toBeTruthy();
    expect(screen.queryAllByTestId('pitch-player')).toHaveLength(0);
  });

  it('documento com teams vazio: a mesma explicação', async () => {
    mockDetails.current = { lineups: lineups([]) };
    await render(<LineupsTab match={match('NS')} />);
    expect(screen.getByText('Os onzes são conhecidos cerca de uma hora antes do jogo.')).toBeTruthy();
  });

  it('terminado sem documento: sem formações', async () => {
    await render(<LineupsTab match={match('FT')} />);
    expect(screen.getByText('Sem formações para este jogo.')).toBeTruthy();
  });

  it('só uma equipa (Review Focus 1): mostra essa e "Onze ainda não disponível." na outra', async () => {
    mockDetails.current = { lineups: lineups([team('228', 100, '4-3-3', 'Rui Borges')]), players };
    await render(<LineupsTab match={match('LIVE')} />);
    expect(screen.getByText('4-3-3')).toBeTruthy();
    expect(screen.getAllByTestId('pitch-player')).toHaveLength(11);
    expect(screen.getAllByText('Onze ainda não disponível.')).toHaveLength(1);
    expect(screen.getByText('SC Braga')).toBeTruthy();
  });

  it('nome longo com três apelidos (Review Focus 4): uma linha com reticências', async () => {
    const t = team('228', 100, '4-3-3', 'Rui Borges');
    t.startXI[0] = { ...t.startXI[0]!, name: 'P. Gonçalves dos Santos Silva' };
    t.substitutes[0] = { ...t.substitutes[0]!, name: 'Francisco Gonçalves dos Santos Trincão' };
    mockDetails.current = { lineups: lineups([t, team('217', 200, '4-4-2', 'X')]) };
    await render(<LineupsTab match={match('LIVE')} />);
    const onPitch = screen.getByText('Gonçalves dos Santos Silva');
    expect(onPitch.props.numberOfLines).toBe(1);
    expect(onPitch.props.ellipsizeMode ?? 'tail').toBe('tail');
    expect(screen.getByText('Francisco Gonçalves dos Santos Trincão').props.numberOfLines).toBe(1);
  });

  it('leitura falhada: estado de erro, nunca a mensagem de vazio', async () => {
    mockDetails.current = { lineups: { status: 'error', error: new Error('x') } };
    await render(<LineupsTab match={match('NS')} />);
    expect(screen.getByText('Não foi possível carregar os dados.')).toBeTruthy();
    expect(screen.queryByText('Os onzes são conhecidos cerca de uma hora antes do jogo.')).toBeNull();
  });

  it('a carregar: esqueleto, sem mensagens', async () => {
    mockDetails.current = { lineups: { status: 'loading' } };
    await render(<LineupsTab match={match('NS')} />);
    expect(screen.getByTestId('lineups-loading')).toBeTruthy();
    expect(screen.queryByText('Os onzes são conhecidos cerca de uma hora antes do jogo.')).toBeNull();
  });

  it('dados da cache mostram o aviso sem ligação', async () => {
    mockDetails.current = { lineups: { ...lineups(), fromCache: true } };
    await render(<LineupsTab match={match('LIVE')} />);
    expect(screen.getByTestId('offline-banner')).toBeTruthy();
  });

  it('jogadores com o mesmo playerId repetido: sem avisos de chave duplicada', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const t = team('228', 100, '4-3-3', 'Rui Borges');
    t.substitutes = [t.substitutes[0]!, { ...t.substitutes[0]! }];
    mockDetails.current = { lineups: lineups([t, team('217', 200, '4-4-2', 'X')]) };
    await render(<LineupsTab match={match('LIVE')} />);
    expect(spy.mock.calls.filter((c) => String(c[0]).includes('same key'))).toHaveLength(0);
    spy.mockRestore();
  });
});

describe('Sumário: pré-jogo falhado com lesionados (revisão da Task 10)', () => {
  it('mostra o erro do pré-jogo, não "Pré-jogo ainda não disponível.", e os lesionados', async () => {
    mockDetails.current = {
      prematch: { status: 'error', error: new Error('x') },
      injuries: {
        status: 'ready',
        data: { fetchedAt: new Date(), items: [{ teamId: '228', playerId: 'p1', name: 'Nuno Santos', photo: null, type: 'Missing Fixture', reason: 'Knee Injury' }] },
      },
    };
    await render(<SummaryTab match={match('NS')} />);
    expect(screen.getByText('Não foi possível carregar os dados.')).toBeTruthy();
    expect(screen.queryByText('Pré-jogo ainda não disponível.')).toBeNull();
    expect(screen.getByText('Nuno Santos')).toBeTruthy();
  });
});
