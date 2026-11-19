// Task 18: tab MVP. Hooks de dados e sessão mockados; a callable é a do RNFB (mock em __mocks__), chamada pelo
// services/game real, para testar o caminho completo até ao código de erro do servidor (functions/src/callables/voteMvp.ts).
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { colors } from '@/theme/tokens';
import type { GameStatus, Match } from '@/data/schemas';

type L =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; data: unknown; fromCache?: boolean };
const mockData: { vote: L; settlement: L; points: L; players: L; tally: L } = {
  vote: { status: 'missing' },
  settlement: { status: 'missing' },
  points: { status: 'ready', data: [] },
  players: { status: 'missing' },
  tally: { status: 'missing' },
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
  useMvpTally: jest.fn(() => mockData.tally),
}));

import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { httpsCallable } from '@react-native-firebase/functions';
import { recordError } from '@react-native-firebase/crashlytics';
import { useMatchDetail, useMvpTally } from '@/data/sports';
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
  photo: null as string | null,
  number,
  position: null as string | null,
  minutes,
  rating: 7 as number | null,
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
  mockData.tally = { status: 'missing' };
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

  it('leitura do players falhada com a votação aberta: erro, nunca a mensagem de sem candidatos', async () => {
    mockData.players = { status: 'error', error: new Error('x') };
    await render(<MvpTab match={match()} />, { wrapper });
    expect(screen.getByText('Não foi possível carregar os dados.')).toBeTruthy();
    expect(screen.queryByText('Os candidatos aparecem quando houver dados do jogo.')).toBeNull();
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

  it('escolher mostra o botão, que pede confirmação e só depois chama voteMvp, uma vez', async () => {
    await render(<MvpTab match={match()} />, { wrapper });
    await press('Votar em Trincão');
    expect(screen.queryByText('Votar em Trincão? É definitivo.')).toBeNull();
    await press('VOTAR EM TRINCÃO');
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
    await press('VOTAR EM TRINCÃO');
    await press('Cancelar');
    expect(screen.queryByText('Votar em Trincão? É definitivo.')).toBeNull();
    expect(mockCall).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Votar em Trincão').props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
  });
});

describe('Relógio de 1 segundo (carry da Task 18)', () => {
  const ended = (msAgo: number) => match({ status: 'FT', elapsed: 90, finishedAt: new Date(NOW.getTime() - msAgo) });
  // Intervalos de 1 s ainda ativos (criados e não limpos); os outros temporizadores do RN ficam de fora.
  const live = new Set<unknown>();
  let setSpy: jest.SpyInstance;
  let clearSpy: jest.SpyInstance;
  beforeEach(() => {
    live.clear();
    const realSet = global.setInterval;
    const realClear = global.clearInterval;
    setSpy = jest.spyOn(global, 'setInterval').mockImplementation(((fn: () => void, ms?: number) => {
      const id = realSet(fn, ms);
      if (ms === 1_000) live.add(id);
      return id;
    }) as typeof setInterval);
    clearSpy = jest.spyOn(global, 'clearInterval').mockImplementation(((id: never) => {
      live.delete(id);
      realClear(id);
    }) as typeof clearInterval);
  });
  afterEach(() => {
    setSpy.mockRestore();
    clearSpy.mockRestore();
  });
  const running = () => live.size;

  it('corre só até ao fecho e depois não fica nenhum intervalo', async () => {
    await render(<MvpTab match={ended(20 * 60_000 - 3_000)} />, { wrapper });
    expect(running()).toBe(1);
    await tick(2_000);
    expect(running()).toBe(1);
    await tick(1_000);
    expect(screen.getByText('A votação já fechou.')).toBeTruthy();
    expect(running()).toBe(0);
  });

  it('já fechado ao abrir o ecrã: não arranca intervalo', async () => {
    await render(<MvpTab match={ended(25 * 60_000)} />, { wrapper });
    expect(screen.getByText('A votação já fechou.')).toBeTruthy();
    expect(running()).toBe(0);
  });

  it('resultado apurado pára o intervalo, mesmo com a janela aberta', async () => {
    const { rerender } = await render(<MvpTab match={ended(10 * 60_000)} />, { wrapper });
    expect(running()).toBe(1);
    mockData.settlement = { status: 'ready', data: { finalHome: 1, finalAway: 0, officialMvp: ['10'] } };
    await rerender(<MvpTab match={ended(10 * 60_000)} />);
    expect(running()).toBe(0);
  });

  it('o servidor diz que fechou (relógio adiantado): pára o intervalo', async () => {
    mockCall.mockRejectedValueOnce(Object.assign(new Error('MVP_CLOSED'), { code: 'failed-precondition' }));
    await render(<MvpTab match={ended(10 * 60_000)} />, { wrapper });
    expect(running()).toBe(1);
    await press('Votar em Trincão');
    await press('VOTAR EM TRINCÃO');
    await press('Confirmar');
    await flush();
    expect(screen.getByText('A votação já fechou.')).toBeTruthy();
    expect(running()).toBe(0);
  });

  it('jogo ao vivo não tem intervalo', async () => {
    await render(<MvpTab match={match()} />, { wrapper });
    expect(running()).toBe(0);
  });
});

describe('Erros da callable', () => {
  async function voteTrincao(m = match()) {
    await render(<MvpTab match={m} />, { wrapper });
    await press('Votar em Trincão');
    await press('VOTAR EM TRINCÃO');
    await press('Confirmar');
    await flush();
  }

  // Review Focus 3
  it('sem rede (unavailable): repete uma vez e depois mensagem clara, a escolha fica e pode tentar outra vez', async () => {
    mockCall.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'unavailable' }));
    mockCall.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'unavailable' }));
    await voteTrincao();
    expect(mockCall).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Sem ligação. O teu voto não foi enviado; tenta outra vez.')).toBeTruthy();
    expect(screen.getByLabelText('Votar em Trincão').props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    expect(recordError).not.toHaveBeenCalled();

    await press('Votar em Trincão');
    await press('VOTAR EM TRINCÃO');
    await press('Confirmar');
    await flush();
    expect(mockCall).toHaveBeenCalledTimes(3);
    expect(screen.getByText('O teu voto: Trincão')).toBeTruthy();
  });

  it('unavailable uma vez (contenção): a repetição passa e o voto fica registado', async () => {
    mockCall.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'unavailable' }));
    await voteTrincao();
    expect(mockCall).toHaveBeenCalledTimes(2);
    expect(screen.getByText('O teu voto: Trincão')).toBeTruthy();
    expect(screen.queryByText('Sem ligação. O teu voto não foi enviado; tenta outra vez.')).toBeNull();
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
    ['invalid-argument', 'Este jogador não está entre os candidatos. Escolhe outro.'],
    ['unauthenticated', 'A sessão terminou. Entra outra vez para votares.'],
    ['not-found', 'Não foi possível enviar o voto. Tenta outra vez.'],
  ])('%s → %s', async (code, text) => {
    mockCall.mockRejectedValueOnce(Object.assign(new Error('x'), { code }));
    await voteTrincao();
    expect(screen.getByText(text)).toBeTruthy();
  });

  it('already-exists: "já votaste" sem erro e sem a lista', async () => {
    mockCall.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'already-exists' }));
    await voteTrincao();
    expect(screen.getByText('Já votaste neste jogo.')).toBeTruthy();
    expect(screen.queryByLabelText('Votar em Trincão')).toBeNull();
    expect(recordError).not.toHaveBeenCalled();
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

describe('Percentagens', () => {
  const tally = (counts: Record<string, number>, total: number): L => ({ status: 'ready', data: { gameId: '1001', counts, total } });
  const closedMatch = () => match({ status: 'FT', elapsed: 90, finishedAt: new Date(NOW.getTime() - 30 * 60_000) });

  it('aberta sem voto: nenhuma percentagem, mesmo com tally, e o documento nem é pedido', async () => {
    mockData.tally = tally({ '10': 3, '20': 1 }, 4);
    await render(<MvpTab match={match()} />, { wrapper });
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.queryByText(/votos?$/)).toBeNull();
    expect(useMvpTally).toHaveBeenLastCalledWith(null);
  });

  it('aberta com voto do próprio: 75%, 25% e "4 votos"', async () => {
    mockData.vote = vote('10');
    mockData.tally = tally({ '10': 3, '20': 1 }, 4);
    await render(<MvpTab match={match()} />, { wrapper });
    expect(useMvpTally).toHaveBeenLastCalledWith('1001');
    expect(within(screen.getByTestId('mvp-result-10')).getByText('75%')).toBeTruthy();
    expect(within(screen.getByTestId('mvp-result-20')).getByText('25%')).toBeTruthy();
    expect(screen.getByText('4 votos')).toBeTruthy();
    expect(screen.getByText('O teu voto: Trincão')).toBeTruthy();
  });

  it('um único voto: "1 voto"', async () => {
    mockData.vote = vote('10');
    mockData.tally = tally({ '10': 1 }, 1);
    await render(<MvpTab match={match()} />, { wrapper });
    expect(screen.getByText('1 voto')).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.getByText('0%')).toBeTruthy();
  });

  it('acabou de votar (sem snapshot ainda): as percentagens aparecem', async () => {
    mockData.tally = tally({ '10': 1, '20': 1 }, 2);
    await render(<MvpTab match={match()} />, { wrapper });
    expect(screen.queryByText(/%/)).toBeNull();
    await press('Votar em Trincão');
    await press('VOTAR EM TRINCÃO');
    await press('Confirmar');
    await flush();
    expect(within(screen.getByTestId('mvp-result-10')).getByText('50%')).toBeTruthy();
    expect(screen.getByText('2 votos')).toBeTruthy();
  });

  it('fechada sem voto: percentagens visíveis', async () => {
    mockData.tally = tally({ '10': 3, '20': 1 }, 4);
    await render(<MvpTab match={closedMatch()} />, { wrapper });
    expect(within(screen.getByTestId('mvp-result-10')).getByText('75%')).toBeTruthy();
    expect(screen.getByText('A votação já fechou.')).toBeTruthy();
    expect(screen.getByText('A apurar o MVP oficial.')).toBeTruthy();
  });

  it('apurado com MVP oficial: percentagens visíveis', async () => {
    mockData.settlement = { status: 'ready', data: { finalHome: 1, finalAway: 0, officialMvp: ['10'] } };
    mockData.tally = tally({ '10': 3, '20': 1 }, 4);
    await render(<MvpTab match={closedMatch()} />, { wrapper });
    expect(screen.getByText('MVP oficial: Trincão')).toBeTruthy();
    expect(within(screen.getByTestId('mvp-result-20')).getByText('25%')).toBeTruthy();
  });

  it('adiado: nenhuma percentagem', async () => {
    mockData.vote = vote('10');
    mockData.tally = tally({ '10': 3, '20': 1 }, 4);
    await render(<MvpTab match={match({ status: 'PST', elapsed: null })} />, { wrapper });
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('tally inexistente: sem percentagens, sem texto extra e sem erro', async () => {
    mockData.vote = vote('10');
    mockData.tally = { status: 'missing' };
    await render(<MvpTab match={match()} />, { wrapper });
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.queryByText(/votos?$/)).toBeNull();
    expect(screen.queryByText('Não foi possível carregar os dados.')).toBeNull();
    expect(screen.getByText('O teu voto: Trincão')).toBeTruthy();
  });

  it('total 0: sem percentagens e sem texto extra', async () => {
    mockData.vote = vote('10');
    mockData.tally = tally({}, 0);
    await render(<MvpTab match={match()} />, { wrapper });
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.queryByText(/votos?$/)).toBeNull();
  });

  it('erro de leitura do tally: sem percentagens e sem mensagem', async () => {
    mockData.vote = vote('10');
    mockData.tally = { status: 'error', error: new Error('x') };
    await render(<MvpTab match={match()} />, { wrapper });
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.queryByText('Não foi possível carregar os dados.')).toBeNull();
    expect(screen.getByText('O teu voto: Trincão')).toBeTruthy();
  });
});

describe('MVP com notas (V7.1)', () => {
  const q = (playerId: string, name: string, rating: number | null, over: Record<string, unknown> = {}) => ({
    ...p(playerId, name, 90, Number(playerId)),
    rating,
    position: 'Midfielder',
    ...over,
  });
  const withRatings = (): L =>
    players([q('10', 'Trincão', 8.1), q('20', 'Gyökeres', 8.6), q('30', 'Hjulmand', 7.4), q('40', 'Quenda', 6.9), q('50', 'Debast', 8.6)]);
  const bg = (id: string) => StyleSheet.flatten(screen.getByTestId(`mvp-rating-${id}`).props.style).backgroundColor;

  it('nada pré-selecionado e sem botão antes da escolha', async () => {
    mockData.players = withRatings();
    await render(<MvpTab match={match()} />, { wrapper });
    for (const n of ['Trincão', 'Gyökeres', 'Hjulmand', 'Quenda', 'Debast']) {
      expect(screen.getByLabelText(`Votar em ${n}`).props.accessibilityState).toEqual(expect.objectContaining({ selected: false }));
    }
    expect(screen.queryByLabelText(/^VOTAR EM /)).toBeNull();
  });

  it('o botão leva o nome escolhido em maiúsculas e muda com a escolha', async () => {
    mockData.players = withRatings();
    await render(<MvpTab match={match()} />, { wrapper });
    await press('Votar em Trincão');
    expect(screen.getByLabelText('VOTAR EM TRINCÃO')).toBeTruthy();
    expect(screen.getByLabelText('Votar em Trincão').props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    await press('Votar em Gyökeres');
    expect(screen.getByLabelText('VOTAR EM GYÖKERES')).toBeTruthy();
    expect(screen.queryByLabelText('VOTAR EM TRINCÃO')).toBeNull();
  });

  it('a ordem da lista não muda com as notas', async () => {
    mockData.players = withRatings();
    const { rerender } = await render(<MvpTab match={match()} />, { wrapper });
    const order = () => screen.getAllByTestId(/^mvp-candidate-/).map((n) => n.props.testID);
    const before = order();
    expect(before).toEqual(['mvp-candidate-50', 'mvp-candidate-20', 'mvp-candidate-30', 'mvp-candidate-40', 'mvp-candidate-10']);
    mockData.players = players([q('10', 'Trincão', 6.0), q('20', 'Gyökeres', 5.0), q('30', 'Hjulmand', 9.9), q('40', 'Quenda', 7.0), q('50', 'Debast', null)]);
    await rerender(<MvpTab match={match()} />);
    expect(order()).toEqual(before);
  });

  it('caixa da nota: 8.0 ou mais primary, 7.0 ou mais surface-20, abaixo surface-10', async () => {
    mockData.players = players([q('10', 'A', 8.0), q('20', 'B', 7.96), q('30', 'C', 7.0), q('40', 'D', 6.94), q('50', 'E', 6.0)]);
    await render(<MvpTab match={match()} />, { wrapper });
    expect(bg('10')).toBe(colors.primary);
    expect(bg('20')).toBe(colors.primary);
    expect(bg('30')).toBe(colors.surface20);
    expect(bg('40')).toBe(colors.surface10);
    expect(bg('50')).toBe(colors.surface10);
    expect(within(screen.getByTestId('mvp-rating-10')).getByText('8,0')).toBeTruthy();
  });

  it('selo "Melhor nota" só nos ids da nota máxima, com empate nos dois', async () => {
    mockData.players = withRatings();
    await render(<MvpTab match={match()} />, { wrapper });
    expect(screen.getAllByText('MELHOR NOTA')).toHaveLength(2);
    expect(screen.getByTestId('mvp-best-20')).toBeTruthy();
    expect(screen.getByTestId('mvp-best-50')).toBeTruthy();
    expect(screen.queryByTestId('mvp-best-10')).toBeNull();
    expect(screen.queryByTestId('mvp-best-30')).toBeNull();
  });

  it('sem notas: sem coluna da nota, sem selo e sem erro; o voto continua a funcionar', async () => {
    mockData.players = players([q('10', 'Trincão', null), q('20', 'Gyökeres', null)]);
    await render(<MvpTab match={match()} />, { wrapper });
    expect(screen.queryByTestId(/^mvp-rating-/)).toBeNull();
    expect(screen.queryByText('MELHOR NOTA')).toBeNull();
    expect(screen.queryByText(/API-Football/)).toBeNull();
    await press('Votar em Trincão');
    await press('VOTAR EM TRINCÃO');
    await press('Confirmar');
    await flush();
    expect(mockCall).toHaveBeenCalledWith({ gameId: '1001', playerId: '10' });
  });

  it('banner "Votação aberta", nota de referência, foto com número e posição', async () => {
    mockData.players = withRatings();
    await render(<MvpTab match={match()} />, { wrapper });
    expect(screen.getByText('VOTAÇÃO ABERTA')).toBeTruthy();
    expect(screen.getByText('Quem foi o melhor do Sporting? A nota é da API-Football e serve só de referência.')).toBeTruthy();
    expect(within(screen.getByTestId('mvp-candidate-10')).getByText('10')).toBeTruthy();
    expect(within(screen.getByTestId('mvp-candidate-10')).getByText('MED')).toBeTruthy();
    expect(within(screen.getByTestId('mvp-candidate-10')).getByTestId('player-silhouette')).toBeTruthy();
  });

  it('nome longo a 320 pt: uma linha com reticências, selo e nota presentes', async () => {
    mockData.players = players([q('10', 'Francisco Maximiliano Gonçalves de Albuquerque', 8.9)]);
    await render(<MvpTab match={match()} />, { wrapper });
    const row = screen.getByTestId('mvp-candidate-10');
    expect(within(row).getByText('Francisco Maximiliano Gonçalves de Albuquerque').props.numberOfLines).toBe(1);
    expect(within(row).getByText('MELHOR NOTA').props.numberOfLines).toBe(1);
    expect(screen.getByTestId('mvp-rating-10')).toBeTruthy();
  });
});
