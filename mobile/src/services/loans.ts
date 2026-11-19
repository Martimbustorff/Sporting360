// Plano 8, Task 5: empréstimo de GameBox. As únicas escritas, pelas callables (functions/src/callables/loans.ts); a app
// nunca escreve em `loans`. Erros: failed-precondition traz `details.reason`; already-exists = já há um ativo.
// Sem rede não vai ao Crashlytics. Nunca se regista o número, o uid nem nomes (o Crashlytics só recebe etiqueta e código).
import { httpsCallable } from '@react-native-firebase/functions';
import { codeOf, reportCode } from '@/lib/report';
import { fns } from '@/services/firebase';

export type LoanErrorCode = 'claimed-by-other' | 'inactive' | 'not-home' | 'not-next' | 'finished' | 'exists' | 'offline' | 'unknown';

export class LoanError extends Error {
  readonly code: LoanErrorCode;
  constructor(code: LoanErrorCode) {
    super(code);
    this.name = 'LoanError';
    this.code = code;
  }
}

const NETWORK_MESSAGE =
  /network|internet|offline|connection|unreachable|timed? ?out|resolve host|UnknownHost|ECONN|socket/i;
const REASONS: readonly LoanErrorCode[] = ['claimed-by-other', 'inactive', 'not-home', 'not-next', 'finished'];

function toCode(e: unknown, forClaim: boolean): LoanErrorCode {
  const code = (codeOf(e) ?? '').replace(/^functions\//, '');
  const obj = typeof e === 'object' && e !== null ? (e as { message?: unknown; details?: unknown }) : {};
  switch (code) {
    case 'already-exists':
      return 'exists';
    case 'not-found':
      // Abrir um link de um empréstimo que já não existe: "já não está ativo", sem tentar outra vez.
      return forClaim ? 'inactive' : 'unknown';
    case 'unavailable':
    case 'deadline-exceeded':
      return 'offline';
    case 'internal':
      return typeof obj.message === 'string' && NETWORK_MESSAGE.test(obj.message) ? 'offline' : 'unknown';
    case 'failed-precondition': {
      const reason = typeof obj.details === 'object' && obj.details !== null ? (obj.details as { reason?: unknown }).reason : undefined;
      return REASONS.find((r) => r === reason) ?? 'unknown';
    }
    default:
      return 'unknown';
  }
}

async function call(name: 'createLoan' | 'claimLoan' | 'cancelLoan', payload: object): Promise<unknown> {
  try {
    const res = await httpsCallable(fns(), name)(payload);
    return (res as { data?: unknown }).data;
  } catch (e) {
    const code = toCode(e, name === 'claimLoan');
    if (code === 'unknown') reportCode(`${name.toUpperCase()}_FAILED`, e);
    throw new LoanError(code);
  }
}

/** Cria o empréstimo do próximo jogo em casa do recinto; o servidor confirma que é esse jogo. */
export async function createLoan(gameboxId: string, matchId: string, number: string): Promise<{ loanId: string; url: string }> {
  const data = (await call('createLoan', { gameboxId, matchId, number })) as { loanId?: unknown; url?: unknown } | null | undefined;
  if (typeof data?.loanId !== 'string' || typeof data.url !== 'string') {
    reportCode('CREATELOAN_BAD_RESPONSE', null);
    throw new LoanError('unknown');
  }
  return { loanId: data.loanId, url: data.url };
}

/** Abrir o link (Task 6): `owner` quando quem abre é o próprio dono. */
export async function claimLoan(loanId: string): Promise<'claimed' | 'owner'> {
  const data = (await call('claimLoan', { loanId })) as { status?: unknown } | null | undefined;
  if (data?.status === 'claimed' || data?.status === 'owner') return data.status;
  reportCode('CLAIMLOAN_BAD_RESPONSE', null);
  throw new LoanError('unknown');
}

export async function cancelLoan(loanId: string): Promise<void> {
  await call('cancelLoan', { loanId });
}

/** Texto da partilha do link (Share nativo). */
export function loanShareText(loan: { homeName: string; awayName: string; url: string }): string {
  return `Empresto-te a minha GameBox para o ${loan.homeName} - ${loan.awayName}. Abre na app S360: ${loan.url}`;
}
