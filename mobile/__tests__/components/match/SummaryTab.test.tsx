// Task 9: tab Sumário. Hooks de dados mockados (sem rede).
import { render, screen } from '@testing-library/react-native';
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
    expect(screen.getByText('Confrontos diretos')).toBeTruthy();
    expect(screen.getByText('1-2')).toBeTruthy();
    expect(screen.getByText('Lesionados e suspensos')).toBeTruthy();
    expect(screen.getByText('Nuno Santos')).toBeTruthy();
    expect(screen.getByText('Fora, Lesão')).toBeTruthy();
    expect(screen.getByText('Dúvida, Castigo')).toBeTruthy();
    expect(screen.queryByText(/Double chance/)).toBeNull();
    expect(screen.queryByText('Disponível no dia de jogo')).toBeNull();
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
