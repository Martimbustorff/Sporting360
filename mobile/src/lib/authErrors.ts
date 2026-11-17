const GENERIC = 'Algo correu mal. Tenta outra vez.';

const MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Email inválido.',
  // R18: login nunca revela se o email existe: os três códigos dão a mesma mensagem.
  'auth/user-not-found': 'Email ou password incorretos.',
  'auth/wrong-password': 'Email ou password incorretos.',
  'auth/invalid-credential': 'Email ou password incorretos.',
  'auth/email-already-in-use': 'Já existe uma conta com este email.',
  'auth/weak-password': 'A password tem de ter pelo menos 6 caracteres.',
  'auth/too-many-requests': 'Demasiadas tentativas. Tenta mais tarde.',
  'auth/network-request-failed': 'Sem ligação à internet.',
};

export function authErrorMessage(code: string | undefined): string {
  return (code && MESSAGES[code]) || GENERIC;
}
