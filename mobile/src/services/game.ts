// Task 16: as únicas escritas do jogo, pelas callables do Plano 1 (a app nunca escreve prognósticos nem votos).
// Códigos lidos de functions/src/callables/submitPrediction.ts e voteMvp.ts:
//   unauthenticated → UNAUTHENTICATED; invalid-argument → INVALID; already-exists → ALREADY;
//   failed-precondition PREDICTION_CLOSED / MVP_CLOSED → CLOSED, MVP_NOT_OPEN → NOT_OPEN;
//   unavailable / deadline-exceeded (sem rede) → OFFLINE; internal com mensagem de rede → OFFLINE (Task 17: no
//   telemóvel, sem rede o SDK costuma dar `internal`; ver revisão da Task 16); not-found e o resto → UNKNOWN
//   (vai ao Crashlytics). OFFLINE nunca vai ao Crashlytics.
import { httpsCallable } from '@react-native-firebase/functions';
import { GameActionError, type GameActionCode } from '@/lib/gameWindows';
import { codeOf, reportCode } from '@/lib/report';
import { fns } from '@/services/firebase';

const messageOf = (e: unknown): unknown =>
  typeof e === 'object' && e !== null ? (e as { message?: unknown }).message : undefined;

/** Mensagens de falha de rede dos SDKs (Android: IOException / UnknownHost; iOS: NSURLError). */
const NETWORK_MESSAGE =
  /network|internet|offline|connection|unreachable|timed? ?out|resolve host|UnknownHost|ECONN|socket/i;

function toCode(e: unknown): GameActionCode {
  const code = (codeOf(e) ?? '').replace(/^functions\//, '');
  switch (code) {
    case 'unauthenticated':
      return 'UNAUTHENTICATED';
    case 'invalid-argument':
      return 'INVALID';
    case 'already-exists':
      return 'ALREADY';
    case 'unavailable':
    case 'deadline-exceeded':
      return 'OFFLINE';
    case 'internal': {
      const msg = messageOf(e);
      return typeof msg === 'string' && NETWORK_MESSAGE.test(msg) ? 'OFFLINE' : 'UNKNOWN';
    }
    case 'failed-precondition':
      return messageOf(e) === 'MVP_NOT_OPEN' ? 'NOT_OPEN' : 'CLOSED';
    default:
      return 'UNKNOWN';
  }
}

async function call(name: string, payload: object): Promise<void> {
  try {
    await httpsCallable(fns(), name)(payload);
  } catch (e) {
    const code = toCode(e);
    if (code === 'UNKNOWN') reportCode(`${name.toUpperCase()}_FAILED`, e);
    throw new GameActionError(code);
  }
}

/** Prognóstico definitivo de um jogo (0 a 20 golos por equipa, validado no servidor). */
export function submitPrediction(gameId: string, home: number, away: number): Promise<void> {
  return call('submitPrediction', { gameId, home, away });
}

/** Voto definitivo no MVP de um jogo (Task 18). */
export function voteMvp(gameId: string, playerId: string): Promise<void> {
  return call('voteMvp', { gameId, playerId });
}
