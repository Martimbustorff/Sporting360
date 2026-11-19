// Plano 8, Task 5: callables do empréstimo (functions/src/callables/loans.ts) e mapeamento dos erros.
const mockCall = jest.fn();

jest.mock('@react-native-firebase/functions');
jest.mock('@react-native-firebase/crashlytics');
jest.mock('@/services/firebase', () => ({ fns: jest.fn(() => ({ __mock: 'functions' })) }));

import { recordError } from '@react-native-firebase/crashlytics';
import { httpsCallable } from '@react-native-firebase/functions';
import { cancelLoan, claimLoan, createLoan, LoanError, loanShareText } from '@/services/loans';

const err = (code: string, extra: Record<string, unknown> = {}) => Object.assign(new Error('x'), { code, ...extra });
const precondition = (reason: string) => err('functions/failed-precondition', { details: { reason } });

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(LoanError);
    return (e as LoanError).code;
  }
  throw new Error('não rejeitou');
}

beforeEach(() => {
  jest.clearAllMocks();
  (httpsCallable as jest.Mock).mockImplementation(() => mockCall);
});

describe('createLoan', () => {
  it('chama a callable com o payload exato e devolve loanId e url', async () => {
    mockCall.mockResolvedValueOnce({ data: { loanId: 'abc', url: 'https://x/e/abc' } });
    await expect(createLoan('g1', 'm1', '266571276572')).resolves.toEqual({ loanId: 'abc', url: 'https://x/e/abc' });
    expect(httpsCallable).toHaveBeenCalledWith({ __mock: 'functions' }, 'createLoan');
    expect(mockCall).toHaveBeenCalledWith({ gameboxId: 'g1', matchId: 'm1', number: '266571276572' });
  });

  it.each([
    [err('already-exists'), 'exists'],
    [precondition('not-next'), 'not-next'],
    [precondition('not-home'), 'not-home'],
    [precondition('finished'), 'finished'],
    [err('unavailable'), 'offline'],
    [err('deadline-exceeded'), 'offline'],
    [err('internal', { message: 'A network error has occurred.' }), 'offline'],
    [err('permission-denied'), 'unknown'],
    [err('not-found'), 'unknown'],
    [err('internal'), 'unknown'],
  ])('mapeia %#', async (e, expected) => {
    mockCall.mockRejectedValueOnce(e);
    expect(await codeOf(createLoan('g1', 'm1', '123456'))).toBe(expected);
  });

  it('resposta sem loanId e url dá unknown', async () => {
    mockCall.mockResolvedValueOnce({ data: {} });
    expect(await codeOf(createLoan('g1', 'm1', '123456'))).toBe('unknown');
  });

  it('só os erros desconhecidos vão ao Crashlytics, e nunca com o número', async () => {
    mockCall.mockRejectedValueOnce(err('unavailable'));
    await codeOf(createLoan('g1', 'm1', '266571276572'));
    expect(recordError).not.toHaveBeenCalled();
    mockCall.mockRejectedValueOnce(err('internal'));
    await codeOf(createLoan('g1', 'm1', '266571276572'));
    expect(recordError).toHaveBeenCalledTimes(1);
    expect(JSON.stringify((recordError as jest.Mock).mock.calls)).not.toContain('266571276572');
  });
});

describe('claimLoan e cancelLoan', () => {
  it('claimLoan devolve o estado', async () => {
    mockCall.mockResolvedValueOnce({ data: { status: 'owner' } });
    await expect(claimLoan('L1')).resolves.toBe('owner');
    expect(mockCall).toHaveBeenCalledWith({ loanId: 'L1' });
  });

  it.each([
    ['claimed-by-other'],
    ['inactive'],
  ])('claimLoan mapeia %s', async (reason) => {
    mockCall.mockRejectedValueOnce(precondition(reason));
    expect(await codeOf(claimLoan('L1'))).toBe(reason);
  });

  it('cancelLoan chama a callable e não devolve nada', async () => {
    mockCall.mockResolvedValueOnce({ data: { ok: true } });
    await expect(cancelLoan('L1')).resolves.toBeUndefined();
    expect(httpsCallable).toHaveBeenCalledWith({ __mock: 'functions' }, 'cancelLoan');
    expect(mockCall).toHaveBeenCalledWith({ loanId: 'L1' });
  });
});

describe('loanShareText', () => {
  it('é a frase combinada', () => {
    expect(loanShareText({ homeName: 'Sporting CP', awayName: 'FC Porto', url: 'https://h/e/abc' })).toBe(
      'Empresto-te a minha GameBox para o Sporting CP - FC Porto. Abre na app S360: https://h/e/abc',
    );
  });
});
