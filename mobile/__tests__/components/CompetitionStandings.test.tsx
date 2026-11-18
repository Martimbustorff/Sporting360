// Task 12: Classificação (tabela ou quadro das eliminatórias). Hooks de dados mockados (sem rede).
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { Bracket, StandingRow, StandingsDoc } from '@/data/schemas';

type L =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; data: unknown; fromCache?: boolean };
const mockData: { competition: L; standings: L; bracket: L } = {
  competition: { status: 'missing' },
  standings: { status: 'missing' },
  bracket: { status: 'missing' },
};

jest.mock('@/data/sports', () => ({
  useCompetition: jest.fn(() => mockData.competition),
  useCompetitionData: jest.fn((_key: string | null, kind: 'standings' | 'bracket') => mockData[kind]),
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a), replace: jest.fn(), back: jest.fn() } }));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: object) => <View {...props} /> };
});

import { BracketView } from '@/components/BracketView';
import { CompetitionStandings } from '@/components/CompetitionStandings';
import { resetViewChoices } from '@/lib/standings';
import { StandingsTable } from '@/components/StandingsTable';

const KEY = 'football_2_2026';

function row(rank: number, teamId: string, name: string, points: number): StandingRow {
  return {
    rank,
    teamId,
    name,
    logo: null,
    points,
    played: 6,
    win: 4,
    draw: 1,
    lose: 1,
    goalsFor: 8,
    goalsAgainst: 4,
    goalsDiff: 4,
    form: null,
    description: null,
  } as StandingRow;
}

const standings: StandingsDoc = {
  groups: [{ name: 'Fase de liga', rows: [row(1, '228', 'Sporting CP', 13), { ...row(2, '541', 'Real Madrid', 10), logo: 'https://media.api-sports.io/football/teams/541.png' }] }],
};

const bracket: Bracket = {
  stages: [
    {
      label: 'Oitavos de final',
      raw: 'Round of 16',
      ties: [
        {
          id: 't1',
          stage: 'Round of 16',
          home: { id: '228', name: 'Sporting CP', logo: null },
          away: { id: '157', name: 'Bayern München', logo: null },
          legs: [
            { matchId: 'a', kickoff: '2027-03-10T20:00:00.000Z', status: 'FT', score: { home: 2, away: 1, penaltyHome: null, penaltyAway: null } },
            { matchId: 'b', kickoff: '2027-03-17T20:00:00.000Z', status: 'FT', score: { home: 1, away: 1, penaltyHome: null, penaltyAway: null } },
          ],
          aggregate: { home: 3, away: 2 },
          winnerTeamId: '228',
          sportingInvolved: true,
        },
      ],
    },
  ],
};

const view = (primary: 'table' | 'bracket', hasTable: boolean, hasBracket: boolean) => ({
  status: 'ready' as const,
  data: { sport: 'football', leagueId: '2', name: 'Liga dos Campeões', type: 'europe', logo: null, view: { primary, hasTable, hasBracket, currentStage: null } },
});

beforeEach(() => {
  resetViewChoices();
  mockPush.mockClear();
  mockData.competition = { status: 'missing' };
  mockData.standings = { status: 'missing' };
  mockData.bracket = { status: 'missing' };
});

describe('CompetitionStandings: Review Focus 5 (tabela passa a eliminatórias em direto)', () => {
  it('abre no quadro quando primary muda, mostra o seletor e mantém a escolha manual', async () => {
    mockData.competition = view('table', true, false);
    mockData.standings = { status: 'ready', data: standings };
    const ui = <CompetitionStandings competitionKey={KEY} />;
    const { rerender } = await render(ui);
    expect(screen.getByTestId('standings-table')).toBeTruthy();
    expect(screen.queryByTestId('bracket-view')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Eliminatórias' })).toBeNull();

    // Novo snapshot: a competição passou às eliminatórias.
    mockData.competition = view('bracket', true, true);
    mockData.bracket = { status: 'ready', data: bracket };
    await rerender(<CompetitionStandings competitionKey={KEY} />);
    expect(screen.getByTestId('bracket-view')).toBeTruthy();
    expect(screen.queryByTestId('standings-table')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Tabela' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Eliminatórias' }).props.accessibilityState.selected).toBe(true);

    // O utilizador escolhe a tabela; chega outro snapshot ainda com `bracket`: continua na tabela.
    await fireEvent.press(screen.getByRole('tab', { name: 'Tabela' }));
    expect(screen.getByTestId('standings-table')).toBeTruthy();
    mockData.competition = { ...view('bracket', true, true) };
    mockData.bracket = { status: 'ready', data: { ...bracket } };
    await rerender(<CompetitionStandings competitionKey={KEY} />);
    expect(screen.getByTestId('standings-table')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Tabela' }).props.accessibilityState.selected).toBe(true);
  });

  it('a escolha manual sobrevive a sair e voltar (desmontar e montar de novo), por competição', async () => {
    mockData.competition = view('bracket', true, true);
    mockData.standings = { status: 'ready', data: standings };
    mockData.bracket = { status: 'ready', data: bracket };
    const first = await render(<CompetitionStandings competitionKey={KEY} />);
    expect(screen.getByTestId('bracket-view')).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Tabela' }));
    await first.unmount();

    // Volta à tab Classificação (ou ao ecrã da competição): continua na tabela, mesmo com primary `bracket`.
    await render(<CompetitionStandings competitionKey={KEY} />);
    expect(screen.getByTestId('standings-table')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Tabela' }).props.accessibilityState.selected).toBe(true);
  });

  it('a escolha de uma competição não passa para outra', async () => {
    mockData.competition = view('bracket', true, true);
    mockData.standings = { status: 'ready', data: standings };
    mockData.bracket = { status: 'ready', data: bracket };
    const { rerender } = await render(<CompetitionStandings competitionKey={KEY} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Tabela' }));
    await rerender(<CompetitionStandings competitionKey="football_3_2026" />);
    expect(screen.getByTestId('bracket-view')).toBeTruthy();
  });

  it('hasBracket false no servidor: sem a opção Eliminatórias', async () => {
    mockData.competition = view('table', true, false);
    mockData.standings = { status: 'ready', data: standings };
    mockData.bracket = { status: 'ready', data: bracket };
    await render(<CompetitionStandings competitionKey={KEY} />);
    expect(screen.getByTestId('standings-table')).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Eliminatórias' })).toBeNull();
  });

  it('sem documento da competição: só quadro abre no quadro, sem seletor', async () => {
    mockData.bracket = { status: 'ready', data: bracket };
    await render(<CompetitionStandings competitionKey={KEY} />);
    expect(screen.getByTestId('bracket-view')).toBeTruthy();
    expect(screen.queryByRole('tab')).toBeNull();
  });
});

describe('CompetitionStandings: estados', () => {
  it('a carregar: esqueleto', async () => {
    mockData.competition = { status: 'loading' };
    await render(<CompetitionStandings competitionKey={KEY} />);
    expect(screen.getByTestId('standings-loading')).toBeTruthy();
  });

  it('leitura falhada: erro, nunca a mensagem de vazio', async () => {
    mockData.competition = view('table', true, false);
    mockData.standings = { status: 'error', error: new Error('permission-denied') };
    await render(<CompetitionStandings competitionKey={KEY} />);
    expect(screen.getByText('Não foi possível carregar os dados.')).toBeTruthy();
    expect(screen.queryByText('Sem classificação para esta competição.')).toBeNull();
  });

  it('sem tabela nem quadro: mensagem de vazio', async () => {
    await render(<CompetitionStandings competitionKey={KEY} />);
    expect(screen.getByText('Sem classificação para esta competição.')).toBeTruthy();
  });

  it('dados da cache: aviso offline', async () => {
    mockData.standings = { status: 'ready', data: standings, fromCache: true };
    await render(<CompetitionStandings competitionKey={KEY} />);
    expect(screen.getByText('Sem ligação. A mostrar os últimos dados guardados.')).toBeTruthy();
  });

  it('"Ver competição" abre /competicao/{key}; escondido com showCompetitionLink={false} (F10)', async () => {
    mockData.standings = { status: 'ready', data: standings };
    const { rerender } = await render(<CompetitionStandings competitionKey={KEY} />);
    await fireEvent.press(screen.getByRole('link', { name: 'Ver competição' }));
    expect(mockPush).toHaveBeenCalledWith(`/competicao/${KEY}`);
    await rerender(<CompetitionStandings competitionKey={KEY} showCompetitionLink={false} />);
    expect(screen.queryByText('Ver competição')).toBeNull();
  });
});

describe('CompetitionStandings: modalidade dos emblemas', () => {
  const crest = () => screen.getByTestId('standings-crest-228', { includeHiddenElements: true }).props.source;
  const logo = 'https://media.api-sports.io/hockey/teams/228.png';
  const table: StandingsDoc = { groups: [{ name: '', rows: [{ ...row(1, '228', 'Sporting CP', 13), logo }] }] };

  it('sem o documento da competição, a modalidade vem da chave (roller_hockey tem "_" no nome)', async () => {
    mockData.standings = { status: 'ready', data: table };
    const { rerender } = await render(<CompetitionStandings competitionKey="roller_hockey_5_2026" />);
    expect(crest()).toEqual({ uri: logo });
    await rerender(<CompetitionStandings competitionKey="football_94_2026" />);
    expect(crest()).toEqual({ testUri: expect.stringContaining('sporting-cp-2026') });
  });

  it('com o documento, manda o `sport` dele', async () => {
    mockData.standings = { status: 'ready', data: table };
    mockData.competition = { status: 'ready', data: { sport: 'futsal', leagueId: '5', name: 'Liga Placard', type: 'league', logo: null } };
    await render(<CompetitionStandings competitionKey="football_94_2026" />);
    expect(crest()).toEqual({ uri: logo });
  });
});

describe('StandingsTable', () => {
  it('colunas, golos 8:4 e linha do Sporting destacada', async () => {
    await render(<StandingsTable groups={standings.groups} highlightTeamId="228" sport="football" />);
    // O cabeçalho fica fora da acessibilidade: cada linha tem o seu rótulo completo.
    for (const h of ['#', 'Equipa', 'J', 'V', 'E', 'D', 'G', 'P']) {
      expect(screen.getByText(h, { includeHiddenElements: true })).toBeTruthy();
    }
    expect(screen.getByLabelText('1.º Sporting CP, 13 pontos, 6 jogos')).toBeTruthy();
    expect(screen.getAllByText('8:4')).toHaveLength(2);
    expect(screen.getByTestId('standings-row-228').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId('standings-row-541').props.accessibilityState).toEqual({ selected: false });
    // Emblema por linha (variante 500:30076); o Sporting com o emblema local 2026 (asset, não o URL).
    expect(screen.getByTestId('standings-crest-541', { includeHiddenElements: true }).props.source).toEqual({ uri: 'https://media.api-sports.io/football/teams/541.png' });
    expect(screen.getByTestId('standings-crest-228', { includeHiddenElements: true }).props.source).toEqual({ testUri: expect.stringContaining('sporting-cp-2026') });
    // Um só grupo: sem nome de grupo.
    expect(screen.queryByText('Fase de liga')).toBeNull();
  });

  it('fora do futebol o id da linha não é da API-Football: nunca o emblema local do Sporting', async () => {
    const logo = 'https://media.api-sports.io/handball/teams/228.png';
    await render(<StandingsTable groups={[{ name: '', rows: [{ ...row(1, '228', 'Outra equipa', 13), logo }] }]} highlightTeamId="228" sport="futsal" />);
    expect(screen.getByTestId('standings-crest-228', { includeHiddenElements: true }).props.source).toEqual({ uri: logo });
  });

  it('Review Focus 4: nome de 40 caracteres numa linha com reticências; os pontos continuam visíveis', async () => {
    const long = 'Sporting Clube de Portugal B Sub-23 Xtra'; // 40 caracteres
    expect(long).toHaveLength(40);
    await render(<StandingsTable groups={[{ name: '', rows: [row(1, '999', long, 13)] }]} highlightTeamId="228" sport="football" />);
    const name = screen.getByText(long);
    expect(name.props.numberOfLines).toBe(1);
    expect(name.props.ellipsizeMode).toBe('tail');
    expect(StyleSheet.flatten(name.props.style)).toMatchObject({ flex: 1 });
    const points = screen.getByTestId('standings-points-999');
    expect(points.props.children).toBe(13);
    // A coluna dos pontos tem largura fixa e não encolhe: o nome é que cede.
    expect(StyleSheet.flatten(points.props.style)).toMatchObject({ flexShrink: 0 });
    expect(StyleSheet.flatten(points.props.style).width).toBeGreaterThan(0);
  });

  it('Taça da Liga com 2 grupos: os dois nomes de grupo', async () => {
    await render(
      <StandingsTable
        groups={[
          { name: 'Grupo A', rows: [row(1, '228', 'Sporting CP', 6)] },
          { name: 'Grupo B', rows: [row(1, '212', 'FC Porto', 6)] },
        ]}
        highlightTeamId="228"
        sport="football"
      />,
    );
    expect(screen.getByText('Grupo A')).toBeTruthy();
    expect(screen.getByText('Grupo B')).toBeTruthy();
  });
});

describe('BracketView', () => {
  it('duas mãos 2-1 e 1-1: agregado 3-2 do servidor e vencedor a destaque', async () => {
    await render(<BracketView bracket={bracket} highlightTeamId="228" />);
    expect(screen.getByText('Oitavos de final')).toBeTruthy();
    expect(screen.getByText('Agregado 3-2')).toBeTruthy();
    expect(screen.getByText('2-1')).toBeTruthy();
    expect(screen.getByText('1-1')).toBeTruthy();
    expect(screen.getByTestId('tie-team-t1-228').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId('tie-team-t1-157').props.accessibilityState).toEqual({ selected: false });
  });

  it('uma mão com penáltis 4-3: "(4-3 g.p.)" (F8)', async () => {
    const final: Bracket = {
      stages: [
        {
          label: 'Final',
          raw: 'Final',
          ties: [
            {
              id: 'f1',
              stage: 'Final',
              home: { id: '228', name: 'Sporting CP', logo: null },
              away: { id: '212', name: 'FC Porto', logo: null },
              legs: [{ matchId: 'c', kickoff: '2027-05-24T17:15:00.000Z', status: 'PEN', score: { home: 1, away: 1, penaltyHome: 4, penaltyAway: 3 } }],
              aggregate: { home: 1, away: 1 },
              winnerTeamId: '228',
              sportingInvolved: true,
            },
          ],
        },
      ],
    };
    await render(<BracketView bracket={final} highlightTeamId="228" />);
    expect(screen.getByText('1-1 (4-3 g.p.)')).toBeTruthy();
    expect(screen.queryByText(/Agregado/)).toBeNull();
    expect(screen.getByTestId('tie-team-f1-228').props.accessibilityState).toEqual({ selected: true });
  });

  it('eliminatória por jogar: data da mão em vez do resultado, sem vencedor', async () => {
    const open: Bracket = {
      stages: [
        {
          label: 'Quartos de final',
          raw: 'Quarter-finals',
          ties: [
            {
              id: 'q1',
              stage: 'Quarter-finals',
              home: { id: '228', name: 'Sporting CP', logo: null },
              away: { id: '50', name: 'Manchester City', logo: null },
              legs: [{ matchId: 'd', kickoff: '2027-04-07T19:00:00.000Z', status: 'NS', score: { home: null, away: null, penaltyHome: null, penaltyAway: null } }],
              aggregate: null,
              winnerTeamId: null,
              sportingInvolved: true,
            },
          ],
        },
      ],
    };
    await render(<BracketView bracket={open} highlightTeamId="228" />);
    expect(screen.getByTestId('tie-leg-q1-0').props.children).toMatch(/7 abr/i);
    expect(screen.getByTestId('tie-team-q1-228').props.accessibilityState).toEqual({ selected: false });
  });
});

describe('StandingsTable: nome do clube mais pequeno (Plan 5 Task 2)', () => {
  it('nome longo: uma linha, reticências, tamanho 10; emblema e pontos visíveis em cada linha', async () => {
    const long: StandingsDoc['groups'] = [
      { name: 'Liga', rows: [row(1, '228', 'Sporting Clube de Portugal B', 13), row(2, '541', 'Real Madrid', 10)] },
    ];
    await render(<StandingsTable groups={long} highlightTeamId="228" sport="football" />);
    const name = screen.getByText('Sporting Clube de Portugal B');
    expect(name.props.numberOfLines).toBe(1);
    expect(name.props.ellipsizeMode).toBe('tail');
    expect(StyleSheet.flatten(name.props.style).fontSize).toBe(10);
    for (const id of ['228', '541']) {
      expect(screen.getByTestId(`standings-crest-${id}`, { includeHiddenElements: true })).toBeTruthy();
      expect(screen.getByTestId(`standings-points-${id}`)).toBeTruthy();
    }
    expect(screen.getByTestId('standings-points-228').props.children).toBe(13);
  });
});
