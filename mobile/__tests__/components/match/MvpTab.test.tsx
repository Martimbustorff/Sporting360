// Task 18: tab MVP. Hooks de dados e sessão mockados; a callable é a do RNFB (mock em __mocks__), chamada pelo
// services/game real, para testar o caminho completo até ao código de erro do servidor (functions/src/callables/voteMvp.ts).
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { GameStatus, Match } from '@/data/schemas';

type L =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; data: unknown; fromCache?: boolean };
const mockData: { vote: L; settlement: L; points: L; players: L } = {
  vote: { status: 'missing' },
  settlement: { status: 'missing' },
  points: { status: 'ready', data: [] },
  players: { status: 'missing' },
};
const mockSession: { status: 'signedIn' | 'signedOut' } = { status: 'signedIn' };
const mockCall = jest.fn();

jest.mock('@react-native-firebase/functions');
jest.mock('@react-native-firebase/crashlytics');
jest.mock('@/services/firebase', () => ({ fns: jest.fn(() => ({ __mock: 'functions' })) }));
jest.mock('@/providers/SessionProvider', () => ({
  useSession: () =>
    mockSession.status === 'signedIn'
      ? { status: 'signedIn', user: { uid: 'u1', email: null, providers: [] } }
      : { status: 'signedOut' },
}));
jest.mock('@/data/user', () => ({
  useMyMvpVote: jest.fn(() => mockData.vote),
  useSettlement: jest.fn(() => mockData.settlement),
  useMyGamePoints: jest.fn(() => mockData.points),
}));
jest.mock('@/data/sports', () => ({
  useMatchDetail: jest.fn(() => mockData.players),
}));

import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { httpsCallable } from '@react-native-firebase/functions';
import { recordError } from '@react-native-firebase/crashlytics';
import { useMatchDetail } from '@/data/sports';
import { MvpTab } from '@/components/match/MvpTab';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 44, left: 0, right: 0, bottom: 34 } };
const wrapper = ({ children }: { children: ReactNode }) => (
  <SafeAreaProvider initialMetrics={METRICS}>{children}</SafeAreaProvider>
);

const NOW = new Date('2026-11-21T21:40:00Z');

function match(over: { status?: GameStatus; elapsed?: number | null; finishedAt?: Date | null } = {}): Match {
  return {
    id: '1001',
    sport: 'football',
    competition: { key: 'football_94_2026', id: '94', name: 'Liga Portugal', type: 'league', season: '2026', round: 'Regular Season - 12', roundLabel: null },
    home: { id: '228', name: 'Sporting CP', logo: null },
    away: { id: '217', name: 'SC Braga', logo: null },
    sportingSide: 'home',
    kickoff: new Date('2026-11-21T20:00:00Z'),
    status: over.status ?? 'LIVE',
    elapsed: over.elapsed === undefined ? 85 : over.elapsed,
    elapsedExtra: null,
    score: { home: 1, away: 0, halftime: null, extratime: null, penalty: null },
    finishedAt: over.finishedAt ?? null,
    venue: null,
    referee: null,
    source: { provider: 'api-football', id: '1001', attribution: null },
  } as Match;
}

const p = (playerId: string, name: string, minutes: number | null, number: number | null = null) => ({
  playerId,
  name,
  photo: null,
  number,
  position: null,
  minutes,
  rating: 7,
});
const players = (sporting = [p('10', 'Trincão', 90, 17), p('20', 'Gyökeres', 85, 9), p('30', 'Banco', 0)]): L => ({
  status: 'ready',
  data: { teams: [{ teamId: '228', players: sporting }, { teamId: '217', players: [p('99', 'Adversário', 90)] }] },
});
const vote = (playerId: string): L => ({
  status: 'ready',
  data: { gameId: '1001', userId: 'u1', playerId, createdAt: null, source: 'v2027' },
});
const ev = (type: string, points: number) => ({ uid: 'u1', gameId: '1001', type, points, gameDate: NOW });

const press = (label: string) => fireEvent.press(screen.getByLabelText(label));
const tick = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });
const flush = () => act(async () => {});

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  jest.clearAllMocks();
  mockSession.status = 'signedIn';
  mockData.vote = { status: 'missing' };
  mockData.settlement = { status: 'missing' };
  mockData.points = { status: 'ready', data: [] };
  mockData.players = players();
  (httpsCallable as jest.Mock).mockImplementation(() => mockCall);
  mockCall.mockResolvedValue({ data: { ok: true } });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('Antes de abrir', () => {
  it('ao vivo antes do minuto 80: quando abre e quanto falta, sem lista', async () => {
    await render(<MvpTab match={match({ elapsed: 62 })} />, { wrapper });
    expect(screen.getByText('A votação abre ao minuto 80.')).toBeTruthy();
    expect(screen.getByText('Faltam cerca de 18 min.')).toBeTruthy();
    expect(screen.queryByLabelText('Votar em Trincão')).toBeNull();
  });

  it('antes do jogo e ao intervalo: só quando abre', async () => {
    const { rerender } = await render(<MvpTab match={match({ status: 'NS', elapsed: null })} />, { wrapper });
    expect(screen.getByText('A votação abre ao minuto 80.')).toBeTruthy();
    expect(screen.queryByText(/Faltam cerca de/)).toBeNull();

    await rerender(<MvpTab match={match({ status: 'HT', elapsed: 45 })} />);
    expect(screen.getByText('A votação abre ao minuto 80.')).toBeTruthy();
    expect(screen.queryByText(/Faltam cerca de/)).toBeNull();
  });

  it('pede só o documento players do jogo', async () => {
    await render(<MvpTab match={match()} />, { wrapper });
    expect(useMatchDetail).toHaveBeenCalledWith('1001', 'players');
  });
});

describe('Votação aberta', () => {
  it('ao vivo: candidatos do Sporting que jogaram, por nome, e o aviso do fecho', async () => {
    await render(<MvpTab match={match()} />, { wrapper });
    expect(screen.getByText('Fecha 20 minutos depois do apito final.')).toBeTruthy();
    const names = screen.getAllByTestId(/^mvp-candidate-/).map((n) => n.props.testID);
    expect(names).toEqual(['mvp-candidate-20', 'mvp-candidate-10']); // Gyökeres antes de Trincão
    expect(screen.queryByLabelText('Votar em Banco')).toBeNull();
    expect(screen.queryByLabelText('Votar em Adversário')).toBeNull();
  });

  it('o minuto 80 abre a lista sozinho (o jogo chega por onSnapshot)', async () => {
    const { rerender } = await render(<MvpTab match={match({ elapsed: 79 })} />, { wrapper });
    expect(screen.queryByLabelText('Votar em Trincão')).toBeNull();
    await rerender(<MvpTab match={match({ elapsed: 80 })} />);
    expect(screen.getByLabelText('Votar em Trincão')).toBeTruthy();
  });

  // Review Focus 1
  it('sem documento players: candidatos aparecem com os dados do jogo, sem botões', async () => {
    mockData.players = { status: 'missing' };
    await render(<MvpTab match={match()} />, { wrapper });
    expect(screen.getByText('Os candidatos aparecem quando houver dados do jogo.')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('documento players só com o adversário: a mesma mensagem', async () => {
    mockData.players = { status: 'ready', data: { teams: [{ teamId: '217', players: [p('99', 'Adversário', 90)] }] } };
    await render(<MvpTab match={match()} />, { wrapper });
    expect(screen.getByText('Os candidatos aparecem quando houver dados do jogo.')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('a lista acompanha o snapshot: quem entra depois do minuto 80 aparece', async () => {
    const { rerender } = await render(<MvpTab match={match()} />, { wrapper });
    expect(screen.queryByLabelText('Votar em Quenda')).toBeNull();
    mockData.players = players([p('10', 'Trincão', 90, 17), p('20', 'Gyökeres', 85, 9), p('40', 'Quenda', 3, 57)]);
    await rerender(<MvpTab match={match({ elapsed: 88 })} />);
    expect(screen.getByLabelText('Votar em Quenda')).toBeTruthy();
  });

  it('depois do fim: contagem "Fecha em mm:ss" a cada segundo', async () => {
    // finishedAt há 19 min → fecha daqui a 1 min
    await render(<MvpTab match={match({ status: 'FT', elapsed: 90, finishedAt: new Date(NOW.getTime() - 19 * 60_000) })} />, { wrapper });
    expect(screen.getByText('Fecha em 01:00')).toBeTruthy();
    await tick(1_000);
    expect(screen.getByText('Fecha em 00:59')).toBeTruthy();
  });

  it('a contagem chega a zero e a votação fecha sozinha sem chamar o servidor', async () => {
    await render(<MvpTab match={match({ status: 'FT', elapsed: 90, finishedAt: new Date(NOW.getTime() - 20 * 60_000 + 2_000) })} />, { wrapper });
    expect(screen.getByLabelText('Votar em Trincão')).toBeTruthy();
    await tick(2_000);
    expect(screen.queryByLabelText('Votar em Trincão')).toBeNull();
    expect(screen.getByText('A votação já fechou.')).toBeTruthy();
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('escolher pede confirmação e só depois chama voteMvp, uma vez', async () => {
    await render(<MvpTab match={match()} />, { wrapper });
    await press('Votar em Trincão');
    expect(screen.getByText('Votar em Trincão? É definitivo.')).toBeTruthy();
    expect(mockCall).not.toHaveBeenCalled();

    await press('Confirmar');
    await flush();
    expect(httpsCallable).toHaveBeenCalledWith({ __mock: 'functions' }, 'voteMvp');
    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(mockCall).toHaveBeenCalledWith({ gameId: '1001', playerId: '10' });
    expect(screen.getByText('O teu voto: Trincão')).toBeTruthy();
    expect(screen.queryByLabelText('Votar em Gyökeres')).toBeNull();
  });

  it('cancelar não chama o servidor e a escolha fica marcada', async () => {
    await render(<MvpTab match={match()} />, { wrapper });
    await press('Votar em Trincão');
    await press('Cancelar');
    expect(screen.queryByText('Votar em Trincão? É definitivo.')).toBeNull();
    expect(mockCall).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Votar em Trincão').props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
  });
});

describe('Erros da callable', () => {
  async function voteTrincao(m = match()) {
    await render(<MvpTab match={m} />, { wrapper });
    await press('Votar em Trincão');
    await press('Confirmar');
    await flush();
  }

  // Review Focus 3
  it('sem rede (unavailable): mensagem clara, a escolha fica e pode tentar outra vez', async () => {
    mockCall.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'unavailable' }));
    await voteTrincao();
    expect(screen.getByText('Sem ligação. O teu voto não foi enviado; tenta outra vez.')).toBeTruthy();
    expect(screen.getByLabelText('Votar em Trincão').props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    expect(recordError).not.toHaveBeenCalled();

    await press('Votar em Trincão');
    await press('Confirmar');
    await flush();
    expect(mockCall).toHaveBeenCalledTimes(2);
    expect(screen.getByText('O teu voto: Trincão')).toBeTruthy();
  });

  it('sem rede (internal com mensagem de rede): mensagem de sem ligação e não vai ao Crashlytics', async () => {
    mockCall.mockRejectedValueOnce(
      Object.assign(new Error('A network error (such as timeout, interrupted connection or unreachable host) has occurred.'), {
        code: 'internal',
      }),
    );
    await voteTrincao();
    expect(screen.getByText('Sem ligação. O teu voto não foi enviado; tenta outra vez.')).toBeTruthy();
    expect(screen.getByLabelText('Votar em Trincão').props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    expect(recordError).not.toHaveBeenCalled();
  });

  it('MVP_CLOSED: "A votação já fechou." e a lista desaparece', async () => {
    mockCall.mockRejectedValueOnce(Object.assign(new Error('MVP_CLOSED'), { code: 'failed-precondition' }));
    await voteTrincao();
    expect(screen.getByText('A votação já fechou.')).toBeTruthy();
    expect(screen.queryByLabelText('Votar em Trincão')).toBeNull();
  });

  it('MVP_NOT_OPEN: a votação ainda não abriu (relógio do telemóvel adiantado)', async () => {
    mockCall.mockRejectedValueOnce(Object.assign(new Error('MVP_NOT_OPEN'), { code: 'failed-precondition' }));
    await voteTrincao();
    expect(screen.getByText('A votação ainda não abriu. Tenta daqui a pouco.')).toBeTruthy();
  });

  it.each([
    ['already-exists', 'Já votaste neste jogo.'],
    ['invalid-argument', 'Este jogador não está entre os candidatos. Escolhe outro.'],
    ['unauthenticated', 'A sessão terminou. Entra outra vez para votares.'],
    ['not-found', 'Não foi possível enviar o voto. Tenta outra vez.'],
  ])('%s → %s', async (code, text) => {
    mockCall.mockRejectedValueOnce(Object.assign(new Error('x'), { code }));
    await voteTrincao();
    expect(screen.getByText(text)).toBeTruthy();
  });

  it('o desconhecido (not-found) vai ao Crashlytics', async () => {
    mockCall.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'not-found' }));
    await voteTrincao();
    expect(recordError).toHaveBeenCalledTimes(1);
  });
});

describe('Votado, fechado e apurado', () => {
  it('voto guardado: "O teu voto" e sem lista', async () => {
    mockData.vote = vote('20');
    await render(<MvpTab match={match()} />, { wrapper });
    expect(screen.getByText('O teu voto: Gyökeres')).toBeTruthy();
    expect(screen.queryByLabelText('Votar em Trincão')).toBeNull();
  });

  it('fechado sem settlements: a apurar o MVP oficial', async () => {
    mockData.vote = vote('20');
    await render(<MvpTab match={match({ status: 'FT', elapsed: 90, finishedAt: new Date(NOW.getTime() - 30 * 60_000) })} />, { wrapper });
    expect(screen.getByText('O teu voto: Gyökeres')).toBeTruthy();
    expect(screen.getByText('A apurar o MVP oficial.')).toBeTruthy();
  });

  it('fechado sem voto: a votação fechou e a apurar', async () => {
    await render(<MvpTab match={match({ status: 'FT', elapsed: 90, finishedAt: new Date(NOW.getTime() - 30 * 60_000) })} />, { wrapper });
    expect(screen.getByText('A votação já fechou.')).toBeTruthy();
    expect(screen.getByText('A apurar o MVP oficial.')).toBeTruthy();
    expect(screen.queryByLabelText('Votar em Trincão')).toBeNull();
  });

  it('apurado com acerto: MVP oficial e "+2 pontos"', async () => {
    mockData.vote = vote('20');
    mockData.settlement = { status: 'ready', data: { finalHome: 1, finalAway: 0, officialMvp: ['20'] } };
    mockData.points = { status: 'ready', data: [ev('mvp_participation', 1), ev('mvp_correct', 2), ev('prediction_exact', 3)] };
    await render(<MvpTab match={match({ status: 'FT', elapsed: 90, finishedAt: new Date(NOW.getTime() - 3 * 3_600_000) })} />, { wrapper });
    expect(screen.getByText('MVP oficial: Gyökeres')).toBeTruthy();
    expect(screen.getByText('+2 pontos')).toBeTruthy();
    expect(screen.queryByText('A apurar o MVP oficial.')).toBeNull();
  });

  it('apurado sem acerto: MVP oficial e sem pontos de acerto', async () => {
    mockData.vote = vote('10');
    mockData.settlement = { status: 'ready', data: { finalHome: 1, finalAway: 0, officialMvp: ['20'] } };
    mockData.points = { status: 'ready', data: [ev('mvp_participation', 1)] };
    await render(<MvpTab match={match({ status: 'FT', elapsed: 90, finishedAt: new Date(NOW.getTime() - 3 * 3_600_000) })} />, { wrapper });
    expect(screen.getByText('MVP oficial: Gyökeres')).toBeTruthy();
    expect(screen.queryByText('+2 pontos')).toBeNull();
  });

  it('empate no MVP oficial mostra os dois nomes', async () => {
    mockData.settlement = { status: 'ready', data: { finalHome: 1, finalAway: 0, officialMvp: ['10', '20'] } };
    await render(<MvpTab match={match({ status: 'FT', elapsed: 90, finishedAt: new Date(NOW.getTime() - 3 * 3_600_000) })} />, { wrapper });
    expect(screen.getByText('MVP oficial: Trincão e Gyökeres')).toBeTruthy();
  });

  it('apurado sem MVP oficial (sem notas da API)', async () => {
    mockData.settlement = { status: 'ready', data: { finalHome: 1, finalAway: 0, officialMvp: [] } };
    await render(<MvpTab match={match({ status: 'FT', elapsed: 90, finishedAt: new Date(NOW.getTime() - 3 * 3_600_000) })} />, { wrapper });
    expect(screen.getByText('Sem MVP oficial neste jogo.')).toBeTruthy();
  });

  it('a carregar o voto: sem lista', async () => {
    mockData.vote = { status: 'loading' };
    await render(<MvpTab match={match()} />, { wrapper });
    expect(screen.getByTestId('mvp-loading')).toBeTruthy();
    expect(screen.queryByLabelText('Votar em Trincão')).toBeNull();
  });

  it('sem sessão: pede para entrar', async () => {
    mockSession.status = 'signedOut';
    await render(<MvpTab match={match()} />, { wrapper });
    expect(screen.getByText('Entra na tua conta para votares no MVP.')).toBeTruthy();
    expect(screen.queryByLabelText('Votar em Trincão')).toBeNull();
  });

  it('dados em cache (sem ligação): aviso offline', async () => {
    mockData.players = { ...(players() as { status: 'ready'; data: unknown }), fromCache: true };
    await render(<MvpTab match={match()} />, { wrapper });
    expect(screen.getByText('Sem ligação. A mostrar os últimos dados guardados.')).toBeTruthy();
  });
});

describe('Adiado e cancelado (Review Focus 2)', () => {
  it('PST: sem votação, jogo adiado, sem lista', async () => {
    await render(<MvpTab match={match({ status: 'PST', elapsed: null })} />, { wrapper });
    expect(screen.getByText('Sem votação: jogo adiado.')).toBeTruthy();
    expect(screen.queryByLabelText('Votar em Trincão')).toBeNull();
    expect(screen.queryByText('A votação abre ao minuto 80.')).toBeNull();
  });

  it('CANC: sem votação, jogo cancelado, sem lista', async () => {
    await render(<MvpTab match={match({ status: 'CANC', elapsed: null })} />, { wrapper });
    expect(screen.getByText('Sem votação: jogo cancelado.')).toBeTruthy();
    expect(screen.queryByLabelText('Votar em Trincão')).toBeNull();
  });
});
