// Task 16: callables do jogo (submitPrediction, voteMvp) e mapeamento dos códigos de erro do servidor
// (functions/src/callables/submitPrediction.ts e voteMvp.ts).
const mockCall = jest.fn();

jest.mock('@react-native-firebase/functions');
jest.mock('@react-native-firebase/crashlytics');
jest.mock('@/services/firebase', () => ({ fns: jest.fn(() => ({ __mock: 'functions' })) }));

import { httpsCallable } from '@react-native-firebase/functions';
import { GameActionError } from '@/lib/gameWindows';
import { submitPrediction, voteMvp } from '@/services/game';

const err = (code: string, message = 'x') => Object.assign(new Error(message), { code });

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(GameActionError);
    return (e as GameActionError).code;
  }
  throw new Error('não rejeitou');
}

beforeEach(() => {
  jest.clearAllMocks();
  (httpsCallable as jest.Mock).mockImplementation(() => mockCall);
  mockCall.mockResolvedValue({ data: { ok: true } });
});

describe('submitPrediction', () => {
  it('chama a callable submitPrediction com o payload exato', async () => {
    await submitPrediction('1001', 2, 1);
    expect(httpsCallable).toHaveBeenCalledWith({ __mock: 'functions' }, 'submitPrediction');
    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(mockCall).toHaveBeenCalledWith({ gameId: '1001', home: 2, away: 1 });
  });

  it.each([
    ['failed-precondition', 'PREDICTION_CLOSED', 'CLOSED'],
    ['functions/failed-precondition', 'PREDICTION_CLOSED', 'CLOSED'],
    ['already-exists', 'Já submeteste este prognóstico.', 'ALREADY'],
    ['invalid-argument', 'Dados inválidos.', 'INVALID'],
    ['unavailable', 'x', 'OFFLINE'],
    ['deadline-exceeded', 'x', 'OFFLINE'],
    ['unauthenticated', 'Sessão necessária.', 'UNAUTHENTICATED'],
    ['not-found', 'Jogo não encontrado.', 'UNKNOWN'],
    ['internal', 'x', 'UNKNOWN'],
  ])('%s (%s) → %s', async (code, message, expected) => {
    mockCall.mockRejectedValueOnce(err(code, message));
    expect(await codeOf(submitPrediction('1001', 2, 1))).toBe(expected);
  });

  it('erro sem código → UNKNOWN', async () => {
    mockCall.mockRejectedValueOnce(new Error('boom'));
    expect(await codeOf(submitPrediction('1001', 2, 1))).toBe('UNKNOWN');
  });
});

describe('voteMvp', () => {
  it('chama a callable voteMvp com o payload exato', async () => {
    await voteMvp('1001', '2001');
    expect(httpsCallable).toHaveBeenCalledWith({ __mock: 'functions' }, 'voteMvp');
    expect(mockCall).toHaveBeenCalledWith({ gameId: '1001', playerId: '2001' });
  });

  it.each([
    ['failed-precondition', 'MVP_NOT_OPEN', 'NOT_OPEN'],
    ['failed-precondition', 'MVP_CLOSED', 'CLOSED'],
    ['already-exists', 'Já votaste neste jogo.', 'ALREADY'],
    ['invalid-argument', 'Jogador inválido.', 'INVALID'],
    ['unavailable', 'x', 'OFFLINE'],
  ])('%s (%s) → %s', async (code, message, expected) => {
    mockCall.mockRejectedValueOnce(err(code, message));
    expect(await codeOf(voteMvp('1001', '2001'))).toBe(expected);
  });
});
