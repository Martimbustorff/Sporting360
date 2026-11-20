// Task 10: tab Estatísticas. Hooks de dados mockados (sem rede).
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { colors } from '@/theme/tokens';
import type { GameStatus, Match } from '@/data/schemas';

type L =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; data: unknown; fromCache?: boolean };
const mockDetails: { current: Record<string, L> } = { current: {} };

jest.mock('@/data/sports', () => ({
  useMatchDetail: jest.fn((_id: string | null, kind: string) => mockDetails.current[kind] ?? { status: 'missing' }),
  useVenue: jest.fn(() => ({ status: 'missing' })),
}));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: object) => <View {...props} /> };
});

import { StatsTab } from '@/components/match/StatsTab';
import { SummaryTab } from '@/components/match/SummaryTab';

function match(status: GameStatus = 'NS'): Match {
  return {
    id: '1001',
    sport: 'football',
    competition: { key: 'football_94_2026', id: '94', name: 'Liga Portugal', type: 'league', season: '2026', round: 'Regular Season - 16', roundLabel: null },
    home: { id: '228', name: 'Sporting CP', logo: null },
    away: { id: '217', name: 'SC Braga', logo: null },
    sportingSide: 'home',
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

const statsDoc = (teamsReversed = false) => {
  const teams = [
    { teamId: '228', items: { 'Ball Possession': '55%', 'Total Shots': 12, 'Yellow Cards': 1 } },
    { teamId: '217', items: { 'Ball Possession': '45%', 'Total Shots': 4, 'Red Cards': 1 } },
  ];
  return { teams: teamsReversed ? teams.reverse() : teams, xg: { home: 1.43, away: 0.6 } };
};

beforeEach(() => {
  mockDetails.current = {};
});

const texts = (id: string) => screen.getAllByTestId(id).map((n) => n.props.children);

describe('Estatísticas', () => {
  it('ao vivo com documento: valores, posse tal como vem e xG com vírgula', async () => {
    mockDetails.current = { statistics: { status: 'ready', data: statsDoc() } };
    await render(<StatsTab match={match('LIVE')} />);
    expect(screen.getAllByTestId('stat-row')).toHaveLength(8);
    expect(texts('stat-home').slice(0, 2)).toEqual(['55%', '1,4']);
    expect(texts('stat-away').slice(0, 2)).toEqual(['45%', '0,6']);
    expect(screen.getByText('Posse de bola (%)')).toBeTruthy();
    // Martim 20/11: números maiores (Title L 28).
    expect(StyleSheet.flatten(screen.getAllByTestId('stat-home')[0]!.props.style)?.fontSize).toBe(28);
  });

  it('cartões: uma linha no fim com amarelos e vermelhos de cada equipa', async () => {
    mockDetails.current = { statistics: { status: 'ready', data: statsDoc() } };
    await render(<StatsTab match={match('LIVE')} />);
    expect(screen.getByText('Cartões')).toBeTruthy();
    expect(screen.getByTestId('cards-home-yellow').props.children).toBe('1');
    expect(screen.getByTestId('cards-home-red').props.children).toBe('0');
    expect(screen.getByTestId('cards-away-yellow').props.children).toBe('0');
    expect(screen.getByTestId('cards-away-red').props.children).toBe('1');
    const all = screen.getAllByTestId(/^stat-row$|^cards-row$/);
    expect(all[all.length - 1]?.props.testID).toBe('cards-row');
  });

  it('a barra da equipa com o valor maior é primary-on-dark e a menor surface-20', async () => {
    mockDetails.current = { statistics: { status: 'ready', data: statsDoc() } };
    await render(<StatsTab match={match('LIVE')} />);
    const bg = (n: { props: Record<string, any> }) => (StyleSheet.flatten(n.props.style as object) as { backgroundColor: string }).backgroundColor;
    // Posse 55% contra 45%: casa lidera; remates 12 contra 4: casa lidera; defesas 0 contra 0: ninguém.
    const home = screen.getAllByTestId('stat-bar-home').map(bg);
    const away = screen.getAllByTestId('stat-bar-away').map(bg);
    expect(home[0]).toBe(colors.primaryOnDark);
    expect(away[0]).toBe(colors.surface20);
    expect(home[2]).toBe(colors.primaryOnDark);
    expect(away[2]).toBe(colors.surface20);
    expect(home[4]).toBe(colors.surface20);
    expect(away[4]).toBe(colors.surface20);
  });

  it('visitante com o valor maior: a barra de fora é a primary-on-dark', async () => {
    const doc = statsDoc();
    doc.teams[0]!.items['Total Shots'] = 2;
    mockDetails.current = { statistics: { status: 'ready', data: doc } };
    await render(<StatsTab match={match('LIVE')} />);
    const bg = (n: { props: Record<string, any> }) => (StyleSheet.flatten(n.props.style as object) as { backgroundColor: string }).backgroundColor;
    expect(bg(screen.getAllByTestId('stat-bar-home')[2]!)).toBe(colors.surface20);
    expect(bg(screen.getAllByTestId('stat-bar-away')[2]!)).toBe(colors.primaryOnDark);
  });

  it('casa e fora pelo teamId mesmo com teams[0] a ser a de fora', async () => {
    mockDetails.current = { statistics: { status: 'ready', data: statsDoc(true) } };
    await render(<StatsTab match={match('FT')} />);
    expect(texts('stat-home')[0]).toBe('55%');
    expect(texts('stat-away')[0]).toBe('45%');
  });

  it('antes do jogo sem documento (Review Focus 1): 10 linhas a zero, esbatidas, sem rebentar', async () => {
    await render(<StatsTab match={match('NS')} />);
    expect(screen.getAllByTestId('stat-row')).toHaveLength(8);
    expect(screen.getByTestId('cards-row')).toBeTruthy();
    expect(texts('stat-home')).toEqual(['0%', ...Array(7).fill('0')]);
    expect(screen.getByText('Golos esperados (xG)')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getAllByTestId('stat-row')[0]?.props.style as object)).toEqual(
      expect.objectContaining({ opacity: 0.3 }),
    );
  });

  it('ao vivo ainda sem documento: linhas a zero', async () => {
    await render(<StatsTab match={match('LIVE')} />);
    expect(screen.getAllByTestId('stat-row')).toHaveLength(8);
  });

  it('terminado sem documento: mensagem', async () => {
    await render(<StatsTab match={match('FT')} />);
    expect(screen.getByText('Sem estatísticas para este jogo.')).toBeTruthy();
    expect(screen.queryAllByTestId('stat-row')).toHaveLength(0);
  });

  it('leitura falhada: estado de erro, nunca "sem estatísticas"', async () => {
    mockDetails.current = { statistics: { status: 'error', error: new Error('x') } };
    await render(<StatsTab match={match('FT')} />);
    expect(screen.getByText('Não foi possível carregar os dados.')).toBeTruthy();
    expect(screen.queryByText('Sem estatísticas para este jogo.')).toBeNull();
  });

  it('a carregar: nada rebenta e não há mensagem de vazio', async () => {
    mockDetails.current = { statistics: { status: 'loading' } };
    await render(<StatsTab match={match('FT')} />);
    expect(screen.queryByText('Sem estatísticas para este jogo.')).toBeNull();
    expect(screen.getByTestId('stats-loading')).toBeTruthy();
  });

  it('dados da cache mostram o aviso sem ligação', async () => {
    mockDetails.current = { statistics: { status: 'ready', data: statsDoc(), fromCache: true } };
    await render(<StatsTab match={match('LIVE')} />);
    expect(screen.getByTestId('offline-banner')).toBeTruthy();
  });
});

describe('Sumário: erro de leitura e chaves (regra da Task 9)', () => {
  const err: L = { status: 'error', error: new Error('x') };

  it('lances com leitura falhada: erro, não "Sem lances registados."', async () => {
    mockDetails.current = { events: err };
    await render(<SummaryTab match={match('FT')} />);
    expect(screen.getByText('Não foi possível carregar os dados.')).toBeTruthy();
    expect(screen.queryByText('Sem lances registados.')).toBeNull();
  });

  it('pré-jogo com leituras falhadas: erro, não "Disponível no dia de jogo"', async () => {
    mockDetails.current = { prematch: err, injuries: err };
    await render(<SummaryTab match={match('NS')} />);
    expect(screen.getByText('Não foi possível carregar os dados.')).toBeTruthy();
    expect(screen.queryByText('Disponível no dia de jogo')).toBeNull();
  });

  it('lesionados com o mesmo playerId repetido: renderiza sem avisos de chave duplicada', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const item = (type: string, reason: string) => ({ teamId: '228', playerId: 'p1', name: 'Nuno Santos', photo: null, type, reason });
    mockDetails.current = {
      prematch: { status: 'ready', data: { fetchedAt: new Date(), empty: true } },
      injuries: { status: 'ready', data: { fetchedAt: new Date(), items: [item('Missing Fixture', 'Knee Injury'), item('Questionable', 'Suspended')] } },
    };
    await render(<SummaryTab match={match('NS')} />);
    expect(screen.getAllByText('Nuno Santos')).toHaveLength(2);
    expect(spy.mock.calls.filter((c) => String(c[0]).includes('same key'))).toHaveLength(0);
    spy.mockRestore();
  });
});

describe('Estatísticas por parte', () => {
  const withHalves = () => ({
    ...statsDoc(),
    firstHalf: {
      teams: [
        { teamId: '228', items: { 'Ball Possession': '60%', 'Total Shots': 5, 'Yellow Cards': 1 } },
        { teamId: '217', items: { 'Ball Possession': '40%', 'Total Shots': 3 } },
      ],
      xg: { home: 0.9, away: 0.2 },
    },
  });

  it('documento antigo (sem partes): sem seletor', async () => {
    mockDetails.current = { statistics: { status: 'ready', data: statsDoc() } };
    await render(<StatsTab match={match('FT')} />);
    expect(screen.queryByTestId('stats-part-selector')).toBeNull();
  });

  it('com partes: seletor Total / 1.ª parte / 2.ª parte, a abrir em Total', async () => {
    mockDetails.current = { statistics: { status: 'ready', data: withHalves() } };
    await render(<StatsTab match={match('FT')} />);
    expect(screen.getByTestId('stats-part-selector')).toBeTruthy();
    expect(screen.getByLabelText('Total')).toBeTruthy();
    expect(screen.getByLabelText('1.ª parte')).toBeTruthy();
    expect(screen.getByLabelText('2.ª parte')).toBeTruthy();
    expect(texts('stat-home').slice(0, 3)).toEqual(['55%', '1,4', '12']);
  });

  it('1.ª parte mostra os valores do intervalo, com posse', async () => {
    mockDetails.current = { statistics: { status: 'ready', data: withHalves() } };
    await render(<StatsTab match={match('FT')} />);
    await fireEvent.press(screen.getByLabelText('1.ª parte'));
    expect(texts('stat-home').slice(0, 3)).toEqual(['60%', '0,9', '5']);
    expect(texts('stat-away').slice(0, 3)).toEqual(['40%', '0,2', '3']);
  });

  it('2.ª parte: total menos 1.ª parte e sem a linha da posse', async () => {
    mockDetails.current = { statistics: { status: 'ready', data: withHalves() } };
    await render(<StatsTab match={match('FT')} />);
    await fireEvent.press(screen.getByLabelText('2.ª parte'));
    expect(screen.queryByText('Posse de bola (%)')).toBeNull();
    expect(screen.getAllByTestId('stat-row')).toHaveLength(7);
    expect(texts('stat-home').slice(0, 2)).toEqual(['0,5', '7']);
    expect(texts('stat-away').slice(0, 2)).toEqual(['0,4', '1']);
    expect(screen.getByTestId('cards-home-yellow').props.children).toBe('0');
  });

  it('as barras seguem a parte escolhida', async () => {
    mockDetails.current = { statistics: { status: 'ready', data: withHalves() } };
    await render(<StatsTab match={match('FT')} />);
    await fireEvent.press(screen.getByLabelText('2.ª parte'));
    const bg = (n: { props: Record<string, any> }) => (StyleSheet.flatten(n.props.style as object) as { backgroundColor: string }).backgroundColor;
    // 2.ª parte, remates 7 contra 1.
    expect(bg(screen.getAllByTestId('stat-bar-home')[1]!)).toBe(colors.primaryOnDark);
    expect(bg(screen.getAllByTestId('stat-bar-away')[1]!)).toBe(colors.surface20);
  });

  it('antes do jogo (sem documento) não há seletor', async () => {
    await render(<StatsTab match={match('NS')} />);
    expect(screen.queryByTestId('stats-part-selector')).toBeNull();
  });

  it('ao vivo na 1.ª parte (ainda sem firstHalf): só Total, sem seletor', async () => {
    mockDetails.current = { statistics: { status: 'ready', data: statsDoc() } };
    await render(<StatsTab match={match('LIVE')} />);
    expect(screen.queryByTestId('stats-part-selector')).toBeNull();
  });

  it('firstHalf malformado não rebenta: sem seletor', async () => {
    mockDetails.current = { statistics: { status: 'ready', data: { ...statsDoc(), firstHalf: { teams: 'x' } } } };
    await render(<StatsTab match={match('FT')} />);
    expect(screen.queryByTestId('stats-part-selector')).toBeNull();
    expect(screen.getAllByTestId('stat-row')).toHaveLength(8);
  });

  it('intervalo: sem a opção "2.ª parte" e uma 2.ª parte guardada volta ao Total', async () => {
    mockDetails.current = { statistics: { status: 'ready', data: withHalves() } };
    const view = await render(<StatsTab match={match('LIVE')} />);
    await fireEvent.press(screen.getByLabelText('2.ª parte'));
    expect(texts('stat-home')[1]).toBe('7');
    await view.rerender(<StatsTab match={match('HT')} />);
    expect(screen.queryByLabelText('2.ª parte')).toBeNull();
    expect(screen.getByLabelText('1.ª parte')).toBeTruthy();
    expect(texts('stat-home').slice(0, 3)).toEqual(['55%', '1,4', '12']);
  });

  it('depois do prolongamento (AET e PEN) não há "2.ª parte": o total inclui o prolongamento', async () => {
    mockDetails.current = { statistics: { status: 'ready', data: withHalves() } };
    for (const status of ['AET', 'PEN'] as const) {
      const view = await render(<StatsTab match={match(status)} />);
      expect(screen.getByLabelText('1.ª parte')).toBeTruthy();
      expect(screen.queryByLabelText('2.ª parte')).toBeNull();
      await view.unmount();
    }
  });

  it('prolongamento em curso (estado ET, BT ou P) não mostra "2.ª parte"', async () => {
    mockDetails.current = { statistics: { status: 'ready', data: withHalves() } };
    for (const statusRaw of ['ET', 'BT', 'P']) {
      const view = await render(<StatsTab match={{ ...match('LIVE'), statusRaw } as Match} />);
      expect(screen.queryByLabelText('2.ª parte')).toBeNull();
      await view.unmount();
    }
  });

  it('na 2.ª parte (2H) a opção aparece', async () => {
    mockDetails.current = { statistics: { status: 'ready', data: withHalves() } };
    await render(<StatsTab match={{ ...match('LIVE'), statusRaw: '2H' } as Match} />);
    expect(screen.getByLabelText('2.ª parte')).toBeTruthy();
  });
});
