// Task 16: nome público na app. A regra é a de functions/src/callables/validation.ts, já copiada para
// publicName.ts (Task 12): reexporta-se daqui, sem segunda cópia. Este módulo só junta as mensagens pt-PT.
import { type DisplayNameError, validateDisplayName } from '@/lib/publicName';

export { validateDisplayName };
export type { DisplayNameError, DisplayNameResult } from '@/lib/publicName';

export const DISPLAY_NAME_MESSAGES: Record<DisplayNameError, string> = {
  TOO_SHORT: 'O nome tem de ter pelo menos 3 caracteres.',
  TOO_LONG: 'O nome pode ter no máximo 20 caracteres.',
  INVALID_CHARS: "Usa só letras, números, espaços e . _ ' -",
  HAS_AT: 'O nome não pode ter @.',
  // SEM TEXTO NO BRIEF: "Sportinguista..." está reservado ao nome automático.
  RESERVED_NAME: 'Esse nome está reservado. Escolhe outro.',
};

// SEM TEXTO NO BRIEF: a callable recusa duas mudanças de nome em menos de 60 s (Task 9).
export const RENAME_COOLDOWN_MESSAGE = 'Mudaste o nome há pouco. Tenta daqui a um minuto.';
const GENERIC = 'Algo correu mal. Tenta outra vez.';

export function displayNameMessage(error: DisplayNameError): string {
  return DISPLAY_NAME_MESSAGES[error];
}

/** Erro da callable updateProfile → mensagem pt-PT. O servidor devolve o código em `message` (HttpsError). */
export function displayNameErrorMessage(e: unknown): string {
  const err = (typeof e === 'object' && e !== null ? e : {}) as { code?: unknown; message?: unknown };
  const code = String(err.code ?? '').replace(/^functions\//, '');
  const msg = String(err.message ?? '');
  if (code === 'invalid-argument' && Object.prototype.hasOwnProperty.call(DISPLAY_NAME_MESSAGES, msg)) {
    return DISPLAY_NAME_MESSAGES[msg as DisplayNameError];
  }
  if (code === 'resource-exhausted' && msg === 'RENAME_COOLDOWN') return RENAME_COOLDOWN_MESSAGE;
  return GENERIC;
}
