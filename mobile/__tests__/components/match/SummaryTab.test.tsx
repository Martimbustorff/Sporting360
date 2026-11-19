// Task 9: tab Sumário. Hooks de dados mockados (sem rede).
import { render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { colors } from '@/theme/tokens';
import type { EventItem, GameStatus, InjuriesDoc, Match, PrematchDoc, Venue } from '@/data/schemas';

type L = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; data: unknown; fromCache?: boolean };
const mockDetails: { current: Record<string, L> } = { current: {} };
const mockVenue: { current: L } = { current: { status: 'missing' } };

jest.mock('@/data/sports', () => ({
  useMatchDetail: jest.fn((_id: string | null, kind: string) => mockDetails.current[kind] ?? { status: 'missing' }),
  useVenue: jest.fn(() => mockVenue.current),
}));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: object) => <View {...props} /> };
});

import { useVenue } from '@/data/sports';
import { SummaryTab } from '@/components/match/SummaryTab';

const ready = (data: unknown): L => ({ status: 'ready', data });

function match(over: Partial<Match> = {}): Match {
  return {
    id: '1001',
    sport: 'football',
    competition: { key: 'football_94_2026', id: '94', name: 'Liga Portugal', type: 'league', season: '2026', round: 'Regular Season - 16', roundLabel: null },
    home: { id: '228', name: 'Sporting CP', logo: null },
    away: { id: '217', name: 'SC Braga', logo: null },
    sportingSide: 'home',
    kickoff: new Date('2026-09-14T19:30:00Z'),
    status: 'NS' as GameStatus,
    elapsed: null,
    elapsedExtra: null,
    score: { home: null, away: null, halftime: null, extratime: null, penalty: null },
    finishedAt: null,
    venue: { id: '1234', name: 'Estádio José Alvalade', city: 'Lisboa', capacity: 50095, image: null },
    referee: 'Luís Godinho',
    source: { provider: 'api-football', id: '1001', attribution: null },
    ...over,
  } as Match;
}

const prematch = (): PrematchDoc =>
  ({
    fetchedAt: new Date('2026-09-13T10:00:00Z'),
    advice: 'Double chance : Sporting CP or draw',
    winner: { id: '228', name: 'Sporting CP', comment: 'Win or draw' },
    percent: { home: 45, draw: 30, away: 25 },
    form: { home: 'LLWWDLW', away: 'DDLWW' },
    last5: { home: null, away: null },
    h2h: [
      {
        id: 'h1',
        kickoff: new Date('2026-02-01T20:00:00Z'),
        home: { id: '217', name: 'SC Braga', logo: null },
        away: { id: '228', name: 'Sporting CP', logo: null },
        score: { home: 1, away: 2 },
      },
    ],
  }) as PrematchDoc;

const injuries = (): InjuriesDoc => ({
  fetchedAt: new Date('2026-09-13T10:00:00Z'),
  items: [
    { teamId: '228', playerId: 'p1', name: 'Nuno Santos', photo: null, type: 'Missing Fixture', reason: 'Knee Injury' },
    { teamId: '217', playerId: 'p2', name: 'Ricardo Horta', photo: null, type: 'Questionable', reason: 'Suspended' },
  ],
});

const ev = (o: Partial<EventItem>): EventItem => ({
  minute: 10,
  extra: null,
  teamId: '228',
  playerId: null,
  playerName: 'X',
  assistId: null,
  assistName: null,
  type: 'goal',
  detail: 'Normal Goal',
  comments: null,
  ...o,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockDetails.current = {};
  mockVenue.current = { status: 'missing' };
});

describe('jogo futuro (NS)', () => {
  it('mostra previsão, forma, confrontos diretos e lesionados; não mostra o advice da API', async () => {
    mockDetails.current = { prematch: ready(prematch()), injuries: ready(injuries()) };
    await render(<SummaryTab match={match()} />);
    expect(screen.getByText('45%')).toBeTruthy();
    expect(screen.getByText('30%')).toBeTruthy();
    expect(screen.getByText('25%')).toBeTruthy();
    expect(screen.getByTestId('form-home').props.accessibilityLabel).toBe('Forma: V V E D V');
    expect(screen.getAllByTestId('form-letter-home').map((n) => n.props.children)).toEqual(['V', 'V', 'E', 'D', 'V']);
    expect(screen.getByText('Forma · últimos 5')).toBeTruthy();
    expect(screen.getByText('Confrontos diretos · últimos 5')).toBeTruthy();
    expect(screen.getByText('1 vitória Sporting')).toBeTruthy();
    expect(screen.getByText('Ausências')).toBeTruthy();
    expect(screen.getByText('Nuno Santos')).toBeTruthy();
    expect(screen.getByText('lesão no joelho')).toBeTruthy();
    expect(screen.getByText('castigo')).toBeTruthy();
    expect(screen.queryByText(/Double chance/)).toBeNull();
    expect(screen.queryByText('Disponível no dia de jogo')).toBeNull();
  });

  it('selo "Dúvida" só nas ausências "Questionable" (amarelo), não nas "Missing Fixture"', async () => {
    mockDetails.current = { prematch: ready(prematch()), injuries: ready(injuries()) };
    await render(<SummaryTab match={match()} />);
    expect(screen.getAllByTestId('doubt-badge')).toHaveLength(1);
    const badge = screen.getByTestId('doubt-badge');
    expect(within(badge).getByText('Dúvida')).toBeTruthy();
    expect(StyleSheet.flatten(badge.props.style).backgroundColor).toBe(colors.yellow71Bg);
    const rows = screen.getAllByTestId('absence-row');
    expect(within(rows[0]!).queryByTestId('doubt-badge')).toBeNull();
    expect(within(rows[1]!).getByTestId('doubt-badge')).toBeTruthy();
  });

  it('forma: Sporting primeiro, mesmo a jogar fora; cores V primary, E surface-20, D vermelho', async () => {
    mockDetails.current = { prematch: ready(prematch()), injuries: { status: 'missing' } };
    await render(<SummaryTab match={match({ home: { id: '217', name: 'SC Braga', logo: null }, away: { id: '228', name: 'Sporting CP', logo: null }, sportingSide: 'away' })} />);
    const rows = screen.getAllByTestId(/^form-(home|away)$/).map((n) => n.props.testID);
    expect(rows).toEqual(['form-away', 'form-home']);
    const bg = (n: { props: { style?: unknown } }) => StyleSheet.flatten(n.props.style as never).backgroundColor;
    const chips = screen.getAllByTestId('form-letter-away').map((n) => bg(n.parent as never));
    expect(new Set(chips)).toEqual(new Set([colors.primary, colors.surface20, colors.formLoss]));
  });

  it('confrontos diretos: barra proporcional com as três etiquetas e flex pelo número de jogos', async () => {
    const p = prematch() as Exclude<PrematchDoc, { empty: true }>;
    const g = (id: string, h: string, a: string, sh: number, sa: number, day: number) => ({
      id,
      kickoff: new Date(2026, 0, day),
      home: { id: h, name: h === '228' ? 'Sporting CP' : 'SC Braga', logo: null },
      away: { id: a, name: a === '228' ? 'Sporting CP' : 'SC Braga', logo: null },
      score: { home: sh, away: sa },
    });
    mockDetails.current = {
      prematch: ready({ ...p, h2h: [g('a', '228', '217', 2, 0, 1), g('b', '217', '228', 0, 1, 2), g('c', '228', '217', 1, 1, 3), g('d', '217', '228', 3, 1, 4)] }),
      injuries: { status: 'missing' },
    };
    await render(<SummaryTab match={match()} />);
    expect(screen.getByText('2 vitórias Sporting')).toBeTruthy();
    expect(screen.getByText('1 empate')).toBeTruthy();
    expect(screen.getByText('1 vitória SC Braga')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('h2h-sporting').props.style).flexGrow).toBe(2);
    expect(StyleSheet.flatten(screen.getByTestId('h2h-draws').props.style).flexGrow).toBe(1);
  });

  it('sem confrontos com resultado, sem forma e sem lesões: os blocos escondem-se, sem marcadores de posição', async () => {
    const p = prematch() as Exclude<PrematchDoc, { empty: true }>;
    mockDetails.current = {
      prematch: ready({ ...p, form: { home: null, away: null }, h2h: [] }),
      injuries: { status: 'missing' },
    };
    await render(<SummaryTab match={match()} />);
    expect(screen.queryByText('Forma · últimos 5')).toBeNull();
    expect(screen.queryByText('Confrontos diretos · últimos 5')).toBeNull();
    expect(screen.queryByText('Ausências')).toBeNull();
    expect(screen.queryByTestId('h2h-bar')).toBeNull();
  });

  it('prematch vazio e sem lesões: "Disponível no dia de jogo"', async () => {
    mockDetails.current = { prematch: ready({ fetchedAt: new Date(), empty: true }), injuries: { status: 'missing' } };
    await render(<SummaryTab match={match()} />);
    expect(screen.getByText('Disponível no dia de jogo')).toBeTruthy();
    expect(screen.getByTestId('empty-icon-calendar')).toBeTruthy();
    expect(screen.queryByText('Previsão')).toBeNull();
  });

  it('prematch vazio mas com lesões: aviso de pré-jogo e a lista de lesionados', async () => {
    mockDetails.current = { prematch: ready({ fetchedAt: new Date(), empty: true }), injuries: ready(injuries()) };
    await render(<SummaryTab match={match()} />);
    expect(screen.getByText('Pré-jogo ainda não disponível.')).toBeTruthy();
    expect(screen.getByText('Nuno Santos')).toBeTruthy();
    expect(screen.queryByText('Previsão')).toBeNull();
  });

  it('jogo sem detalhes nenhuns (Review Focus 1): não rebenta e mostra o vazio', async () => {
    await render(<SummaryTab match={match({ venue: null, referee: null })} />);
    expect(screen.getByText('Disponível no dia de jogo')).toBeTruthy();
    expect(screen.queryByText('Informação do Jogo')).toBeNull();
  });
});

describe('ao vivo e terminado', () => {
  it('vermelho aos 40’: 1ª Parte, 0-0 e "Cartão vermelho"', async () => {
    mockDetails.current = {
      events: ready({ items: [ev({ minute: 40, type: 'card', detail: 'Red Card', teamId: '217', playerName: 'Zalazar' })] }),
    };
    await render(<SummaryTab match={match({ status: 'LIVE', elapsed: 41, score: { home: 0, away: 0, halftime: null, extratime: null, penalty: null } })} />);
    expect(screen.getByText('1ª Parte')).toBeTruthy();
    expect(screen.getByText('0-0')).toBeTruthy();
    expect(screen.getByLabelText('Cartão vermelho')).toBeTruthy();
    expect(screen.getByText('Zalazar')).toBeTruthy();
  });

  it('penálti falhado não parece golo nem conta no resultado da parte', async () => {
    mockDetails.current = {
      events: ready({ items: [ev({ minute: 30, detail: 'Missed Penalty', playerName: 'Gyökeres' })] }),
    };
    await render(<SummaryTab match={match({ status: 'HT', score: { home: 0, away: 0, halftime: null, extratime: null, penalty: null } })} />);
    expect(screen.getByLabelText('Penálti falhado')).toBeTruthy();
    expect(screen.queryByLabelText('Golo')).toBeNull();
    expect(screen.getByText('0-0')).toBeTruthy();
  });

  it('ao vivo sem lances ainda: mensagem, sem rebentar', async () => {
    await render(<SummaryTab match={match({ status: 'LIVE', elapsed: 2 })} />);
    expect(screen.getByText('Os lances aparecem aqui durante o jogo.')).toBeTruthy();
  });

  it('terminado sem lances: "Sem lances registados."', async () => {
    mockDetails.current = { events: ready({ items: [] }) };
    await render(<SummaryTab match={match({ status: 'FT' })} />);
    expect(screen.getByText('Sem lances registados.')).toBeTruthy();
  });
});

describe('cronologia em duas colunas', () => {
  it('Sporting à esquerda, adversário à direita; autogolo na coluna de quem marcou; golo anulado sem ícone de golo', async () => {
    mockDetails.current = {
      events: ready({
        items: [
          ev({ minute: 23, playerName: 'Suárez', detail: 'Penalty', teamId: '228' }),
          ev({ minute: 38, playerName: 'Samu', detail: 'Normal Goal', teamId: '217' }),
          ev({ minute: 50, playerName: 'Debast', detail: 'Own Goal', teamId: '228' }),
          ev({ minute: 71, playerName: 'Samu', type: 'var', detail: 'Goal Disallowed - offside', teamId: '217' }),
        ],
      }),
    };
    await render(<SummaryTab match={match({ status: 'FT' })} />);
    const rows = screen.getAllByTestId('event-row');
    const col = (i: number, k: 'left' | 'right') => within(within(rows[i]!).getByTestId(`event-${k}`));
    expect(col(0, 'left').getByText('Suárez')).toBeTruthy();
    expect(col(1, 'right').getByText('Samu')).toBeTruthy();
    expect(col(2, 'right').getByText('Debast')).toBeTruthy();
    expect(col(2, 'right').getByText('Autogolo')).toBeTruthy();
    expect(col(3, 'right').getByText('Golo anulado')).toBeTruthy();
    expect(col(3, 'right').getByText('fora de jogo de Samu')).toBeTruthy();
    expect(within(rows[3]!).queryByLabelText('Golo')).toBeNull();
    expect(within(rows[3]!).getByLabelText('VAR')).toBeTruthy();
  });

  it('Sporting a jogar fora: os lances da equipa visitante ficam à esquerda', async () => {
    mockDetails.current = {
      events: ready({ items: [ev({ minute: 12, playerName: 'Trincão', teamId: '228' })] }),
    };
    await render(
      <SummaryTab match={match({ status: 'FT', home: { id: '217', name: 'SC Braga', logo: null }, away: { id: '228', name: 'Sporting CP', logo: null }, sportingSide: 'away' })} />,
    );
    expect(within(screen.getByTestId('event-left')).getByText('Trincão')).toBeTruthy();
  });
});

describe('contexto do jogo (Figma 08)', () => {
  it('terminado com dados: Forma, Confrontos e Ausências por baixo da cronologia, sem Previsão', async () => {
    mockDetails.current = {
      events: ready({ items: [ev({ minute: 23, playerName: 'Suárez', detail: 'Penalty', teamId: '228' })] }),
      prematch: ready(prematch()),
      injuries: ready(injuries()),
    };
    await render(<SummaryTab match={match({ status: 'FT' })} />);
    expect(screen.getByText('Forma · últimos 5')).toBeTruthy();
    expect(screen.getByText('Confrontos diretos · últimos 5')).toBeTruthy();
    expect(screen.getByText('Ausências')).toBeTruthy();
    expect(screen.queryByText('Previsão')).toBeNull();
    expect(screen.queryByText('Disponível no dia de jogo')).toBeNull();
  });

  it('ao vivo: sem contexto (o frame 06 mostra outro conteúdo)', async () => {
    mockDetails.current = {
      events: ready({ items: [ev({ minute: 23, playerName: 'Suárez', teamId: '228' })] }),
      prematch: ready(prematch()),
      injuries: ready(injuries()),
    };
    await render(<SummaryTab match={match({ status: 'LIVE' })} />);
    expect(screen.queryByText('Forma · últimos 5')).toBeNull();
    expect(screen.queryByText('Confrontos diretos · últimos 5')).toBeNull();
    expect(screen.queryByText('Ausências')).toBeNull();
  });

  it('terminado com os eventos a carregar: ainda sem contexto', async () => {
    mockDetails.current = { events: { status: 'loading' }, prematch: ready(prematch()), injuries: ready(injuries()) };
    await render(<SummaryTab match={match({ status: 'FT' })} />);
    expect(screen.queryByText('Forma · últimos 5')).toBeNull();
    expect(screen.queryByText('Ausências')).toBeNull();
  });

  it('terminado sem dados de contexto: só a cronologia, sem avisos', async () => {
    mockDetails.current = { events: ready({ items: [ev({ minute: 23, playerName: 'Suárez', teamId: '228' })] }) };
    await render(<SummaryTab match={match({ status: 'FT' })} />);
    expect(screen.queryByText('Forma · últimos 5')).toBeNull();
    expect(screen.queryByText('Ausências')).toBeNull();
    expect(screen.queryByText('Disponível no dia de jogo')).toBeNull();
  });
});

describe('adiado e cancelado', () => {
  it('PST: mensagem de adiado e sem pré-jogo', async () => {
    mockDetails.current = { prematch: ready(prematch()) };
    await render(<SummaryTab match={match({ status: 'PST' })} />);
    expect(screen.getByText('Jogo adiado. A nova data aparece aqui quando for conhecida.')).toBeTruthy();
    expect(screen.queryByText('45%')).toBeNull();
  });

  it('CANC: "Jogo cancelado."', async () => {
    await render(<SummaryTab match={match({ status: 'CANC' })} />);
    expect(screen.getByText('Jogo cancelado.')).toBeTruthy();
  });
});

describe('Informação do Jogo', () => {
  it('árbitro, local com cidade e capacidade em pt-PT', async () => {
    await render(<SummaryTab match={match({ status: 'FT' })} />);
    expect(screen.getByText('Informação do Jogo')).toBeTruthy();
    expect(screen.getByText('Luís Godinho')).toBeTruthy();
    expect(screen.getByText('Estádio José Alvalade (Lisboa)')).toBeTruthy();
    expect(screen.getByText('50 095')).toBeTruthy();
    expect(screen.queryByTestId('venue-photo')).toBeNull();
    expect(useVenue).toHaveBeenCalledWith('1234');
  });

  it('capacidade e fotografia vêm de venues/{id} quando o jogo não as tem', async () => {
    mockVenue.current = ready({
      name: 'Estádio José Alvalade',
      city: 'Lisboa',
      address: null,
      capacity: 50095,
      surface: null,
      image: 'https://media.api-sports.io/football/venues/1234.png',
    } as Venue);
    await render(<SummaryTab match={match({ venue: { id: '1234', name: 'Estádio José Alvalade', city: null, capacity: null, image: null } })} />);
    expect(screen.getByText('Estádio José Alvalade (Lisboa)')).toBeTruthy();
    expect(screen.getByText('50 095')).toBeTruthy();
    expect(screen.getByTestId('venue-photo').props.source).toEqual({ uri: 'https://media.api-sports.io/football/venues/1234.png' });
  });
});
