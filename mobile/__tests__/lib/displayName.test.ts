// Task 16: validateDisplayName da app = a de functions/src/callables/validation.ts (Review Focus 5).
// Os vetores abaixo são os da Task 9 (functions/test/unit/validation.test.ts), com o mesmo resultado.
import * as publicNameLib from '@/lib/publicName';
import {
  DISPLAY_NAME_MESSAGES,
  displayNameErrorMessage,
  displayNameMessage,
  RENAME_COOLDOWN_MESSAGE,
  validateDisplayName,
} from '@/lib/displayName';

const VECTORS: [unknown, ReturnType<typeof validateDisplayName>][] = [
  ['  Leão   77 ', { ok: true, value: 'Leão 77' }],
  ["D'Alva-Sá", { ok: true, value: "D'Alva-Sá" }],
  ['Ç'.repeat(20), { ok: true, value: 'Ç'.repeat(20) }],
  ['Leão'.normalize('NFD'), { ok: true, value: 'Leão' }],
  ['ab', { ok: false, error: 'TOO_SHORT' }],
  ['   ', { ok: false, error: 'TOO_SHORT' }],
  ['', { ok: false, error: 'TOO_SHORT' }],
  ['a'.repeat(21), { ok: false, error: 'TOO_LONG' }],
  ['𝒜'.repeat(10), { ok: true, value: '𝒜'.repeat(10) }],
  ['a@b.pt', { ok: false, error: 'HAS_AT' }],
  ['a@🦁', { ok: false, error: 'HAS_AT' }],
  ['Leão 🦁', { ok: false, error: 'INVALID_CHARS' }],
  ['-abc', { ok: false, error: 'INVALID_CHARS' }],
  ['Sportinguista 7', { ok: false, error: 'RESERVED_NAME' }],
  ['sportinguista', { ok: false, error: 'RESERVED_NAME' }],
  ['Sportinguistas', { ok: true, value: 'Sportinguistas' }],
  [undefined, { ok: false, error: 'TOO_SHORT' }],
  [42, { ok: false, error: 'TOO_SHORT' }],
];

describe('validateDisplayName (vetores da Task 9)', () => {
  it.each(VECTORS)('%p', (input, expected) => {
    expect(validateDisplayName(input as string)).toEqual(expected);
  });

  it('é a mesma função que a cópia de functions em publicName.ts (sem duplicar a regra)', () => {
    expect(validateDisplayName).toBe(publicNameLib.validateDisplayName);
  });
});

describe('mensagens pt-PT', () => {
  it('usa os textos do brief', () => {
    expect(DISPLAY_NAME_MESSAGES.TOO_SHORT).toBe('O nome tem de ter pelo menos 3 caracteres.');
    expect(DISPLAY_NAME_MESSAGES.TOO_LONG).toBe('O nome pode ter no máximo 20 caracteres.');
    expect(DISPLAY_NAME_MESSAGES.INVALID_CHARS).toBe("Usa só letras, números, espaços e . _ ' -");
    expect(DISPLAY_NAME_MESSAGES.HAS_AT).toBe('O nome não pode ter @.');
    expect(DISPLAY_NAME_MESSAGES.RESERVED_NAME).toBeTruthy();
  });

  it('displayNameMessage devolve a mensagem do código', () => {
    expect(displayNameMessage('TOO_LONG')).toBe('O nome pode ter no máximo 20 caracteres.');
  });

  it('erro invalid-argument da callable mostra a mensagem do código devolvido', () => {
    const e = Object.assign(new Error('HAS_AT'), { code: 'invalid-argument' });
    expect(displayNameErrorMessage(e)).toBe('O nome não pode ter @.');
    const prefixed = Object.assign(new Error('TOO_SHORT'), { code: 'functions/invalid-argument' });
    expect(displayNameErrorMessage(prefixed)).toBe('O nome tem de ter pelo menos 3 caracteres.');
  });

  it('RENAME_COOLDOWN tem mensagem própria; o resto é genérico', () => {
    const cool = Object.assign(new Error('RENAME_COOLDOWN'), { code: 'resource-exhausted' });
    expect(displayNameErrorMessage(cool)).toBe(RENAME_COOLDOWN_MESSAGE);
    expect(displayNameErrorMessage(Object.assign(new Error('x'), { code: 'unavailable' }))).toBe(
      'Algo correu mal. Tenta outra vez.',
    );
    expect(displayNameErrorMessage(Object.assign(new Error('NOPE'), { code: 'invalid-argument' }))).toBe(
      'Algo correu mal. Tenta outra vez.',
    );
  });
});
