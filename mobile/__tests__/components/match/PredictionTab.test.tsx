// Task 16: tab Prognóstico. Hooks de dados e sessão mockados; a callable é a do RNFB (mock em __mocks__),
// chamada pelo services/game real, para testar o caminho completo até ao código de erro do servidor.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { CompetitionType, GameStatus, Match } from '@/data/schemas';

type L =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; data: unknown; fromCache?: boolean };
const mockData: { prediction: L; settlement: L; points: L } = {
  prediction: { status: 'missing' },
  settlement: { status: 'missing' },
  points: { status: 'ready', data: [] },
};
const mockCall = jest.fn();

jest.mock('@react-native-firebase/functions');
jest.mock('@react-native-firebase/crashlytics');
jest.mock('@/services/firebase', () => ({ fns: jest.fn(() => ({ __mock: 'functions' })) }));
jest.mock('@/providers/SessionProvider', () => ({
  useSession: () => ({ status: 'signedIn', user: { uid: 'u1', email: null, providers: [] } }),
}));
// Task 17: a partilha mede pelo track (mock) e usa os mocks de react-native-share / view-shot / qrcode (__mocks__).
jest.mock('@/services/analytics', () => ({ track: jest.fn() }));
jest.mock('@/data/user', () => ({
  useMyPrediction: jest.fn(() => mockData.prediction),
  useSettlement: jest.fn(() => mockData.settlement),
  useMyGamePoints: jest.fn(() => mockData.points),
}));

import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { httpsCallable } from '@react-native-firebase/functions';
import { recordError } from '@react-native-firebase/crashlytics';
import Share from 'react-native-share';
import { captureRef } from 'react-native-view-shot';
import { track } from '@/services/analytics';
import { Stepper } from '@/components/Stepper';
import { PredictionTab } from '@/components/match/PredictionTab';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 44, left: 0, right: 0, bottom: 34 } };
const wrapper = ({ children }: { children: ReactNode }) => (
  <SafeAreaProvider initialMetrics={METRICS}>{children}</SafeAreaProvider>
);

const NOW = new Date('2026-11-21T17:45:00Z');
const KICKOFF = new Date('2026-11-21T20:00:00Z'); // 2 h 15 min depois de NOW

function match(over: { status?: GameStatus; kickoff?: Date; type?: CompetitionType; round?: string } = {}): Match {
  return {
    id: '1001',
    sport: 'football',
    competition: { key: 'football_94_2026', id: '94', name: 'Liga Portugal', type: over.type ?? 'league', season: '2026', round: over.round ?? 'Regular Season - 12', roundLabel: null },
    home: { id: '228', name: 'Sporting CP', logo: null },
    away: { id: '217', name: 'SC Braga', logo: null },
    sportingSide: 'home',
    kickoff: over.kickoff ?? KICKOFF,
    status: over.status ?? 'NS',
    elapsed: null,
    elapsedExtra: null,
    score: { home: null, away: null, halftime: null, extratime: null, penalty: null },
    finishedAt: null,
    venue: null,
    referee: null,
    source: { provider: 'api-football', id: '1001', attribution: null },
  } as Match;
}

const prediction = (home: number, away: number): L => ({
  status: 'ready',
  data: { gameId: '1001', userId: 'u1', home, away, createdAt: null, source: 'v2027' },
});
const ev = (type: string, points: number) => ({ uid: 'u1', gameId: '1001', type, points, gameDate: KICKOFF });

const value = (label: string) => screen.getByTestId(`stepper-value-${label}`).props.children;
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
  mockData.prediction = { status: 'missing' };
  mockData.settlement = { status: 'missing' };
  mockData.points = { status: 'ready', data: [] };
  (httpsCallable as jest.Mock).mockImplementation(() => mockCall);
  mockCall.mockResolvedValue({ data: { ok: true } });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('Stepper', () => {
  it('não passa de 20 nem desce de 0', async () => {
    const onChange = jest.fn();
    const { rerender } = await render(<Stepper label="Sporting CP" value={20} onChange={onChange} min={0} max={20} />);
    await press('Mais um golo para Sporting CP');
    expect(onChange).not.toHaveBeenCalled();
    await press('Menos um golo para Sporting CP');
    expect(onChange).toHaveBeenLastCalledWith(19);

    onChange.mockClear();
    await rerender(<Stepper label="Sporting CP" value={0} onChange={onChange} min={0} max={20} />);
    await press('Menos um golo para Sporting CP');
    expect(onChange).not.toHaveBeenCalled();
    await press('Mais um golo para Sporting CP');
    expect(onChange).toHaveBeenLastCalledWith(1);
  });
});

describe('Prognóstico aberto', () => {
  it('mostra equipas, contagem, regras e sem nota das taças numa liga', async () => {
    await render(<PredictionTab match={match()} />, { wrapper });
    expect(screen.getByText('Sporting CP')).toBeTruthy();
    expect(screen.getByText('SC Braga')).toBeTruthy();
    expect(screen.getByText('Fecha em 2 h 15 min')).toBeTruthy();
    expect(screen.getByText('+1 por participares, +3 resultado exato, +1 vencedor ou empate certo')).toBeTruthy();
    expect(screen.queryByText('Nos jogos a eliminar conta o resultado com prolongamento; penáltis contam como empate.')).toBeNull();
    expect(value('Sporting CP')).toBe(0);
    expect(value('SC Braga')).toBe(0);
  });

  it('em taças mostra a regra do prolongamento e penáltis', async () => {
    await render(<PredictionTab match={match({ type: 'cup' })} />, { wrapper });
    expect(screen.getByText('Nos jogos a eliminar conta o resultado com prolongamento; penáltis contam como empate.')).toBeTruthy();
  });

  // Task 17 (carry da revisão da Task 16): o servidor conta prolongamento e penáltis em todos os jogos a eliminar.
  it.each([
    ['supertaça', { type: 'supercup' as const, round: 'Final' }],
    ['eliminatória europeia', { type: 'europe' as const, round: 'Round of 16' }],
    ['play-off europeu', { type: 'europe' as const, round: 'Knockout Round Play-offs' }],
  ])('%s mostra a regra do prolongamento e penáltis', async (_, over) => {
    await render(<PredictionTab match={match(over)} />, { wrapper });
    expect(screen.getByText('Nos jogos a eliminar conta o resultado com prolongamento; penáltis contam como empate.')).toBeTruthy();
  });

  it('fase de liga europeia não mostra a regra do prolongamento', async () => {
    await render(<PredictionTab match={match({ type: 'europe', round: 'League Stage - 3' })} />, { wrapper });
    expect(screen.queryByText('Nos jogos a eliminar conta o resultado com prolongamento; penáltis contam como empate.')).toBeNull();
  });

  it('sem prognóstico não há botão de partilha', async () => {
    await render(<PredictionTab match={match()} />, { wrapper });
    expect(screen.queryByLabelText('Partilhar prognóstico')).toBeNull();
  });

  it('a contagem atualiza a cada 30 s', async () => {
    await render(<PredictionTab match={match({ kickoff: new Date(NOW.getTime() + 2 * 60_000 + 10_000) })} />, { wrapper });
    expect(screen.getByText('Fecha em 2 min')).toBeTruthy();
    await tick(30_000);
    expect(screen.getByText('Fecha em 1 min')).toBeTruthy();
  });

  it('submeter exige confirmação e chama a callable uma vez', async () => {
    await render(<PredictionTab match={match()} />, { wrapper });
    await press('Mais um golo para Sporting CP');
    await press('Mais um golo para Sporting CP');
    await press('Mais um golo para SC Braga');
    await press('Submeter prognóstico');

    expect(screen.getByText('É definitivo. Confirmas 2-1?')).toBeTruthy();
    expect(mockCall).not.toHaveBeenCalled();

    await press('Confirmar');
    await flush();
    expect(httpsCallable).toHaveBeenCalledWith({ __mock: 'functions' }, 'submitPrediction');
    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(mockCall).toHaveBeenCalledWith({ gameId: '1001', home: 2, away: 1 });
    expect(screen.getByText('O teu prognóstico: 2-1')).toBeTruthy();
    expect(screen.queryByLabelText('Submeter prognóstico')).toBeNull();
  });

  it('cancelar a confirmação não chama o servidor e mantém os valores', async () => {
    await render(<PredictionTab match={match()} />, { wrapper });
    await press('Mais um golo para SC Braga');
    await press('Submeter prognóstico');
    await press('Cancelar');
    expect(screen.queryByText('É definitivo. Confirmas 0-1?')).toBeNull();
    expect(mockCall).not.toHaveBeenCalled();
    expect(value('SC Braga')).toBe(1);
  });

  it('fecha sozinho no kickoff sem chamar o servidor', async () => {
    await render(<PredictionTab match={match({ kickoff: new Date(NOW.getTime() + 45_000) })} />, { wrapper });
    expect(screen.getByLabelText('Submeter prognóstico')).toBeTruthy();
    await tick(45_000);
    expect(screen.queryByLabelText('Submeter prognóstico')).toBeNull();
    expect(screen.getByText('Os prognósticos fecharam ao apito inicial.')).toBeTruthy();
    expect(mockCall).not.toHaveBeenCalled();
  });
});

describe('Erros da callable', () => {
  async function submit21() {
    await render(<PredictionTab match={match()} />, { wrapper });
    await press('Mais um golo para Sporting CP');
    await press('Mais um golo para Sporting CP');
    await press('Mais um golo para SC Braga');
    await press('Submeter prognóstico');
    await press('Confirmar');
    await flush();
  }

  // Review Focus 3
  it('sem rede (unavailable): mensagem clara e os valores escolhidos ficam', async () => {
    mockCall.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'unavailable' }));
    await submit21();
    expect(screen.getByText('Sem ligação. O teu prognóstico não foi enviado; tenta outra vez.')).toBeTruthy();
    expect(value('Sporting CP')).toBe(2);
    expect(value('SC Braga')).toBe(1);
    expect(screen.getByLabelText('Submeter prognóstico')).toBeTruthy();
  });

  // Task 17 (carry da revisão da Task 16): no telemóvel, sem rede o SDK costuma dar `internal` com mensagem de rede.
  it('sem rede (internal com mensagem de rede): mensagem de sem ligação, valores ficam e não vai ao Crashlytics', async () => {
    mockCall.mockRejectedValueOnce(
      Object.assign(new Error('A network error (such as timeout, interrupted connection or unreachable host) has occurred.'), {
        code: 'internal',
      }),
    );
    await submit21();
    expect(screen.getByText('Sem ligação. O teu prognóstico não foi enviado; tenta outra vez.')).toBeTruthy();
    expect(value('Sporting CP')).toBe(2);
    expect(value('SC Braga')).toBe(1);
    expect(recordError).not.toHaveBeenCalled();
  });

  it('janela fechada no servidor (failed-precondition): mensagem de fechado e sem botão', async () => {
    mockCall.mockRejectedValueOnce(Object.assign(new Error('PREDICTION_CLOSED'), { code: 'failed-precondition' }));
    await submit21();
    expect(screen.getByText('Os prognósticos fecharam ao apito inicial.')).toBeTruthy();
    expect(screen.queryByLabelText('Submeter prognóstico')).toBeNull();
  });

  it('já submetido (already-exists)', async () => {
    mockCall.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'already-exists' }));
    await submit21();
    expect(screen.getByText('Já submeteste este prognóstico.')).toBeTruthy();
  });

  it('sessão em falta (unauthenticated) e resultado inválido (invalid-argument) mantêm os valores', async () => {
    mockCall.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'unauthenticated' }));
    await submit21();
    expect(screen.getByText('A sessão terminou. Entra outra vez para fazeres o prognóstico.')).toBeTruthy();
    expect(value('Sporting CP')).toBe(2);

    mockCall.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'invalid-argument' }));
    await press('Submeter prognóstico');
    await press('Confirmar');
    await flush();
    expect(screen.getByText('Resultado inválido. Escolhe entre 0 e 20 golos.')).toBeTruthy();
    expect(value('SC Braga')).toBe(1);
  });
});

describe('Prognóstico feito, liquidado e fechado', () => {
  it('prognóstico existente mostra "2-1" e sem formulário', async () => {
    mockData.prediction = prediction(2, 1);
    await render(<PredictionTab match={match()} />, { wrapper });
    expect(screen.getByText('O teu prognóstico: 2-1')).toBeTruthy();
    expect(screen.queryByLabelText('Submeter prognóstico')).toBeNull();
  });

  it('liquidado: resultado final e pontos do prognóstico somados (1 + 3 → "+4 pontos"; MVP não conta)', async () => {
    mockData.prediction = prediction(2, 1);
    mockData.settlement = { status: 'ready', data: { finalHome: 2, finalAway: 1, officialMvp: [] } };
    mockData.points = {
      status: 'ready',
      data: [ev('prediction_participation', 1), ev('prediction_exact', 3), ev('mvp_participation', 1)],
    };
    await render(<PredictionTab match={match({ status: 'FT', kickoff: new Date('2026-11-20T20:00:00Z') })} />, { wrapper });
    expect(screen.getByText('Resultado final: 2-1')).toBeTruthy();
    expect(screen.getByText('O teu prognóstico: 2-1')).toBeTruthy();
    expect(screen.getByText('+4 pontos')).toBeTruthy();
  });

  it('fechado sem prognóstico', async () => {
    await render(<PredictionTab match={match({ status: 'LIVE', kickoff: new Date('2026-11-21T17:00:00Z') })} />, { wrapper });
    expect(screen.getByText('Os prognósticos fecharam ao apito inicial.')).toBeTruthy();
    expect(screen.queryByLabelText('Submeter prognóstico')).toBeNull();
  });

  it('a carregar o prognóstico: sem formulário', async () => {
    mockData.prediction = { status: 'loading' };
    await render(<PredictionTab match={match()} />, { wrapper });
    expect(screen.getByTestId('prediction-loading')).toBeTruthy();
    expect(screen.queryByLabelText('Submeter prognóstico')).toBeNull();
  });
});

describe('Adiado e cancelado (Review Focus 2)', () => {
  it('PST sem prognóstico: mensagem de adiado e sem botão; volta a NS com nova data → o formulário volta', async () => {
    const { rerender } = await render(<PredictionTab match={match({ status: 'PST' })} />, { wrapper });
    expect(screen.getByText('Jogo adiado. Podes fazer o prognóstico quando houver nova data.')).toBeTruthy();
    expect(screen.queryByLabelText('Submeter prognóstico')).toBeNull();

    await rerender(<PredictionTab match={match({ status: 'NS', kickoff: new Date('2026-11-22T20:00:00Z') })} />);
    expect(screen.queryByText('Jogo adiado. Podes fazer o prognóstico quando houver nova data.')).toBeNull();
    expect(screen.getByLabelText('Submeter prognóstico')).toBeTruthy();
    expect(screen.getByText('Fecha em 1 d 2 h')).toBeTruthy();
  });

  it('PST com prognóstico guardado mostra o prognóstico', async () => {
    mockData.prediction = prediction(1, 1);
    await render(<PredictionTab match={match({ status: 'PST' })} />, { wrapper });
    expect(screen.getByText('O teu prognóstico: 1-1')).toBeTruthy();
  });

  it('CANC: jogo cancelado, sem pontos', async () => {
    mockData.prediction = prediction(1, 0);
    await render(<PredictionTab match={match({ status: 'CANC' })} />, { wrapper });
    expect(screen.getByText('Jogo cancelado. Sem pontos.')).toBeTruthy();
    expect(screen.queryByLabelText('Submeter prognóstico')).toBeNull();
  });
});

// Task 17: botão "Partilhar prognóstico" quando há prognóstico; abre o cartão "S360 MATCHDAY" e partilha imagem + texto.
describe('Partilhar prognóstico', () => {
  it('prognóstico guardado: abre o cartão, partilha e fecha', async () => {
    mockData.prediction = prediction(2, 1);
    await render(<PredictionTab match={match()} />, { wrapper });
    await press('Partilhar prognóstico');
    expect(screen.getByText('#JogoAJogoLadoALado')).toBeTruthy();
    expect(screen.getByTestId('share-score-home')).toHaveTextContent('2');
    expect(screen.getByTestId('share-score-away')).toHaveTextContent('1');

    await press('Partilhar');
    await flush();
    expect(captureRef).toHaveBeenCalledTimes(1);
    expect(Share.open).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'file:///tmp/card.png',
        message: expect.stringContaining('https://s360-prognostico-download.web.app/j?src=share&game=1001'),
      }),
    );
    expect(track).toHaveBeenCalledWith('share_prediction', { game: '1001' });
    expect(screen.queryByText('#JogoAJogoLadoALado')).toBeNull();
  });

  it('fechar o cartão sem partilhar', async () => {
    mockData.prediction = prediction(2, 1);
    await render(<PredictionTab match={match()} />, { wrapper });
    await press('Partilhar prognóstico');
    await press('Fechar');
    expect(screen.queryByText('#JogoAJogoLadoALado')).toBeNull();
    expect(Share.open).not.toHaveBeenCalled();
  });

  it('logo depois de submeter já se pode partilhar', async () => {
    await render(<PredictionTab match={match()} />, { wrapper });
    await press('Mais um golo para Sporting CP');
    await press('Submeter prognóstico');
    await press('Confirmar');
    await flush();
    await press('Partilhar prognóstico');
    expect(screen.getByTestId('share-score-home')).toHaveTextContent('1');
    expect(screen.getByTestId('share-score-away')).toHaveTextContent('0');
  });

  it('falha da captura: mensagem e o cartão fica aberto', async () => {
    mockData.prediction = prediction(2, 1);
    (captureRef as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'snap' }));
    await render(<PredictionTab match={match()} />, { wrapper });
    await press('Partilhar prognóstico');
    await press('Partilhar');
    await flush();
    expect(screen.getByText('Não foi possível partilhar. Tenta outra vez.')).toBeTruthy();
    expect(screen.getByText('#JogoAJogoLadoALado')).toBeTruthy();
    expect(recordError).toHaveBeenCalledTimes(1);
  });
});
