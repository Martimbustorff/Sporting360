// Task 13: ecrã da competição (Classificação, Jornadas, Marcadores, Assistências, Cartões).
// Hooks de dados mockados (sem rede); a Classificação é a `CompetitionStandings` da Task 12 (mockada aqui).
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { FixtureItem, TopListItem } from '@/data/schemas';

type L =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; data: unknown; fromCache?: boolean };

const mockParams: { current: Record<string, string> } = { current: { key: 'football_94_2026' } };
const mockData: Record<string, L> = {};
const mockCompetition: { current: L } = { current: { status: 'loading' } };
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams.current,
  router: { push: (...a: unknown[]) => mockPush(...a), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
}));
jest.mock('@/data/sports', () => ({
  useCompetition: jest.fn(() => mockCompetition.current),
  useCompetitionData: jest.fn((_key: string | null, kind: string) => mockData[kind] ?? { status: 'missing' }),
}));
jest.mock('@/components/CompetitionStandings', () => ({
  CompetitionStandings: (props: { competitionKey: string; showCompetitionLink?: boolean }) => {
    const { Text: T } = require('react-native');
    return <T testID="standings-stub">{`${props.competitionKey} link=${String(props.showCompetitionLink)}`}</T>;
  },
}));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: object) => <View {...props} /> };
});

import Competicao from '../../app/(app)/competicao/[key]';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const ui = () => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <Competicao />
  </SafeAreaProvider>
);
const ready = (data: unknown): L => ({ status: 'ready', data });

const competition = (type: 'league' | 'cup' | 'europe', name: string, leagueId: string) =>
  ready({ sport: 'football', leagueId, name, type, logo: null });

const KICKOFF = new Date('2026-11-22T20:30:00Z');
function fixture(id: string, round: string, home: [string, string], away: [string, string], over: Partial<FixtureItem> = {}): FixtureItem {
  return {
    id,
    kickoff: KICKOFF,
    round,
    roundLabel: null,
    home: { id: home[0], name: home[1], logo: null },
    away: { id: away[0], name: away[1], logo: null },
    status: 'NS',
    score: { home: null, away: null, extraHome: null, extraAway: null, penaltyHome: null, penaltyAway: null },
    ...over,
  };
}

const leagueRounds = {
  items: [
    { raw: 'Regular Season - 10', label: 'J10' },
    { raw: 'Regular Season - 11', label: 'J11' },
    { raw: 'Regular Season - 12', label: 'J12' },
  ],
  current: 'Regular Season - 11',
};
const leagueFixtures = {
  items: [
    fixture('10a', 'Regular Season - 10', ['228', 'Sporting CP'], ['217', 'SC Braga']),
    fixture('11a', 'Regular Season - 11', ['212', 'FC Porto'], ['211', 'SL Benfica']),
    fixture('11b', 'Regular Season - 11', ['228', 'Sporting CP'], ['222', 'Boavista']),
    fixture('12a', 'Regular Season - 12', ['230', 'Estoril'], ['228', 'Sporting CP']),
  ],
};

function top(playerId: string, name: string, value: number, teamName = 'Sporting CP'): TopListItem {
  return { playerId, name, photo: `https://media.api-sports.io/football/players/${playerId}.png`, teamId: '228', teamName, teamLogo: null, value };
}

beforeEach(() => {
  mockPush.mockClear();
  mockParams.current = { key: 'football_94_2026' };
  for (const k of Object.keys(mockData)) delete mockData[k];
  mockCompetition.current = competition('league', 'Liga Portugal', '94');
});

const openTab = async (name: string) => fireEvent.press(screen.getByRole('tab', { name }));
const roundLabel = () => screen.getByTestId('round-label');

describe('estrutura', () => {
  it('liga: título com o nome e as cinco tabs; Classificação embebida sem "Ver competição" (F10)', async () => {
    await render(ui());
    expect(screen.getByRole('header', { name: 'Liga Portugal' })).toBeTruthy();
    for (const t of ['Classificação', 'Jornadas', 'Marcadores', 'Assistências', 'Cartões']) {
      expect(screen.getByRole('tab', { name: t })).toBeTruthy();
    }
    expect(screen.getByTestId('standings-stub').props.children).toBe('football_94_2026 link=false');
  });

  it('Taça de Portugal: sem Marcadores, Assistências nem Cartões', async () => {
    mockParams.current = { key: 'football_96_2026' };
    mockCompetition.current = competition('cup', 'Taça de Portugal', '96');
    await render(ui());
    expect(screen.getByRole('tab', { name: 'Classificação' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Jornadas' })).toBeTruthy();
    for (const t of ['Marcadores', 'Assistências', 'Cartões']) expect(screen.queryByRole('tab', { name: t })).toBeNull();
  });

  it('competição em falta: mensagem; leitura falhada: erro', async () => {
    mockCompetition.current = { status: 'missing' };
    const { rerender } = await render(ui());
    expect(screen.getByText('Competição não encontrada.')).toBeTruthy();
    mockCompetition.current = { status: 'error', error: new Error('x') };
    await rerender(ui());
    expect(screen.getByText('Não foi possível carregar os dados.')).toBeTruthy();
  });
});

describe('Jornadas', () => {
  beforeEach(() => {
    mockData.rounds = ready(leagueRounds);
    mockData.fixtures = ready(leagueFixtures);
  });

  it('abre na ronda `current` e mostra só os jogos dessa ronda', async () => {
    await render(ui());
    await openTab('Jornadas');
    expect(roundLabel().props.children).toBe('J11');
    expect(screen.getByTestId('match-row-11a')).toBeTruthy();
    expect(screen.getByTestId('match-row-11b')).toBeTruthy();
    expect(screen.queryByTestId('match-row-10a')).toBeNull();
  });

  it('mudar de ronda filtra os jogos; nos extremos o botão fica desativado', async () => {
    await render(ui());
    await openTab('Jornadas');
    await fireEvent.press(screen.getByRole('button', { name: 'Ronda seguinte' }));
    expect(roundLabel().props.children).toBe('J12');
    expect(screen.getByTestId('match-row-12a')).toBeTruthy();
    expect(screen.queryByTestId('match-row-11a')).toBeNull();
    expect(screen.getByRole('button', { name: 'Ronda seguinte' }).props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Ronda anterior' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Ronda anterior' }));
    expect(roundLabel().props.children).toBe('J10');
    expect(screen.getByTestId('match-row-10a')).toBeTruthy();
  });

  it('só os jogos do Sporting abrem o detalhe; os outros não são botão nem têm seta (F9)', async () => {
    await render(ui());
    await openTab('Jornadas');
    const other = screen.getByTestId('match-row-11a');
    expect(other.props.accessibilityRole).toBeUndefined();
    expect(within(other).queryByTestId('row-arrow', { includeHiddenElements: true })).toBeNull();
    await fireEvent.press(screen.getByTestId('match-row-11b'));
    expect(mockPush).toHaveBeenCalledWith('/jogo/11b');
  });

  it('Taça: fixtureToMatch dá uma MatchRow com "16 avos de final"', async () => {
    mockParams.current = { key: 'football_96_2026' };
    mockCompetition.current = competition('cup', 'Taça de Portugal', '96');
    mockData.rounds = ready({ items: [{ raw: 'Round of 32', label: '16 avos de final' }], current: 'Round of 32' });
    mockData.fixtures = ready({ items: [fixture('3001', 'Round of 32', ['762', 'Gil Vicente'], ['228', 'Sporting CP'])] });
    await render(ui());
    await openTab('Jornadas');
    expect(roundLabel().props.children).toBe('16 avos de final');
    const row = screen.getByTestId('match-row-3001');
    expect(row.props.accessibilityLabel).toBe('Gil Vicente contra Sporting CP. Taça de Portugal, 16 avos de final. Próximo');
  });

  it('ronda com etiqueta vazia: traduz o texto da API, nunca a ronda em inglês', async () => {
    mockParams.current = { key: 'football_96_2026' };
    mockCompetition.current = competition('cup', 'Taça de Portugal', '96');
    mockData.rounds = ready({ items: [{ raw: 'Quarter-finals', label: '' }], current: 'Quarter-finals' });
    mockData.fixtures = ready({ items: [] });
    await render(ui());
    await openTab('Jornadas');
    expect(roundLabel().props.children).toBe('Quartos de final');
  });

  it('sem `current` abre na última ronda', async () => {
    mockData.rounds = ready({ ...leagueRounds, current: null });
    await render(ui());
    await openTab('Jornadas');
    expect(roundLabel().props.children).toBe('J12');
  });

  it('ronda sem jogos: mensagem de vazio; leitura falhada: erro, nunca o vazio', async () => {
    mockData.fixtures = ready({ items: [] });
    const { rerender } = await render(ui());
    await openTab('Jornadas');
    expect(screen.getByText('Sem jogos nesta ronda.')).toBeTruthy();
    mockData.fixtures = { status: 'error', error: new Error('x') };
    await rerender(ui());
    expect(screen.getByText('Não foi possível carregar os dados.')).toBeTruthy();
    expect(screen.queryByText('Sem jogos nesta ronda.')).toBeNull();
  });

  it('sem rondas: mensagem de vazio', async () => {
    mockData.rounds = { status: 'missing' };
    await render(ui());
    await openTab('Jornadas');
    expect(screen.getByText('Sem jornadas para esta competição.')).toBeTruthy();
  });
});

describe('tops', () => {
  it('Marcadores: 3 itens pela ordem do documento, com posição, foto, nome, equipa e valor', async () => {
    mockData.topscorers = ready({
      items: [top('1', 'Viktor Gyökeres', 14), top('2', 'Samu Aghehowa', 11, 'FC Porto'), top('3', 'Vangelis Pavlidis', 9, 'SL Benfica')],
    });
    await render(ui());
    await openTab('Marcadores');
    const rows = screen.getAllByTestId(/^top-row-/);
    expect(rows.map((r) => r.props.testID)).toEqual(['top-row-1', 'top-row-2', 'top-row-3']);
    expect(rows[0]!.props.accessibilityLabel).toBe('1.º Viktor Gyökeres, Sporting CP, 14');
    expect(within(rows[1]!).getByText('FC Porto')).toBeTruthy();
    expect(within(rows[2]!).getByText('9')).toBeTruthy();
    expect(screen.getByTestId('top-photo-1', { includeHiddenElements: true }).props.source).toEqual({
      uri: 'https://media.api-sports.io/football/players/1.png',
    });
  });

  it('nome longo numa linha com reticências; o valor não encolhe', async () => {
    const long = 'Francisco Trincão Fernandes da Silva Junior';
    mockData.topassists = ready({ items: [top('9', long, 7)] });
    await render(ui());
    await openTab('Assistências');
    const name = screen.getByText(long);
    expect(name.props.numberOfLines).toBe(1);
    expect(name.props.ellipsizeMode).toBe('tail');
    expect(StyleSheet.flatten(screen.getByTestId('top-value-9').props.style)).toMatchObject({ flexShrink: 0 });
  });

  it('Cartões: Amarelos por omissão e Vermelhos ao escolher', async () => {
    mockData.topyellowcards = ready({ items: [top('5', 'Morita', 6)] });
    mockData.topredcards = ready({ items: [top('6', 'Diomande', 1)] });
    await render(ui());
    await openTab('Cartões');
    expect(screen.getByRole('tab', { name: 'Amarelos' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('top-row-5')).toBeTruthy();
    await openTab('Vermelhos');
    expect(screen.getByTestId('top-row-6')).toBeTruthy();
    expect(screen.queryByTestId('top-row-5')).toBeNull();
  });

  it('lista vazia: mensagem; leitura falhada: erro, nunca o vazio', async () => {
    mockData.topscorers = ready({ items: [] });
    const { rerender } = await render(ui());
    await openTab('Marcadores');
    expect(screen.getByText('Sem dados para esta competição.')).toBeTruthy();
    mockData.topscorers = { status: 'error', error: new Error('x') };
    await rerender(ui());
    expect(screen.getByText('Não foi possível carregar os dados.')).toBeTruthy();
    expect(screen.queryByText('Sem dados para esta competição.')).toBeNull();
  });
});
