// Task 14: ecrãs da equipa (/equipa) e do jogador (/equipa/jogador/[id]). Hooks de dados mockados (sem rede).
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { PlayerSeasonStats, SquadPlayer, TeamStatsDoc } from '@/data/schemas';

type L =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; data: unknown; fromCache?: boolean };

const mockTeam: Record<string, L> = {};
const mockStats: { current: L } = { current: { status: 'missing' } };
const mockTeamStats: Record<string, L> = {};
const mockComps: { current: L } = { current: { status: 'missing' } };
const mockParams: { current: Record<string, string> } = { current: {} };
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams.current,
  router: { push: (...a: unknown[]) => mockPush(...a), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
}));
jest.mock('@/data/sports', () => ({
  useTeamData: jest.fn((kind: string) => mockTeam[kind] ?? { status: 'missing' }),
  usePlayerStats: jest.fn(() => mockStats.current),
  useTeamStats: jest.fn((leagueId: string) => mockTeamStats[leagueId] ?? { status: 'missing' }),
  useSeasonFootballCompetitions: jest.fn(() => mockComps.current),
}));
// 18 Nov 2026: época de futebol 2026 (regra de agosto do servidor, preflight F2).
jest.mock('@/data/clock', () => ({ useNow: () => new Date('2026-11-18T12:00:00Z') }));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: object) => <View {...props} /> };
});

import { usePlayerStats, useTeamStats } from '@/data/sports';
import Equipa from '../../app/(app)/equipa/index';
import Jogador from '../../app/(app)/equipa/jogador/[id]';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (el: React.ReactElement) => <SafeAreaProvider initialMetrics={METRICS}>{el}</SafeAreaProvider>;
const ready = (data: unknown): L => ({ status: 'ready', data });
const ERROR = 'Não foi possível carregar os dados.';
const SECTION_ERROR = 'Não foi possível carregar esta secção.';

const player = (id: string, name: string, position: string, number: number | null): SquadPlayer => ({
  id,
  name,
  age: 24,
  number,
  position,
  photo: `https://media.api-sports.io/football/players/${id}.png`,
});
const LONG = 'Francisco Domingos Trincão de Albuquerque Sousa';
const squad = {
  players: [
    player('9', 'Viktor Gyökeres', 'Attacker', 9),
    player('1', 'Rui Silva', 'Goalkeeper', 1),
    player('72', 'Eduardo Quaresma', 'Defender', 72),
    player('5', 'Hidemasa Morita', 'Midfielder', 5),
    player('26', 'Ousmane Diomande', 'Defender', 26),
    player('17', LONG, 'Attacker', 17),
  ],
};
const coach = { id: '900', name: 'Rui Borges', age: 44, nationality: 'Portugal', photo: null, since: '2024-12-26' };
const injuries = {
  items: [
    { playerId: '26', name: 'Ousmane Diomande', photo: null, type: 'Missing Fixture', reason: 'Knee Injury', fixtureId: '1', date: null },
    { playerId: '26', name: 'Ousmane Diomande', photo: null, type: 'Missing Fixture', reason: 'Knee Injury', fixtureId: '2', date: null },
  ],
};
const line = (id: string, name: string, over: Partial<PlayerSeasonStats> = {}): PlayerSeasonStats => ({
  id,
  name,
  photo: null,
  appearances: 12,
  minutes: 1010,
  goals: 0,
  assists: 0,
  rating: 7.04,
  yellow: 1,
  red: 0,
  byLeague: {},
  ...over,
});
const split = (home: number, away: number) => ({ home, away, total: home + away });
const minute = (vals: number[]) =>
  Object.fromEntries(['0-15', '16-30', '31-45', '46-60', '61-75', '76-90'].map((k, i) => [k, { total: vals[i] ?? 0, percentage: null }]));
const leagueStats: TeamStatsDoc = {
  form: 'WWDLW',
  goals: { for: { total: split(14, 9), minute: minute([1, 2, 3, 4, 5, 8]) }, against: { total: split(3, 5), minute: minute([0, 1, 1, 2, 2, 2]) } },
  fixtures: { played: split(6, 6) },
  cleanSheet: split(4, 2),
  failedToScore: split(0, 1),
};
const competitions = [
  { key: 'football_94_2026', leagueId: '94', name: 'Liga Portugal', type: 'league' },
  { key: 'football_2_2026', leagueId: '2', name: 'Liga dos Campeões', type: 'europe' },
];

beforeEach(() => {
  mockPush.mockClear();
  for (const k of Object.keys(mockTeam)) delete mockTeam[k];
  for (const k of Object.keys(mockTeamStats)) delete mockTeamStats[k];
  mockTeam.squad = ready(squad);
  mockTeam.coach = ready(coach);
  mockTeam.injuries = ready(injuries);
  mockStats.current = ready({ players: [line('9', 'Viktor Gyökeres', { goals: 15, assists: 3 }), line('5', 'Hidemasa Morita', { goals: 2 })] });
  mockComps.current = ready(competitions);
  mockTeamStats['94'] = ready(leagueStats);
  mockParams.current = {};
});

const openTab = (name: string) => fireEvent.press(screen.getByRole('tab', { name }));

describe('/equipa: Plantel', () => {
  it('treinador no topo, indisponíveis (um por jogador) e grupos por posição pela ordem e por número', async () => {
    await render(wrap(<Equipa />));
    for (const t of ['Plantel', 'Estatísticas', 'Transferências', 'Troféus']) expect(screen.getByRole('tab', { name: t })).toBeTruthy();
    const labels = screen.getAllByTestId('section-bar').map((b) => within(b).getByRole('header').props.children);
    expect(labels).toEqual(['Treinador', 'Indisponíveis', 'Guarda-redes', 'Defesas', 'Médios', 'Avançados']);
    expect(screen.getByText('Rui Borges')).toBeTruthy();
    expect(screen.getAllByLabelText('Ousmane Diomande, Fora, Lesão no joelho')).toHaveLength(1);
    const rows = screen.getAllByTestId(/^squad-row-/).map((r) => r.props.testID);
    expect(rows).toEqual(['squad-row-1', 'squad-row-26', 'squad-row-72', 'squad-row-5', 'squad-row-9', 'squad-row-17']);
    expect(within(screen.getByTestId('squad-row-72')).getByText('72')).toBeTruthy();
  });

  it('nacionalidade do treinador em pt-PT; desconhecida fica escondida, nunca em inglês', async () => {
    mockTeam.coach = ready({ ...coach, nationality: 'Netherlands' });
    await render(wrap(<Equipa />));
    expect(screen.getByText('Países Baixos · desde 26 Dez 2024')).toBeTruthy();
    expect(screen.queryByText('Netherlands')).toBeNull();
    mockTeam.coach = ready({ ...coach, nationality: 'Ivory Coast' });
    await render(wrap(<Equipa />));
    expect(screen.getByText('Rui Borges')).toBeTruthy();
    expect(screen.queryByText(/Ivory Coast/)).toBeNull();
    expect(screen.getByText('desde 26 Dez 2024')).toBeTruthy();
  });

  it('toque num jogador abre /equipa/jogador/{id}; nome longo numa linha com reticências', async () => {
    await render(wrap(<Equipa />));
    const name = screen.getByText(LONG);
    expect(name.props.numberOfLines).toBe(1);
    expect(name.props.ellipsizeMode).toBe('tail');
    await fireEvent.press(screen.getByTestId('squad-row-17'));
    expect(mockPush).toHaveBeenCalledWith('/equipa/jogador/17');
  });

  it('indisponíveis ou treinador a falhar: só a secção mostra o erro, o plantel fica', async () => {
    mockTeam.injuries = { status: 'error', error: new Error('x') };
    mockTeam.coach = { status: 'error', error: new Error('x') };
    await render(wrap(<Equipa />));
    expect(screen.getAllByText(SECTION_ERROR)).toHaveLength(2);
    expect(screen.queryByText(ERROR)).toBeNull();
    expect(screen.getByTestId('squad-row-9')).toBeTruthy();
    expect(screen.getByText('Indisponíveis')).toBeTruthy();
  });

  it('leitura falhada: erro (nunca o vazio); sem plantel: mensagem', async () => {
    mockTeam.squad = { status: 'error', error: new Error('x') };
    const { rerender } = await render(wrap(<Equipa />));
    expect(screen.getByText(ERROR)).toBeTruthy();
    expect(screen.queryByText('Plantel ainda não disponível.')).toBeNull();
    mockTeam.squad = { status: 'missing' };
    await rerender(wrap(<Equipa />));
    expect(screen.getByText('Plantel ainda não disponível.')).toBeTruthy();
  });
});

describe('/equipa: PlayerPhoto, etiquetas e 44 pt (V7.1)', () => {
  const photos = (el: Parameters<typeof within>[0]) => within(el).getAllByTestId('player-photo-image', { includeHiddenElements: true });

  it('Plantel: cada linha tem PlayerPhoto de 36 com o número; treinador sem número; indisponível com etiqueta Lesão', async () => {
    mockTeam.coach = ready({ ...coach, photo: 'https://media.api-sports.io/football/coachs/900.png' });
    await render(wrap(<Equipa />));
    const row = screen.getByTestId('squad-row-9');
    expect(photos(row)).toHaveLength(1);
    expect(within(row).getByTestId('player-number', { includeHiddenElements: true })).toBeTruthy();
    expect(within(screen.getByLabelText('Treinador: Rui Borges')).queryByTestId('player-number', { includeHiddenElements: true })).toBeNull();
    const out = screen.getByLabelText('Ousmane Diomande, Fora, Lesão no joelho');
    expect(within(out).getByText('Lesão')).toBeTruthy();
    expect(within(out).queryByText('Dúvida')).toBeNull();
  });

  it('indisponível "Questionable": etiqueta Dúvida', async () => {
    mockTeam.injuries = ready({ items: [{ playerId: '26', name: 'Ousmane Diomande', photo: null, type: 'Questionable', reason: 'Knee Injury', fixtureId: '1', date: null }] });
    await render(wrap(<Equipa />));
    expect(screen.getByText('Dúvida')).toBeTruthy();
    expect(screen.queryByText('Lesão')).toBeNull();
  });

  it('a linha do plantel e a do jogador nas estatísticas têm pelo menos 44 pt de altura mínima', async () => {
    await render(wrap(<Equipa />));
    await openTab('Estatísticas');
    expect(StyleSheet.flatten(screen.getByTestId('stats-row-9').props.style).minHeight).toBeGreaterThanOrEqual(44);
    expect(StyleSheet.flatten(screen.getByTestId('link-marcadores').props.style).minHeight).toBeGreaterThanOrEqual(44);
  });

  it('Estatísticas: tabela de jogadores com PlayerPhoto de 24 em cada linha (silhueta sem foto)', async () => {
    mockStats.current = ready({
      players: [line('9', 'Viktor Gyökeres', { goals: 15, photo: 'https://media.api-sports.io/football/players/9.png' }), line('5', 'Hidemasa Morita', { goals: 2 })],
    });
    await render(wrap(<Equipa />));
    await openTab('Estatísticas');
    const withPhoto = within(screen.getByTestId('stats-row-9')).getByTestId('player-photo-image', { includeHiddenElements: true });
    expect(StyleSheet.flatten(withPhoto.props.style)).toMatchObject({ width: 24, height: 24 });
    expect(within(screen.getByTestId('stats-row-5')).getByTestId('player-silhouette', { includeHiddenElements: true })).toBeTruthy();
  });

  it('Estatísticas: barras por período proporcionais ao máximo (63 pt) e cartão Casa/Fora/Total', async () => {
    await render(wrap(<Equipa />));
    await openTab('Estatísticas');
    expect(StyleSheet.flatten(screen.getByTestId('period-bar-76-90').props.style).height).toBe(63);
    expect(StyleSheet.flatten(screen.getByTestId('period-bar-0-15').props.style).height).toBe(8);
    expect(within(screen.getByTestId('split-card')).getByText('Casa', { includeHiddenElements: true })).toBeTruthy();
  });

  it('Estatísticas a 320 pt: nome muito longo na tabela de jogadores numa linha com reticências e as colunas não encolhem', async () => {
    mockStats.current = ready({ players: [line('17', LONG, { goals: 4, assists: 12, minutes: 12345, appearances: 33 })] });
    await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 320, height: 640 }, insets: { top: 20, left: 0, right: 0, bottom: 0 } }}>
        <Equipa />
      </SafeAreaProvider>,
    );
    await openTab('Estatísticas');
    const row = screen.getByTestId('stats-row-17');
    const name = within(row).getByText(LONG);
    expect(name.props.numberOfLines).toBe(1);
    expect(name.props.ellipsizeMode).toBe('tail');
    for (const v of ['33', '12345', '4', '12', '7,0']) {
      expect(StyleSheet.flatten(within(row).getByText(v).props.style)).toMatchObject({ flexShrink: 0 });
    }
  });

  it('Troféus: jogadores com PlayerPhoto e número; treinador com o ícone do troféu', async () => {
    const t = (league: string, season: string) => ({ league, country: 'Portugal', season, place: 'Winner' });
    mockTeam.trophies = ready({ coach: [t('Primeira Liga', '2024/2025')], byPlayer: { '9': [t('Primeira Liga', '2023/2024')] } });
    await render(wrap(<Equipa />));
    await openTab('Troféus');
    expect(photos(screen.getByTestId('trophy-player-9'))).toHaveLength(1);
    expect(within(screen.getByTestId('trophy-player-9')).getByTestId('player-number', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('trophy-icon', { includeHiddenElements: true })).toBeTruthy();
  });

  it('Transferências: sem emblema do outro clube, etiqueta de direção e data à direita', async () => {
    mockTeam.transfers = ready({
      items: [{ playerId: '1', name: 'Jogador Novo', date: '2026-07-01', type: 'Loan', direction: 'in', in: { id: '228', name: 'Sporting CP', logo: null }, out: { id: '217', name: 'SC Braga', logo: 'https://x/217.png' } }],
    });
    await render(wrap(<Equipa />));
    await openTab('Transferências');
    const row = screen.getByTestId('transfer-row-0');
    expect(within(row).getByText('Entrada')).toBeTruthy();
    expect(within(row).queryByTestId('player-photo-image', { includeHiddenElements: true })).toBeNull();
  });
});

describe('/equipa: Estatísticas', () => {
  it('por competição: forma, golos em casa e fora, períodos e jogos sem sofrer; jogadores por golos', async () => {
    await render(wrap(<Equipa />));
    await openTab('Estatísticas');
    expect(useTeamStats).toHaveBeenLastCalledWith('94', '2026');
    expect(usePlayerStats).toHaveBeenLastCalledWith('2026');
    expect(screen.getByRole('tab', { name: 'Liga Portugal', selected: true })).toBeTruthy();
    expect(screen.getByLabelText('Forma: V V E D V')).toBeTruthy();
    expect(screen.getByLabelText('Marcados: casa 14, fora 9, total 23')).toBeTruthy();
    expect(screen.getByLabelText('Sofridos: casa 3, fora 5, total 8')).toBeTruthy();
    expect(screen.getByLabelText('Jogos sem sofrer: casa 4, fora 2, total 6')).toBeTruthy();
    expect(screen.getByLabelText('0-15: marcados 1, sofridos 0')).toBeTruthy();
    expect(screen.getByLabelText('76-90: marcados 8, sofridos 2')).toBeTruthy();
    expect(screen.queryByText('91-105')).toBeNull();
    const players = screen.getAllByTestId(/^stats-row-/).map((r) => r.props.testID);
    expect(players).toEqual(['stats-row-9', 'stats-row-5']);
    expect(screen.getByLabelText('Viktor Gyökeres: 12 jogos, 1010 minutos, 15 golos, 3 assistências, nota 7,0')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('stats-row-9'));
    expect(mockPush).toHaveBeenCalledWith('/equipa/jogador/9');
  });

  it('ligação "Ver marcadores" abre os marcadores', async () => {
    await render(wrap(<Equipa />));
    await openTab('Estatísticas');
    await fireEvent.press(screen.getByRole('link', { name: 'Ver marcadores' }));
    expect(mockPush).toHaveBeenCalledWith('/equipa/marcadores');
  });

  it('outra competição sem estatísticas: mensagem; leitura falhada: erro', async () => {
    await render(wrap(<Equipa />));
    await openTab('Estatísticas');
    await openTab('Liga dos Campeões');
    expect(useTeamStats).toHaveBeenLastCalledWith('2', '2026');
    expect(screen.getByText('Sem estatísticas para esta competição.')).toBeTruthy();
    mockTeamStats['2'] = { status: 'error', error: new Error('x') };
    await openTab('Liga Portugal');
    await openTab('Liga dos Campeões');
    expect(screen.getByText(ERROR)).toBeTruthy();
    expect(screen.queryByText('Sem estatísticas para esta competição.')).toBeNull();
  });

  it('sem competições na época: mensagem; competições a falhar: erro', async () => {
    mockComps.current = ready([]);
    const { rerender } = await render(wrap(<Equipa />));
    await openTab('Estatísticas');
    expect(screen.getByText('Sem competições nesta época.')).toBeTruthy();
    mockComps.current = { status: 'error', error: new Error('x') };
    await rerender(wrap(<Equipa />));
    expect(screen.getByText(ERROR)).toBeTruthy();
  });
});

describe('/equipa: Transferências', () => {
  it('entradas e saídas com data pt-PT e tipo', async () => {
    mockTeam.transfers = ready({
      items: [
        {
          playerId: '300',
          name: 'Jogador Novo',
          date: '2026-07-01',
          type: 'Loan',
          direction: 'in',
          in: { id: '228', name: 'Sporting CP', logo: null },
          out: { id: '217', name: 'SC Braga', logo: 'https://media.api-sports.io/football/teams/217.png' },
        },
        {
          playerId: '301',
          name: 'Jogador Velho',
          date: '2026-06-20',
          type: '€ 10M',
          direction: 'out',
          in: { id: '212', name: 'FC Porto', logo: null },
          out: { id: '228', name: 'Sporting CP', logo: null },
        },
      ],
    });
    await render(wrap(<Equipa />));
    await openTab('Transferências');
    const first = screen.getByTestId('transfer-row-0');
    expect(within(first).getByText('Entrada')).toBeTruthy();
    expect(within(first).getByText('de SC Braga')).toBeTruthy();
    expect(within(first).getByText('1 Jul 2026')).toBeTruthy();
    expect(within(first).getByText('Empréstimo')).toBeTruthy();
    const second = screen.getByTestId('transfer-row-1');
    expect(within(second).getByText('Saída')).toBeTruthy();
    expect(within(second).getByText('para FC Porto')).toBeTruthy();
    expect(within(second).getByText('20 Jun 2026')).toBeTruthy();
    expect(within(second).getByText('€ 10M')).toBeTruthy();
  });

  it('sem transferências: mensagem; leitura falhada: erro', async () => {
    const { rerender } = await render(wrap(<Equipa />));
    await openTab('Transferências');
    expect(screen.getByText('Sem transferências registadas.')).toBeTruthy();
    mockTeam.transfers = { status: 'error', error: new Error('x') };
    await rerender(wrap(<Equipa />));
    expect(screen.getByText(ERROR)).toBeTruthy();
  });
});

describe('/equipa: Troféus', () => {
  it('do treinador e jogadores com troféus ligados ao detalhe', async () => {
    const t = (league: string, season: string, place = 'Winner') => ({ league, country: 'Portugal', season, place });
    mockTeam.trophies = ready({
      coach: [t('Primeira Liga', '2024/2025'), t('Taça de Portugal', '2024/2025', '2nd Place')],
      byPlayer: { '9': [t('Primeira Liga', '2023/2024'), t('Primeira Liga', '2024/2025')], '5': [t('Taça da Liga', '2021/2022')], '1': [] },
    });
    await render(wrap(<Equipa />));
    await openTab('Troféus');
    expect(screen.getByLabelText('Primeira Liga · 2024/2025: Vencedor')).toBeTruthy();
    expect(screen.getByLabelText('Taça de Portugal · 2024/2025: 2.º lugar')).toBeTruthy();
    const rows = screen.getAllByTestId(/^trophy-player-/).map((r) => r.props.testID);
    expect(rows).toEqual(['trophy-player-9', 'trophy-player-5']);
    expect(within(screen.getByTestId('trophy-player-9')).getByText('2 troféus')).toBeTruthy();
    expect(within(screen.getByTestId('trophy-player-5')).getByText('1 troféu')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('trophy-player-5'));
    expect(mockPush).toHaveBeenCalledWith('/equipa/jogador/5');
  });

  it('treinador a falhar: os troféus ficam, com o título simples "Treinador"', async () => {
    const t = { league: 'Primeira Liga', country: 'Portugal', season: '2024/2025', place: 'Winner' };
    mockTeam.trophies = ready({ coach: [t], byPlayer: { '9': [t] } });
    mockTeam.coach = { status: 'error', error: new Error('x') };
    await render(wrap(<Equipa />));
    await openTab('Troféus');
    expect(screen.getByText('Treinador')).toBeTruthy();
    expect(screen.getByLabelText('Primeira Liga · 2024/2025: Vencedor')).toBeTruthy();
    expect(screen.getByTestId('trophy-player-9')).toBeTruthy();
    expect(screen.queryByText(ERROR)).toBeNull();
  });

  it('plantel a falhar: os troféus do treinador ficam; a secção Jogadores mostra o erro', async () => {
    const t = { league: 'Primeira Liga', country: 'Portugal', season: '2024/2025', place: 'Winner' };
    mockTeam.trophies = ready({ coach: [t], byPlayer: { '9': [t] } });
    mockTeam.squad = { status: 'error', error: new Error('x') };
    await render(wrap(<Equipa />));
    await openTab('Troféus');
    expect(screen.getByLabelText('Primeira Liga · 2024/2025: Vencedor')).toBeTruthy();
    expect(screen.getByText('Jogadores')).toBeTruthy();
    expect(screen.getByText(SECTION_ERROR)).toBeTruthy();
  });

  it('sem troféus: mensagem; leitura falhada: erro', async () => {
    const { rerender } = await render(wrap(<Equipa />));
    await openTab('Troféus');
    expect(screen.getByText('Sem troféus registados.')).toBeTruthy();
    mockTeam.trophies = { status: 'error', error: new Error('x') };
    await rerender(wrap(<Equipa />));
    expect(screen.getByText(ERROR)).toBeTruthy();
  });
});

describe('/equipa/jogador/[id]', () => {
  beforeEach(() => {
    mockParams.current = { id: '9' };
    mockTeam.trophies = ready({ coach: [], byPlayer: { '9': [{ league: 'Primeira Liga', country: 'Portugal', season: '2024/2025', place: 'Winner' }] } });
    mockTeam.sidelined = ready({
      byPlayer: {
        '9': [
          { type: 'Hamstring Injury', start: '2026-10-20', end: null },
          { type: 'Suspended', start: '2026-03-01', end: '2026-03-08' },
        ],
      },
    });
  });

  it('foto, número, posição, números da época, troféus e lesões ("em curso" sem fim)', async () => {
    await render(wrap(<Jogador />));
    expect(usePlayerStats).toHaveBeenLastCalledWith('2026');
    expect(screen.getByTestId('player-photo-image', { includeHiddenElements: true }).props.source).toEqual({
      uri: 'https://media.api-sports.io/football/players/9.png',
    });
    // PlayerPhoto partilhado a 84 pt no cabeçalho (V7.1 4950:8462).
    expect(StyleSheet.flatten(screen.getByTestId('player-photo').props.style)).toMatchObject({ width: 84, height: 84 });
    // Quadrado de cantos arredondados como no frame (4950:8462), não círculo.
    const box = screen.getByTestId('player-photo').children[0] as unknown as { props: { style: object } };
    expect(StyleSheet.flatten(box.props.style)).toMatchObject({ borderRadius: 20 });
    expect(screen.getByText('Viktor Gyökeres')).toBeTruthy();
    expect(screen.getByTestId('player-shirt').props.children).toBe('9');
    expect(screen.getByText('Avançado · 24 anos')).toBeTruthy();
    expect(screen.getByLabelText('Jogos: 12')).toBeTruthy();
    expect(screen.getByText('Época 2026/27')).toBeTruthy();
    expect(screen.getByLabelText('Golos: 15')).toBeTruthy();
    expect(screen.getByLabelText('Assistências: 3')).toBeTruthy();
    expect(screen.getByLabelText('Minutos: 1 010')).toBeTruthy();
    expect(screen.getByLabelText('Nota média: 7,0')).toBeTruthy();
    expect(screen.getByLabelText('Primeira Liga · 2024/2025: Vencedor')).toBeTruthy();
    expect(screen.getByLabelText('Lesão nos isquiotibiais: Desde 20 Out 2026, em curso')).toBeTruthy();
    expect(screen.getByLabelText('Castigo: 1 Mar 2026 a 8 Mar 2026')).toBeTruthy();
  });

  it('sem estatísticas: "Sem jogos esta época."; sem troféus nem lesões: mensagens', async () => {
    mockParams.current = { id: '72' };
    await render(wrap(<Jogador />));
    expect(screen.getByText('Eduardo Quaresma')).toBeTruthy();
    expect(screen.getByText('Sem jogos esta época.')).toBeTruthy();
    expect(screen.getByText('Sem troféus registados.')).toBeTruthy();
    expect(screen.getByText('Sem lesões registadas.')).toBeTruthy();
  });

  it('jogador fora do plantel mas com estatísticas: mostra a linha; sem nada: não encontrado', async () => {
    mockStats.current = ready({ players: [line('400', 'Ex-jogador', { goals: 1 })] });
    mockParams.current = { id: '400' };
    const { rerender } = await render(wrap(<Jogador />));
    expect(screen.getByText('Ex-jogador')).toBeTruthy();
    expect(screen.getByLabelText('Golos: 1')).toBeTruthy();
    mockParams.current = { id: '999' };
    await rerender(wrap(<Jogador />));
    expect(screen.getByText('Jogador não encontrado.')).toBeTruthy();
  });

  it('lesões ou troféus a falhar: cabeçalho e números da época ficam; só a secção mostra o erro', async () => {
    mockTeam.sidelined = { status: 'error', error: new Error('x') };
    mockTeam.trophies = { status: 'error', error: new Error('x') };
    await render(wrap(<Jogador />));
    expect(screen.getByText('Viktor Gyökeres')).toBeTruthy();
    expect(screen.getByText('Avançado · 24 anos')).toBeTruthy();
    expect(screen.getByLabelText('Golos: 15')).toBeTruthy();
    expect(screen.getByText('Histórico de lesões')).toBeTruthy();
    expect(screen.getAllByText(SECTION_ERROR)).toHaveLength(2);
    expect(screen.queryByText(ERROR)).toBeNull();
  });

  it('leitura falhada: erro, nunca "Sem jogos esta época."', async () => {
    mockStats.current = { status: 'error', error: new Error('x') };
    await render(wrap(<Jogador />));
    expect(screen.getByText(ERROR)).toBeTruthy();
    expect(screen.queryByText('Sem jogos esta época.')).toBeNull();
  });
});
