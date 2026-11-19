// Task 12: Classificação (tabela ou quadro das eliminatórias). Hooks de dados mockados (sem rede).
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { Bracket, StandingRow, StandingsDoc } from '@/data/schemas';

type L =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; data: unknown; fromCache?: boolean };
const mockData: { competition: L; standings: L; bracket: L; liveFixtures: L; fixtures: L } = {
  fixtures: { status: 'missing' },
  liveFixtures: { status: 'missing' },
  competition: { status: 'missing' },
  standings: { status: 'missing' },
  bracket: { status: 'missing' },
};

jest.mock('@/data/sports', () => ({
  useCompetition: jest.fn(() => mockData.competition),
  useCompetitionData: jest.fn((_key: string | null, kind: 'standings' | 'bracket' | 'liveFixtures' | 'fixtures') => mockData[kind]),
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
import { colors, layout } from '@/theme/tokens';

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
  mockData.liveFixtures = { status: 'missing' };
  mockData.fixtures = { status: 'missing' };
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
    expect(screen.queryByRole('tab', { name: 'Tabela' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Eliminatórias' })).toBeNull();
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
    for (const h of ['#', 'Equipa', 'J', 'DG', 'PTS']) {
      expect(screen.getByText(h, { includeHiddenElements: true })).toBeTruthy();
    }
    expect(screen.getByLabelText('1.º Sporting CP, 13 pontos, 6 jogos')).toBeTruthy();
    expect(screen.getAllByText('+4')).toHaveLength(2);
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
    expect(screen.getByTestId('stage-0-Round of 16')).toBeTruthy();
    expect(screen.getByText('Oitavos')).toBeTruthy();
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
    expect(screen.getByTestId('tie-score-f1-228').props.children).toBe('1');
    expect(screen.getByTestId('tie-score-f1-212').props.children).toBe('1 (4-3 g.p.)');
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
    expect(screen.getByTestId('tie-leg-q1-0').props.children).toBe('QUA 7 ABR · 20:00');
    expect(screen.getByTestId('tie-team-q1-228').props.accessibilityState).toEqual({ selected: false });
  });
});

describe('StandingsTable: nome longo (V7.1)', () => {
  it('nome longo: uma linha, reticências, tamanho 10; emblema e pontos visíveis em cada linha', async () => {
    const long: StandingsDoc['groups'] = [
      { name: 'Liga', rows: [row(1, '228', 'Sporting Clube de Portugal B', 13), row(2, '541', 'Real Madrid', 10)] },
    ];
    await render(<StandingsTable groups={long} highlightTeamId="228" sport="football" />);
    const name = screen.getByText('Sporting Clube de Portugal B');
    expect(name.props.numberOfLines).toBe(1);
    expect(name.props.ellipsizeMode).toBe('tail');
    expect(StyleSheet.flatten(name.props.style).fontSize).toBe(14);
    for (const id of ['228', '541']) {
      expect(screen.getByTestId(`standings-crest-${id}`, { includeHiddenElements: true })).toBeTruthy();
      expect(screen.getByTestId(`standings-points-${id}`)).toBeTruthy();
    }
    expect(screen.getByTestId('standings-points-228').props.children).toBe(13);
  });
});

describe('Classificação ao vivo (Plan 7 Task 11)', () => {
  const LIGA = 'football_94_2026';
  const zoned = (r: StandingRow, description: string | null, o: Partial<StandingRow> = {}): StandingRow => ({ ...r, description, ...o }) as StandingRow;
  const liga: StandingsDoc = {
    groups: [
      {
        name: 'Liga Portugal',
        rows: [
          zoned(row(1, '211', 'Benfica', 29), 'Promotion - Champions League (Group Stage: )', { goalsDiff: 19 }),
          zoned(row(2, '212', 'FC Porto', 27), 'Promotion - Europa League (League phase: )', { goalsDiff: 15 }),
          zoned(row(3, '228', 'Sporting', 26), 'Promotion - Conference League (Qualification: )', { goalsDiff: 20 }),
          zoned(row(4, '217', 'SC Braga', 23), null, { goalsDiff: 9 }),
        ],
      },
    ],
  };
  const fixture = (homeId: string, awayId: string, homeGoals: number, awayGoals: number) => ({ homeId, awayId, homeGoals, awayGoals, elapsed: 67, status: '2H' });
  const liveDoc = (ageMs: number, fixtures = [fixture('228', '212', 2, 1)]) => ({
    status: 'ready' as const,
    data: { updatedAt: new Date(Date.now() - ageMs), fixtures },
  });
  const rank = (id: string) => screen.getByTestId(`standings-rank-${id}`).props.children;

  beforeEach(() => {
    mockData.standings = { status: 'ready', data: liga };
  });

  it('documento recente com jogos: alternador, "Ao vivo" ativo, projeção com setas e resultado em direto', async () => {
    mockData.liveFixtures = liveDoc(30_000);
    await render(<CompetitionStandings competitionKey={LIGA} />);
    expect(screen.getByTestId('standings-live-toggle')).toBeTruthy();
    expect(screen.getByTestId('segment-live').props.accessibilityState.selected).toBe(true);
    expect(screen.getByText('Com os resultados dos jogos a decorrer.')).toBeTruthy();
    // Sporting 26 + 3 = 29 (+22) e FC Porto 27 (+14): o Sporting passa de 3.º para 1.º (diferença de golos sobre o Benfica), o Benfica desce.
    expect(rank('228')).toBe(1);
    expect(rank('211')).toBe(2);
    expect(rank('212')).toBe(3);
    expect(screen.getByTestId('standings-arrow-228-up')).toBeTruthy();
    expect(screen.getByTestId('standings-arrow-211-down')).toBeTruthy();
    expect(screen.getByTestId('standings-arrow-212-down')).toBeTruthy();
    expect(screen.queryByTestId('standings-arrow-217-up')).toBeNull();
    expect(screen.getByTestId('standings-live-228').props.children).toBe('AO VIVO 2-1');
    expect(screen.getByTestId('standings-live-212').props.children).toBe('AO VIVO 1-2');
    expect(screen.queryByTestId('standings-live-211')).toBeNull();
    expect(screen.getByTestId('standings-points-228').props.children).toBe(29);
  });

  it('confronto direto: o Benfica, que ganhou ao Sporting, fica à frente a 29 pontos apesar da diferença pior', async () => {
    mockData.liveFixtures = liveDoc(30_000);
    mockData.fixtures = {
      status: 'ready',
      // Cada equipa com 6 jogos terminados (como o `played` da tabela oficial): o jogo ao vivo ainda não está na tabela.
      data: {
        items: [
          { id: '1', status: 'FT', home: { id: '211' }, away: { id: '228' }, score: { home: 2, away: 0 } },
          ...['211', '228', '212'].flatMap((t) =>
            [0, 1, 2, 3, 4].map((i) => ({ id: `p${t}${i}`, status: 'FT', home: { id: t }, away: { id: `Z${t}${i}` }, score: { home: 1, away: 0 } })),
          ),
        ],
      },
    };
    await render(<CompetitionStandings competitionKey={LIGA} />);
    expect(rank('211')).toBe(1);
    expect(rank('228')).toBe(2);
  });

  it('o calendário só se subscreve com a vista ao vivo disponível (documento recente com jogos)', async () => {
    const { useCompetitionData } = jest.requireMock('@/data/sports') as { useCompetitionData: jest.Mock };
    const fixturesKeys = () => useCompetitionData.mock.calls.filter((c) => c[1] === 'fixtures').map((c) => c[0]);
    useCompetitionData.mockClear();
    mockData.liveFixtures = liveDoc(6 * 60_000); // velho
    await render(<CompetitionStandings competitionKey={LIGA} />);
    expect(fixturesKeys().every((k) => k === null)).toBe(true);
    useCompetitionData.mockClear();
    mockData.liveFixtures = liveDoc(30_000); // recente
    await render(<CompetitionStandings competitionKey={LIGA} />);
    expect(fixturesKeys()).toContain(LIGA);
  });

  it('calendário em erro ou em falta: não bloqueia, desempata por diferença de golos', async () => {
    mockData.liveFixtures = liveDoc(30_000);
    mockData.fixtures = { status: 'error', error: new Error('x') };
    await render(<CompetitionStandings competitionKey={LIGA} />);
    expect(rank('228')).toBe(1);
    expect(rank('211')).toBe(2);
  });

  it('o rótulo de acessibilidade diz a mudança de posição em "Ao vivo" e deixa de a dizer em "Oficial"', async () => {
    mockData.liveFixtures = liveDoc(30_000);
    await render(<CompetitionStandings competitionKey={LIGA} />);
    expect(screen.getByTestId('standings-row-228').props.accessibilityLabel).toBe('1.º Sporting, 29 pontos, 7 jogos, ao vivo 2-1, sobe 2 lugares');
    expect(screen.getByTestId('standings-row-211').props.accessibilityLabel).toBe('2.º Benfica, 29 pontos, 6 jogos, desce 1 lugar');
    expect(screen.getByTestId('standings-row-217').props.accessibilityLabel).toBe('4.º SC Braga, 23 pontos, 6 jogos');
    await fireEvent.press(screen.getByRole('tab', { name: 'Oficial' }));
    expect(screen.getByTestId('standings-row-228').props.accessibilityLabel).toBe('3.º Sporting, 26 pontos, 6 jogos');
  });

  it('"Oficial": tabela oficial, sem setas nem resultados em direto, e volta a "Ao vivo"', async () => {
    mockData.liveFixtures = liveDoc(30_000);
    await render(<CompetitionStandings competitionKey={LIGA} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Oficial' }));
    expect(rank('211')).toBe(1);
    expect(rank('228')).toBe(3);
    expect(screen.getByTestId('standings-points-228').props.children).toBe(26);
    expect(screen.queryByTestId('standings-live-228')).toBeNull();
    expect(screen.queryByTestId('standings-arrow-228-up')).toBeNull();
    expect(screen.queryByText(/Com os resultados dos jogos a decorrer/)).toBeNull();
    expect(screen.getByRole('tab', { name: 'Oficial' }).props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByRole('tab', { name: 'Ao vivo' }));
    expect(rank('228')).toBe(1);
  });

  it('documento de jogos ao vivo velho (mais de 5 min): tabela oficial e sem alternador', async () => {
    mockData.liveFixtures = liveDoc(6 * 60_000);
    await render(<CompetitionStandings competitionKey={LIGA} />);
    expect(screen.queryByTestId('standings-live-toggle')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Oficial' })).toBeNull();
    expect(rank('211')).toBe(1);
    expect(screen.getByTestId('standings-points-228').props.children).toBe(26);
    expect(screen.queryByTestId('standings-live-228')).toBeNull();
  });

  it('sem jogos ao vivo, sem documento ou erro de leitura: tabela oficial e sem alternador', async () => {
    for (const live of [liveDoc(1_000, []), { status: 'missing' as const }, { status: 'error' as const, error: new Error('permission-denied') }, { status: 'loading' as const }]) {
      mockData.liveFixtures = live;
      const { unmount } = await render(<CompetitionStandings competitionKey={LIGA} />);
      expect(screen.queryByTestId('standings-live-toggle')).toBeNull();
      expect(screen.getByTestId('standings-table')).toBeTruthy();
      expect(rank('211')).toBe(1);
      await unmount();
    }
  });

  it('faixa de zona e legenda a partir de `description`; só as zonas presentes; a linha do Sporting destacada', async () => {
    await render(<CompetitionStandings competitionKey={LIGA} />);
    const band = (id: string) => StyleSheet.flatten(screen.getByTestId(`standings-row-${id}`).props.style).borderLeftColor;
    expect(band('211')).toBe(colors.zoneChampions);
    expect(band('212')).toBe(colors.zoneEurope);
    expect(band('228')).toBe(colors.zoneConference);
    expect(band('217')).toBe('transparent');
    for (const label of ['Liga dos Campeões', 'Liga Europa', 'Conference']) expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByTestId('standings-row-228').props.accessibilityState).toEqual({ selected: true });
    expect(StyleSheet.flatten(screen.getByTestId('standings-row-228').props.style).backgroundColor).toBe(colors.surface10);
  });

  it('sem zonas na tabela: sem legenda', async () => {
    mockData.standings = { status: 'ready', data: standings };
    await render(<CompetitionStandings competitionKey={KEY} />);
    expect(screen.queryByTestId('standings-legend')).toBeNull();
  });

  it('nomes longos a 320 pt: uma linha com reticências, pontos e emblema visíveis', async () => {
    const names = ['Gil Vicente', 'Sporting Clube de Portugal Sub-23 Norte'];
    await render(
      <StandingsTable
        groups={[{ name: '', rows: names.map((n, i) => zoned(row(i + 1, String(900 + i), n, 20 - i), null)) }]}
        highlightTeamId="228"
        sport="football"
      />,
    );
    for (const n of names) {
      const el = screen.getByText(n);
      expect(el.props.numberOfLines).toBe(1);
      expect(el.props.ellipsizeMode).toBe('tail');
    }
    expect(screen.getByTestId('standings-points-901').props.children).toBe(19);
    expect(StyleSheet.flatten(screen.getByTestId('standings-points-901').props.style)).toMatchObject({ flexShrink: 0, width: layout.stColPts });
  });
});

describe('Classificação com três vistas (Task 6 do Plano 9)', () => {
  const LIGA = 'football_94_2026';
  const r = (rank: number, teamId: string, name: string, o: Partial<StandingRow>): StandingRow => ({ ...row(rank, teamId, name, 20), ...o }) as StandingRow;
  const liga: StandingsDoc = {
    groups: [
      {
        name: 'Liga Portugal',
        rows: [
          r(1, '228', 'Sporting CP', { points: 14, played: 6, win: 4, draw: 2, lose: 0, goalsDiff: 9, form: 'WWDWW' }),
          r(2, '212', 'FC Porto', { points: 13, played: 6, win: 4, draw: 1, lose: 1, goalsDiff: 5, form: 'WDLWDWLX' }),
          r(3, '217', 'SC Braga', { points: 9, played: 6, win: 2, draw: 3, lose: 1, goalsDiff: 1, form: null }),
          r(4, '99', 'Famalicão', { points: 8, played: 6, win: 2, draw: 2, lose: 2, goalsDiff: 0, form: '' }),
        ],
      },
    ],
  };
  const fixture = (homeId: string, awayId: string, homeGoals: number, awayGoals: number) => ({ homeId, awayId, homeGoals, awayGoals, elapsed: 60, status: '2H' });
  const live = (fixtures = [fixture('228', '212', 1, 0)], ageMs = 30_000) => ({
    status: 'ready' as const,
    data: { updatedAt: new Date(Date.now() - ageMs), fixtures },
  });
  const tab = (name: string) => screen.getByRole('tab', { name });
  const width = (id: string) => StyleSheet.flatten(screen.getByTestId(id, { includeHiddenElements: true }).props.style).width;

  beforeEach(() => {
    mockData.standings = { status: 'ready', data: liga };
  });

  it('o seletor tem Resumida, Completa e Forma, abre em Resumida e a tabela é a de sempre (J, DG, PTS)', async () => {
    await render(<CompetitionStandings competitionKey={LIGA} />);
    expect(screen.getByTestId('standings-view-selector')).toBeTruthy();
    for (const n of ['Resumida', 'Completa', 'Forma']) expect(tab(n)).toBeTruthy();
    expect(tab('Resumida').props.accessibilityState.selected).toBe(true);
    expect(tab('Completa').props.accessibilityState.selected).toBe(false);
    for (const h of ['J', 'DG', 'PTS']) expect(screen.getByText(h, { includeHiddenElements: true })).toBeTruthy();
    for (const h of ['V', 'E']) expect(screen.queryByText(h, { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId('standings-win-228')).toBeNull();
    expect(screen.queryByTestId('standings-form-228')).toBeNull();
    expect(screen.getByLabelText('1.º Sporting CP, 14 pontos, 6 jogos')).toBeTruthy();
  });

  it('Completa: J, V, E, D, DG e PTS com as larguras do Figma, nome curto e com reticências', async () => {
    await render(<CompetitionStandings competitionKey={LIGA} />);
    await fireEvent.press(tab('Completa'));
    expect(tab('Completa').props.accessibilityState.selected).toBe(true);
    for (const h of ['#', 'Equipa', 'J', 'V', 'E', 'D', 'DG', 'PTS']) expect(screen.getByText(h, { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('standings-win-228').props.children).toBe(4);
    expect(screen.getByTestId('standings-draw-228').props.children).toBe(2);
    expect(screen.getByTestId('standings-lose-228').props.children).toBe(0);
    expect(screen.getByTestId('standings-points-228').props.children).toBe(14);
    expect(width('standings-win-228')).toBe(layout.stColResult);
    expect(width('standings-points-228')).toBe(layout.stColPtsFull);
    expect(layout).toMatchObject({ stColPlayedFull: 22, stColResult: 20, stColDiffFull: 32, stColPtsFull: 30 });
    // Nome curto do Sporting; todos os nomes numa linha com reticências, números sem encolher.
    const name = screen.getByText('Sporting');
    expect(name.props.numberOfLines).toBe(1);
    expect(name.props.ellipsizeMode).toBe('tail');
    expect(StyleSheet.flatten(screen.getByTestId('standings-win-228').props.style).flexShrink).toBe(0);
    expect(screen.getByLabelText(/^1\.º Sporting, 14 pontos, 6 jogos, 4 vitórias, 2 empates, 0 derrotas/)).toBeTruthy();
  });

  it('Forma: até 5 pills com V, E e D (W, D, L da API), a mais recente à direita; sem forma, sem pills', async () => {
    await render(<CompetitionStandings competitionKey={LIGA} />);
    await fireEvent.press(tab('Forma'));
    const pills = (id: string) => screen.queryAllByTestId(new RegExp(`^standings-form-${id}-\\d$`), { includeHiddenElements: true });
    expect(pills('228')).toHaveLength(5);
    expect(pills('212')).toHaveLength(5); // 'WDLWDWLX': ignora o X e fica com os 5 mais recentes (L W D W L)
    const text = (id: string) => pills(id).map((p) => (p.children[0] as unknown as { props: { children: string } }).props.children);
    expect(text('212')).toEqual(['D', 'V', 'E', 'V', 'D']);
    expect(text('228')).toEqual(['V', 'V', 'E', 'V', 'V']);
    expect(screen.getByLabelText(/^2\.º FC Porto\. Últimos jogos: derrota, vitória, empate, vitória, derrota$/)).toBeTruthy();
    expect(screen.getByLabelText(/^1\.º Sporting\. Últimos jogos: vitória, vitória, empate, vitória, vitória$/)).toBeTruthy();
    expect(pills('217')).toHaveLength(0);
    expect(pills('99')).toHaveLength(0);
    expect(screen.getByLabelText('3.º SC Braga')).toBeTruthy();
    // Cores: as mesmas fichas do pré-jogo (V primary, E surface20, D formLoss).
    const bg = (id: string, i: number) => StyleSheet.flatten(screen.getByTestId(`standings-form-${id}-${i}`, { includeHiddenElements: true }).props.style).backgroundColor;
    expect(bg('228', 0)).toBe(colors.primary);
    expect(bg('228', 2)).toBe(colors.surface20);
    expect(bg('212', 0)).toBe(colors.formLoss);
    expect(width('standings-form-228-0')).toBe(layout.stFormPill);
    // Sem J, DG e PTS.
    for (const h of ['J', 'DG', 'PTS']) expect(screen.queryByText(h, { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId('standings-points-228')).toBeNull();
  });

  it('a escolha vale nos dois sítios, mesmo desmontando, e para todas as competições', async () => {
    const first = await render(<CompetitionStandings competitionKey={LIGA} />);
    await fireEvent.press(tab('Forma'));
    await first.unmount();
    const second = await render(<CompetitionStandings competitionKey={LIGA} showCompetitionLink={false} />);
    expect(tab('Forma').props.accessibilityState.selected).toBe(true);
    await second.rerender(<CompetitionStandings competitionKey="football_2_2026" />);
    expect(tab('Forma').props.accessibilityState.selected).toBe(true);
  });

  it('com o alternador ao vivo, o seletor fica por baixo da nota; sem ele, é a primeira coisa por cima da tabela', async () => {
    mockData.liveFixtures = live();
    const { toJSON, unmount } = await render(<CompetitionStandings competitionKey={LIGA} />);
    const order = (testIDs: string[]) => {
      const json = JSON.stringify(toJSON());
      return testIDs.map((t) => json.indexOf(`"${t}"`));
    };
    const [toggle, selector, table] = order(['standings-live-toggle', 'standings-view-selector', 'standings-table']);
    expect(toggle).toBeGreaterThan(-1);
    expect(toggle).toBeLessThan(selector!);
    expect(selector).toBeLessThan(table!);
    expect(screen.getByText('Com os resultados dos jogos a decorrer.')).toBeTruthy();
    await unmount();
    mockData.liveFixtures = { status: 'missing' };
    await render(<CompetitionStandings competitionKey={LIGA} />);
    expect(screen.queryByTestId('standings-live-toggle')).toBeNull();
    expect(screen.getByTestId('standings-view-selector')).toBeTruthy();
  });

  it('"Ao vivo" + "Completa": V, E e D projetados batem com J e PTS; a forma é sempre a oficial', async () => {
    mockData.liveFixtures = live([fixture('228', '212', 1, 0)]);
    await render(<CompetitionStandings competitionKey={LIGA} />);
    await fireEvent.press(tab('Completa'));
    const n = (k: string, id: string) => screen.getByTestId(`standings-${k}-${id}`).props.children;
    // Sporting: 4V 2E 0D + vitória = 5V 2E 0D, 7 jogos, 17 pontos. FC Porto: 4V 1E 2D, 7 jogos, 13 pontos.
    expect([n('win', '228'), n('draw', '228'), n('lose', '228'), n('points', '228')]).toEqual([5, 2, 0, 17]);
    expect([n('win', '212'), n('draw', '212'), n('lose', '212'), n('points', '212')]).toEqual([4, 1, 2, 13]);
    expect(screen.getByLabelText(/^1\.º Sporting, 17 pontos, 7 jogos/)).toBeTruthy();
    await fireEvent.press(tab('Forma'));
    expect(screen.getByLabelText(/^1\.º Sporting, ao vivo 1-0\. Últimos jogos: vitória, vitória, empate, vitória, vitória$/)).toBeTruthy();
  });

  it('jogos em curso: o ponto aparece nas equipas que jogam, nas três vistas, em "Ao vivo" e em "Oficial"', async () => {
    mockData.liveFixtures = live([fixture('228', '212', 1, 0)]);
    await render(<CompetitionStandings competitionKey={LIGA} />);
    for (const mode of ['Ao vivo', 'Oficial']) {
      await fireEvent.press(tab(mode));
      for (const v of ['Resumida', 'Completa', 'Forma']) {
        await fireEvent.press(tab(v));
        expect(screen.getByTestId('standings-livedot-228')).toBeTruthy();
        expect(screen.getByTestId('standings-livedot-212')).toBeTruthy();
        expect(screen.queryByTestId('standings-livedot-217')).toBeNull();
        const dot = StyleSheet.flatten(screen.getByTestId('standings-livedot-228').props.style);
        expect(dot).toMatchObject({ width: 6, height: 6, marginHorizontal: 6, backgroundColor: colors.primaryOnDark });
      }
    }
  });

  it('documento velho ou sem jogos: sem pontos e sem alternador', async () => {
    mockData.liveFixtures = live([fixture('228', '212', 1, 0)], 6 * 60_000);
    await render(<CompetitionStandings competitionKey={LIGA} />);
    expect(screen.queryByTestId('standings-livedot-228')).toBeNull();
    expect(screen.queryByTestId('standings-live-toggle')).toBeNull();
  });

  it('a linha do Sporting continua destacada nas três vistas, com a legenda das zonas como estava', async () => {
    const zoned: StandingsDoc = { groups: [{ name: '', rows: [{ ...liga.groups[0]!.rows[0]!, description: 'Promotion - Champions League' }, ...liga.groups[0]!.rows.slice(1)] }] };
    mockData.standings = { status: 'ready', data: zoned };
    await render(<CompetitionStandings competitionKey={LIGA} />);
    for (const v of ['Resumida', 'Completa', 'Forma']) {
      await fireEvent.press(tab(v));
      expect(screen.getByTestId('standings-row-228').props.accessibilityState).toEqual({ selected: true });
      expect(screen.getByTestId('standings-row-212').props.accessibilityState).toEqual({ selected: false });
      expect(screen.getByTestId('standings-legend')).toBeTruthy();
    }
  });

  it('a 320 pt os números e as pills não encolhem (largura fixa, sem encolher)', async () => {
    await render(<CompetitionStandings competitionKey={LIGA} />);
    await fireEvent.press(tab('Completa'));
    for (const k of ['win', 'draw', 'lose', 'points']) expect(StyleSheet.flatten(screen.getByTestId(`standings-${k}-212`).props.style).flexShrink).toBe(0);
    await fireEvent.press(tab('Forma'));
    expect(StyleSheet.flatten(screen.getByTestId('standings-form-212', { includeHiddenElements: true }).props.style).flexShrink).toBe(0);
  });
});
