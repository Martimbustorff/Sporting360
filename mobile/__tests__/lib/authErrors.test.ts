import { authErrorMessage } from '@/lib/authErrors';

describe('authErrorMessage', () => {
  it.each([
    ['auth/invalid-email', 'Email inválido.'],
    ['auth/user-not-found', 'Email ou password incorretos.'],
    ['auth/wrong-password', 'Email ou password incorretos.'],
    ['auth/invalid-credential', 'Email ou password incorretos.'],
    ['auth/email-already-in-use', 'Já existe uma conta com este email.'],
    ['auth/weak-password', 'A password tem de ter pelo menos 6 caracteres.'],
    ['auth/too-many-requests', 'Demasiadas tentativas. Tenta mais tarde.'],
    ['auth/network-request-failed', 'Sem ligação à internet.'],
    ['auth/whatever', 'Algo correu mal. Tenta outra vez.'],
    [undefined, 'Algo correu mal. Tenta outra vez.'],
  ])('%s', (code, msg) => {
    expect(authErrorMessage(code)).toBe(msg);
  });
});
