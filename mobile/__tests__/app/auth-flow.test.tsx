// Ecrãs de autenticação e guardas de rotas (Task 13). Serviços mockados; router real (expo-router/testing-library).
jest.unmock('expo-router');
// Task 5: a Home (destino depois de entrar) lê dados e tem a folha GameBox; aqui ficam de fora.
// expo-router/testing-library troca o mock de Reanimated pelo oficial, que falha em Jest com a Sheet.
jest.mock('@/components/HomeGameboxSheet', () => ({ HomeGameboxSheet: () => null, useGameboxSheetCollapsedHeight: () => 116 }));
// Task 6: a folha de consentimento (também uma Sheet) tem o mesmo problema; testada em AnalyticsConsentSheet.test.
jest.mock('@/components/AnalyticsConsentSheet', () => ({ AnalyticsConsentSheet: () => null }));
jest.mock('@/data/hooks', () => ({
  useMyUser: () => ({ status: 'loading' }),
  usePublicProfile: () => ({ status: 'loading' }),
  useAppConfig: () => ({ status: 'loading' }),
}));
// Plano 7, Tarefa 4: o esqueleto do cartão do jogo usa Reanimated (mesmo problema do oficial em Jest); testado em NextMatchCard.test.
jest.mock('@/components/NextMatchCard', () => ({ NextMatchCard: () => null }));
jest.mock('@/data/sports', () => ({ useHomeMatches: () => ({ status: 'loading' }) }));
jest.mock('@/data/user', () => ({ useMyMvpVote: () => ({ status: 'missing' }) }));

const mockSession: { current: { status: 'loading' | 'signedOut' | 'signedIn'; user: unknown } } = {
  current: { status: 'signedOut', user: null },
};
jest.mock('@/providers/SessionProvider', () => ({
  useSession: () => mockSession.current,
}));
jest.mock('@/services/auth', () => ({
  signInEmail: jest.fn(),
  signUpEmail: jest.fn(),
  sendReset: jest.fn(),
}));
// Task 14: botões Google/Apple. O serviço é testado em services/social.test.ts; aqui só o ecrã.
jest.mock('@/services/social', () => ({
  signInWithGoogle: jest.fn(),
  signInWithApple: jest.fn(),
  NEEDS_EXISTING_LOGIN_MESSAGE: 'Já tens conta S360? Entra com o teu método habitual e liga a Apple nas Definições',
}));
jest.mock('expo-apple-authentication', () => {
  const { Pressable } = require('react-native');
  const R = require('react');
  return {
    AppleAuthenticationButton: (p: { onPress: () => void; testID?: string }) =>
      R.createElement(Pressable, { testID: p.testID, onPress: p.onPress, accessibilityRole: 'button' }),
    AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 },
    AppleAuthenticationButtonStyle: { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 },
  };
});

import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { authErrorMessage } from '@/lib/authErrors';
import { Platform, StyleSheet } from 'react-native';
import { colors } from '@/theme/tokens';
import { sendReset, signInEmail, signUpEmail } from '@/services/auth';
import { signInWithApple, signInWithGoogle } from '@/services/social';

import AuthLayout from '../../app/(auth)/_layout';
import Welcome from '../../app/(auth)/welcome';
import Entrar from '../../app/(auth)/entrar';
import CriarConta from '../../app/(auth)/criar-conta';
import Recuperar from '../../app/(auth)/recuperar-password';
import Termos from '../../app/(auth)/termos';
import AppLayout from '../../app/(app)/_layout';
import Home from '../../app/(app)/index';

const ROUTES = {
  '(auth)/_layout': AuthLayout,
  '(auth)/welcome': Welcome,
  '(auth)/entrar': Entrar,
  '(auth)/criar-conta': CriarConta,
  '(auth)/recuperar-password': Recuperar,
  '(auth)/termos': Termos,
  '(app)/_layout': AppLayout,
  '(app)/index': Home,
};

const RESET_MSG = 'Se existir uma conta com este email, vais receber um link para mudar a password.';

function authError(code: string) {
  // Os serviços já convertem o código em mensagem PT (auth.ts > fail()).
  return new Error(authErrorMessage(code));
}

// Dois toques no mesmo tick, antes de qualquer re-render (o `disabled` do botão ainda não mudou):
// chama o handler nativo do Pressable duas vezes seguidas dentro de um único act.
async function doublePress(el: { props: { onClick?: (e: unknown) => void } }) {
  const ev = { nativeEvent: {}, persist: () => {} };
  await act(async () => {
    el.props.onClick?.(ev);
    el.props.onClick?.(ev);
  });
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.current = { status: 'signedOut', user: null };
});

describe('Welcome', () => {
  it('"Entrar" navega para /entrar', async () => {
    const r = await renderRouter(ROUTES, { initialUrl: '/welcome' });
    expect(screen.getByText('A tua ligação ao universo', { exact: false })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
    expect(r.getPathname()).toBe('/entrar');
  });

  it('"Criar uma conta" navega para /criar-conta', async () => {
    const r = await renderRouter(ROUTES, { initialUrl: '/welcome' });
    await fireEvent.press(screen.getByRole('button', { name: 'Criar uma conta' }));
    expect(r.getPathname()).toBe('/criar-conta');
  });

  it('mostra "Conta apagada." com aviso=conta-apagada (R17)', async () => {
    await renderRouter(ROUTES, { initialUrl: '/welcome?aviso=conta-apagada' });
    expect(screen.getByText('Conta apagada.')).toBeTruthy();
  });

  it('os anéis são uma só imagem', async () => {
    await renderRouter(ROUTES, { initialUrl: '/welcome' });
    expect(screen.getAllByTestId('welcome-rings')).toHaveLength(1);
  });

  it('V7.1: "Entrar" é Branco, "Criar uma conta" é Contorno', async () => {
    await renderRouter(ROUTES, { initialUrl: '/welcome' });
    const entrar = StyleSheet.flatten(screen.getByRole('button', { name: 'Entrar' }).props.style);
    expect(entrar.backgroundColor).toBe(colors.white);
    const criar = StyleSheet.flatten(screen.getByRole('button', { name: 'Criar uma conta' }).props.style);
    expect(criar.backgroundColor).toBeUndefined();
    expect(criar.borderColor).toBe(colors.white);
  });

  it('sem aviso não mostra "Conta apagada."', async () => {
    await renderRouter(ROUTES, { initialUrl: '/welcome' });
    expect(screen.queryByText('Conta apagada.')).toBeNull();
  });
});

describe('Login Google e Apple (Task 14)', () => {
  const RELAY_NOTE = 'Já tens conta S360? Entra com o teu método habitual e liga a Apple nas Definições';
  const originalOS = Platform.OS;
  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('iOS: Welcome mostra Google, Apple e a nota sobre o email oculto', async () => {
    Platform.OS = 'ios';
    await renderRouter(ROUTES, { initialUrl: '/welcome' });
    expect(screen.getByRole('button', { name: 'Continuar com o Google' })).toBeTruthy();
    expect(screen.getByTestId('apple-sign-in')).toBeTruthy();
    expect(screen.getByText(RELAY_NOTE)).toBeTruthy();
  });

  it('Android: Welcome não mostra o botão Apple (nem a nota)', async () => {
    Platform.OS = 'android';
    await renderRouter(ROUTES, { initialUrl: '/welcome' });
    expect(screen.getByRole('button', { name: 'Continuar com o Google' })).toBeTruthy();
    expect(screen.queryByTestId('apple-sign-in')).toBeNull();
    expect(screen.queryByText(RELAY_NOTE)).toBeNull();
  });

  it('Entrar também tem os botões', async () => {
    Platform.OS = 'ios';
    await renderRouter(ROUTES, { initialUrl: '/entrar' });
    expect(screen.getByRole('button', { name: 'Continuar com o Google' })).toBeTruthy();
    expect(screen.getByTestId('apple-sign-in')).toBeTruthy();
  });

  it('Google cancelado não mostra mensagem', async () => {
    (signInWithGoogle as jest.Mock).mockResolvedValue({ status: 'cancelled' });
    await renderRouter(ROUTES, { initialUrl: '/welcome' });
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar com o Google' }));
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('needsExistingLogin mostra a mensagem devolvida', async () => {
    Platform.OS = 'ios';
    (signInWithApple as jest.Mock).mockResolvedValue({ status: 'needsExistingLogin', message: 'Mensagem X' });
    await renderRouter(ROUTES, { initialUrl: '/welcome' });
    await fireEvent.press(screen.getByTestId('apple-sign-in'));
    expect(signInWithApple).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Mensagem X')).toBeTruthy();
  });

  it('erro mostra a mensagem PT como alerta', async () => {
    (signInWithGoogle as jest.Mock).mockRejectedValue(new Error('Sem ligação à internet.'));
    await renderRouter(ROUTES, { initialUrl: '/welcome' });
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar com o Google' }));
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Sem ligação à internet.')).toBeTruthy();
  });

  it('dois toques rápidos chamam signInWithGoogle uma só vez', async () => {
    const d = deferred();
    (signInWithGoogle as jest.Mock).mockReturnValue(d.promise.then(() => ({ status: 'cancelled' })));
    await renderRouter(ROUTES, { initialUrl: '/welcome' });
    await doublePress(screen.getByRole('button', { name: 'Continuar com o Google' }) as never);
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
    await act(async () => d.resolve());
  });
});

describe('Entrar', () => {
  it('com campos vazios não chama signInEmail e pede email e password', async () => {
    await renderRouter(ROUTES, { initialUrl: '/entrar' });
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
    expect(signInEmail).not.toHaveBeenCalled();
    expect(screen.getByText('Indica o email e a password.')).toBeTruthy();
  });

  it('com auth/invalid-credential mostra "Email ou password incorretos."', async () => {
    (signInEmail as jest.Mock).mockRejectedValue(authError('auth/invalid-credential'));
    await renderRouter(ROUTES, { initialUrl: '/entrar' });
    await fireEvent.changeText(screen.getByLabelText('Email'), 'z@x.pt');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'secret1');
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByText('Email ou password incorretos.')).toBeTruthy();
  });

  it('o botão fica em loading durante o pedido; email em minúsculas e sem espaços', async () => {
    const d = deferred();
    (signInEmail as jest.Mock).mockReturnValue(d.promise);
    await renderRouter(ROUTES, { initialUrl: '/entrar' });
    await fireEvent.changeText(screen.getByLabelText('Email'), '  Z@X.PT ');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'secret1');
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
    expect(signInEmail).toHaveBeenCalledWith('z@x.pt', 'secret1');
    expect(screen.getByTestId('button-loading')).toBeTruthy();
    await act(async () => d.resolve());
    expect(screen.queryByTestId('button-loading')).toBeNull();
  });

  it('dois toques rápidos chamam signInEmail uma só vez', async () => {
    const d = deferred();
    (signInEmail as jest.Mock).mockReturnValue(d.promise);
    await renderRouter(ROUTES, { initialUrl: '/entrar' });
    await fireEvent.changeText(screen.getByLabelText('Email'), 'z@x.pt');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'secret1');
    const button = screen.getByRole('button', { name: 'Entrar' });
    await doublePress(button);
    expect(signInEmail).toHaveBeenCalledTimes(1);
    await act(async () => d.resolve());
  });

  it('tem links para recuperar a password e criar conta', async () => {
    const r = await renderRouter(ROUTES, { initialUrl: '/entrar' });
    expect(screen.getByText('Esqueceste-te da password?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('link', { name: 'Recupera-a' }));
    expect(r.getPathname()).toBe('/recuperar-password');
  });

  it('com sessão signedIn, abrir /entrar redireciona para /', async () => {
    mockSession.current = { status: 'signedIn', user: { uid: 'u1', email: null, providers: [] } };
    const r = await renderRouter(ROUTES, { initialUrl: '/entrar' });
    expect(r.getPathname()).toBe('/');
  });
});

describe('Criar conta', () => {
  it('com nome vazio mostra "Indica o teu nome." e não chama signUpEmail', async () => {
    await renderRouter(ROUTES, { initialUrl: '/criar-conta' });
    await fireEvent.changeText(screen.getByLabelText('Email'), 'z@x.pt');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'secret1');
    await fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }));
    expect(signUpEmail).not.toHaveBeenCalled();
    expect(screen.getByText('Indica o teu nome.')).toBeTruthy();
  });

  it('sucesso chama signUpEmail(nome, email em minúsculas sem espaços, password)', async () => {
    (signUpEmail as jest.Mock).mockResolvedValue(undefined);
    await renderRouter(ROUTES, { initialUrl: '/criar-conta' });
    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Zé Coelho');
    await fireEvent.changeText(screen.getByLabelText('Email'), ' ZeCoelho@Hotmail.com ');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'secret1');
    await fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }));
    expect(signUpEmail).toHaveBeenCalledWith('Zé Coelho', 'zecoelho@hotmail.com', 'secret1');
  });

  it('dois toques rápidos chamam signUpEmail uma só vez', async () => {
    const d = deferred();
    (signUpEmail as jest.Mock).mockReturnValue(d.promise);
    await renderRouter(ROUTES, { initialUrl: '/criar-conta' });
    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Zé');
    await fireEvent.changeText(screen.getByLabelText('Email'), 'z@x.pt');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'secret1');
    const button = screen.getByRole('button', { name: 'Criar conta' });
    await doublePress(button);
    expect(signUpEmail).toHaveBeenCalledTimes(1);
    await act(async () => d.resolve());
  });

  it('o registo pode dizer que o email já tem conta (R18)', async () => {
    (signUpEmail as jest.Mock).mockRejectedValue(authError('auth/email-already-in-use'));
    await renderRouter(ROUTES, { initialUrl: '/criar-conta' });
    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Zé');
    await fireEvent.changeText(screen.getByLabelText('Email'), 'z@x.pt');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'secret1');
    await fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }));
    expect(screen.getByText('Já existe uma conta com este email.')).toBeTruthy();
  });

  it('"Termos e condições" abre /termos', async () => {
    const r = await renderRouter(ROUTES, { initialUrl: '/criar-conta' });
    const link = screen.getByRole('link', { name: 'Termos e condições' });
    expect(link.props.accessibilityHint).toBe('Abre os termos e condições');
    await fireEvent.press(link);
    expect(r.getPathname()).toBe('/termos');
    expect(screen.getByText('1. ACEITAÇÃO DOS TERMOS E CONDIÇÕES')).toBeTruthy();
  });
});

describe('V7.1: botões e erros', () => {
  it('Entrar: "Entrar" é Branco e o erro aparece por baixo do campo da password', async () => {
    await renderRouter(ROUTES, { initialUrl: '/entrar' });
    const btn = screen.getByRole('button', { name: 'Entrar' });
    expect(StyleSheet.flatten(btn.props.style).backgroundColor).toBe(colors.white);
    await fireEvent.press(btn);
    const err = screen.getByText('Indica o email e a password.');
    expect(StyleSheet.flatten(err.props.style).color).toBe(colors.danger);
  });

  it('Criar conta: "Criar conta" é Branco e tem os botões Google e Apple', async () => {
    Platform.OS = 'ios';
    await renderRouter(ROUTES, { initialUrl: '/criar-conta' });
    expect(StyleSheet.flatten(screen.getByRole('button', { name: 'Criar conta' }).props.style).backgroundColor).toBe(colors.white);
    expect(screen.getByRole('button', { name: 'Continuar com o Google' })).toBeTruthy();
  });
});

describe('V7.1: dica da password', () => {
  it('Criar conta mostra "Pelo menos 6 caracteres." por baixo da password; um erro substitui-a', async () => {
    (signUpEmail as jest.Mock).mockRejectedValue(new Error('Password fraca.'));
    await renderRouter(ROUTES, { initialUrl: '/criar-conta' });
    expect(screen.getByText('Pelo menos 6 caracteres.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Zé');
    await fireEvent.changeText(screen.getByLabelText('Email'), 'z@x.pt');
    await fireEvent.changeText(screen.getByLabelText('Password'), '123');
    await fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }));
    await act(async () => {});
    expect(screen.getByText('Password fraca.')).toBeTruthy();
    expect(screen.queryByText('Pelo menos 6 caracteres.')).toBeNull();
  });
});

describe('Recuperar password', () => {
  it('sucesso mostra a mensagem neutra', async () => {
    (sendReset as jest.Mock).mockResolvedValue(undefined);
    await renderRouter(ROUTES, { initialUrl: '/recuperar-password' });
    expect(screen.getByText('Indica o email da tua conta. Enviamos um link para criares uma password nova.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Email'), ' Z@X.pt ');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));
    expect(sendReset).toHaveBeenCalledWith('z@x.pt');
    expect(screen.getByText(RESET_MSG)).toBeTruthy();
  });

  it('auth/user-not-found mostra a mesma mensagem (R18)', async () => {
    (sendReset as jest.Mock).mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/user-not-found' }));
    await renderRouter(ROUTES, { initialUrl: '/recuperar-password' });
    await fireEvent.changeText(screen.getByLabelText('Email'), 'z@x.pt');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));
    expect(screen.getByText(RESET_MSG)).toBeTruthy();
  });

  it('com email vazio não chama sendReset', async () => {
    await renderRouter(ROUTES, { initialUrl: '/recuperar-password' });
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));
    expect(sendReset).not.toHaveBeenCalled();
    expect(screen.getByText('Indica o teu email.')).toBeTruthy();
  });
});

describe('Guardas', () => {
  it('signedOut em / vai para /welcome', async () => {
    const r = await renderRouter(ROUTES, { initialUrl: '/' });
    expect(r.getPathname()).toBe('/welcome');
  });

  it('loading não mostra nem a app nem o welcome', async () => {
    mockSession.current = { status: 'loading', user: null };
    await renderRouter(ROUTES, { initialUrl: '/' });
    expect(screen.queryByText('S360')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Entrar' })).toBeNull();
  });
});
