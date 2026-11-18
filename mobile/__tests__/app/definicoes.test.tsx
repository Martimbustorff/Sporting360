// Task 26: Definições, Conta e Mudar password. Sessão, biometria, Analytics, Apple e auth mockados (sem rede).
import { Alert, Platform } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

type Bio = { status: string; label: string; enabled: boolean; setEnabled: jest.Mock };
type L = { status: 'loading' } | { status: 'error'; error: Error } | { status: 'missing' } | { status: 'ready'; data: unknown };
const mockSession: { providers: string[]; email: string | null } = { providers: ['password'], email: 'ze@x.pt' };
const mockBio: { current: Bio } = { current: { status: 'available', label: 'Face ID', enabled: false, setEnabled: jest.fn() } };
const mockProfile: { current: L } = { current: { status: 'loading' } };
const mockMyUser: { current: L } = { current: { status: 'loading' } };
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: object) => <View {...props} /> };
});
jest.mock('@/providers/SessionProvider', () => ({
  useSession: () => ({ status: 'signedIn', user: { uid: 'u1', email: mockSession.email, providers: mockSession.providers } }),
}));
jest.mock('@/providers/BiometricGate', () => ({ useBiometricControl: () => mockBio.current }));
jest.mock('@/data/hooks', () => ({
  usePublicProfile: jest.fn(() => mockProfile.current),
  useMyUser: jest.fn(() => mockMyUser.current),
}));
jest.mock('@/services/analytics', () => ({
  getAnalyticsConsent: jest.fn(() => Promise.resolve(null)),
  setAnalyticsConsent: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/services/social', () => ({
  linkAppleToCurrentUser: jest.fn(),
}));
jest.mock('@/services/auth', () => ({ signOut: jest.fn(() => Promise.resolve()) }));
jest.mock('@/services/account', () => ({
  CHANGE_PASSWORD_TEXT: { tooShort: 'A nova password tem de ter pelo menos 6 caracteres.', wrongCurrent: 'x' },
  MIN_PASSWORD_LENGTH: 6,
  changePassword: jest.fn(() => Promise.resolve()),
}));

import { changePassword } from '@/services/account';
import { getAnalyticsConsent, setAnalyticsConsent } from '@/services/analytics';
import { signOut } from '@/services/auth';
import { linkAppleToCurrentUser } from '@/services/social';
import Definicoes, { DEFINICOES_TEXT } from '../../app/(app)/definicoes/index';
import Conta from '../../app/(app)/definicoes/conta';
import Password, { PASSWORD_TEXT } from '../../app/(app)/definicoes/password';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (el: React.ReactElement) => <SafeAreaProvider initialMetrics={METRICS}>{el}</SafeAreaProvider>;
const flush = () => act(async () => {});
const originalOS = Platform.OS;
const sw = (name: string) => screen.getByRole('switch', { name });

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'ios';
  mockSession.providers = ['password'];
  mockSession.email = 'ze@x.pt';
  mockBio.current = { status: 'available', label: 'Face ID', enabled: false, setEnabled: jest.fn(() => Promise.resolve('ok')) };
  mockProfile.current = { status: 'ready', data: { displayName: 'Zé S.', avatarId: null } };
  mockMyUser.current = { status: 'ready', data: {} };
});
afterAll(() => {
  Platform.OS = originalOS;
});

describe('Definições', () => {
  it('mostra as entradas e navega para Conta, GameBox, Notificações, Termos e Apagar conta', async () => {
    await render(wrap(<Definicoes />));
    await flush();
    for (const [label, href] of [
      ['Conta S360', '/definicoes/conta'],
      ['Gestão de GameBox', '/gamebox'],
      ['Notificações', '/perfil/notificacoes'],
      ['Termos e privacidade', '/definicoes/termos'],
      ['Apagar conta', '/apagar-conta'],
    ]) {
      await fireEvent.press(screen.getByRole('button', { name: label }));
      expect(mockPush).toHaveBeenLastCalledWith(href);
    }
    expect(screen.getByText('Versão 7.0.0')).toBeTruthy();
  });

  it('nunca mostra o email (só na Conta)', async () => {
    await render(wrap(<Definicoes />));
    await flush();
    expect(screen.queryByText(/ze@x\.pt/)).toBeNull();
  });

  it('"Análise de utilização" chama setAnalyticsConsent granted e depois denied', async () => {
    await render(wrap(<Definicoes />));
    await flush();
    expect(getAnalyticsConsent).toHaveBeenCalled();
    expect(sw('Análise de utilização').props.accessibilityState.checked).toBe(false);
    await fireEvent.press(sw('Análise de utilização'));
    expect(setAnalyticsConsent).toHaveBeenLastCalledWith('granted');
    expect(sw('Análise de utilização').props.accessibilityState.checked).toBe(true);
    await fireEvent.press(sw('Análise de utilização'));
    expect(setAnalyticsConsent).toHaveBeenLastCalledWith('denied');
    expect(sw('Análise de utilização').props.accessibilityState.checked).toBe(false);
  });

  it('aceitar falha a guardar: mostra o erro e volta ao valor guardado', async () => {
    (setAnalyticsConsent as jest.Mock).mockRejectedValueOnce(new Error('CONSENT_SAVE_FAILED'));
    await render(wrap(<Definicoes />));
    await flush();
    await fireEvent.press(sw('Análise de utilização'));
    await flush();
    expect(screen.getByText(DEFINICOES_TEXT.saveError)).toBeTruthy();
    expect(sw('Análise de utilização').props.accessibilityState.checked).toBe(false);
  });

  it('recusar falha a guardar: mostra o erro e o interruptor fica desligado', async () => {
    (getAnalyticsConsent as jest.Mock).mockResolvedValue('granted');
    (setAnalyticsConsent as jest.Mock).mockRejectedValueOnce(new Error('CONSENT_SAVE_FAILED'));
    await render(wrap(<Definicoes />));
    await flush();
    await fireEvent.press(sw('Análise de utilização'));
    await flush();
    expect(setAnalyticsConsent).toHaveBeenLastCalledWith('denied');
    expect(screen.getByText(DEFINICOES_TEXT.saveError)).toBeTruthy();
    expect(sw('Análise de utilização').props.accessibilityState.checked).toBe(false);
    (getAnalyticsConsent as jest.Mock).mockImplementation(() => Promise.resolve(null));
  });

  it('consentimento guardado granted: o interruptor começa ligado', async () => {
    (getAnalyticsConsent as jest.Mock).mockResolvedValueOnce('granted');
    await render(wrap(<Definicoes />));
    await flush();
    expect(sw('Análise de utilização').props.accessibilityState.checked).toBe(true);
  });

  it('"Desbloquear com Face ID" liga pelo controlo do BiometricGate', async () => {
    await render(wrap(<Definicoes />));
    await flush();
    await fireEvent.press(sw('Desbloquear com Face ID'));
    expect(mockBio.current.setEnabled).toHaveBeenCalledWith(true);
  });

  it('com a opção ligada, tocar desliga', async () => {
    mockBio.current.enabled = true;
    await render(wrap(<Definicoes />));
    await flush();
    expect(sw('Desbloquear com Face ID').props.accessibilityState.checked).toBe(true);
    await fireEvent.press(sw('Desbloquear com Face ID'));
    expect(mockBio.current.setEnabled).toHaveBeenCalledWith(false);
  });

  it.each(['notEnrolled', 'noHardware'])('%s: interruptor desativado com a explicação', async (status) => {
    mockBio.current.status = status;
    await render(wrap(<Definicoes />));
    await flush();
    expect(sw('Desbloquear com Face ID').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Sem Face ID configurado neste telemóvel.')).toBeTruthy();
  });

  it('ligar devolve notEnrolled: mostra a explicação', async () => {
    mockBio.current.setEnabled.mockResolvedValueOnce('notEnrolled');
    await render(wrap(<Definicoes />));
    await flush();
    await fireEvent.press(sw('Desbloquear com Face ID'));
    expect(screen.getByText('Sem Face ID configurado neste telemóvel.')).toBeTruthy();
  });

  it('falha a gravar a biometria: avisa', async () => {
    mockBio.current.setEnabled.mockRejectedValueOnce(new Error('keychain'));
    await render(wrap(<Definicoes />));
    await flush();
    await fireEvent.press(sw('Desbloquear com Face ID'));
    expect(screen.getByText(DEFINICOES_TEXT.saveError)).toBeTruthy();
  });

  it('"Ligar conta Apple" não aparece em Android', async () => {
    Platform.OS = 'android';
    await render(wrap(<Definicoes />));
    await flush();
    expect(screen.queryByRole('button', { name: 'Ligar conta Apple' })).toBeNull();
  });

  it('"Ligar conta Apple" não aparece com apple.com já ligado', async () => {
    mockSession.providers = ['password', 'apple.com'];
    await render(wrap(<Definicoes />));
    await flush();
    expect(screen.queryByRole('button', { name: 'Ligar conta Apple' })).toBeNull();
  });

  it('"Ligar conta Apple" (iOS, sem apple.com) só abre /ligar-apple, sem ligar aqui', async () => {
    await render(wrap(<Definicoes />));
    await flush();
    await fireEvent.press(screen.getByRole('button', { name: 'Ligar conta Apple' }));
    expect(mockPush).toHaveBeenLastCalledWith('/ligar-apple');
    expect(linkAppleToCurrentUser).not.toHaveBeenCalled();
  });

  it('"Terminar sessão" só sai depois de confirmar', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(wrap(<Definicoes />));
    await flush();
    await fireEvent.press(screen.getByRole('button', { name: 'Terminar sessão' }));
    expect(signOut).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledTimes(1);
    const buttons = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === 'Cancelar')?.onPress?.();
    expect(signOut).not.toHaveBeenCalled();
    await act(async () => buttons.find((b) => b.text === 'Terminar sessão')?.onPress?.());
    expect(signOut).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  it('terminar sessão falhado avisa', async () => {
    (signOut as jest.Mock).mockRejectedValueOnce(new Error('x'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(wrap(<Definicoes />));
    await flush();
    await fireEvent.press(screen.getByRole('button', { name: 'Terminar sessão' }));
    const buttons = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === 'Terminar sessão')?.onPress?.());
    expect(screen.getByText(DEFINICOES_TEXT.signOutError)).toBeTruthy();
    alert.mockRestore();
  });
});

describe('Conta', () => {
  it('mostra o nome público e o email só de leitura', async () => {
    await render(wrap(<Conta />));
    expect(screen.getByText('Zé S.')).toBeTruthy();
    expect(screen.getByText('ze@x.pt')).toBeTruthy();
    expect(screen.queryByDisplayValue('ze@x.pt')).toBeNull();
  });

  it('tocar no nome abre /perfil/nome', async () => {
    await render(wrap(<Conta />));
    await fireEvent.press(screen.getByRole('button', { name: /Nome público/ }));
    expect(mockPush).toHaveBeenCalledWith('/perfil/nome');
  });

  it('"Mudar password" só com o provider password', async () => {
    const view = await render(wrap(<Conta />));
    await fireEvent.press(screen.getByRole('button', { name: 'Mudar password' }));
    expect(mockPush).toHaveBeenCalledWith('/definicoes/password');
    await view.unmount();
    mockSession.providers = ['google.com'];
    await render(wrap(<Conta />));
    expect(screen.queryByRole('button', { name: 'Mudar password' })).toBeNull();
  });

  it('sem email (Apple escondido) diz que não há email', async () => {
    mockSession.email = null;
    await render(wrap(<Conta />));
    expect(screen.getByText('Sem email')).toBeTruthy();
  });

  it('sem perfil público usa a regra do servidor a partir do nome', async () => {
    mockProfile.current = { status: 'missing' };
    mockMyUser.current = { status: 'ready', data: { name: 'Maria Costa' } };
    await render(wrap(<Conta />));
    expect(screen.getByText('Maria C.')).toBeTruthy();
  });

  it('sem perfil público e users/{uid} com erro: erro no nome, nunca um nome inventado', async () => {
    mockProfile.current = { status: 'missing' };
    mockMyUser.current = { status: 'error', error: new Error('x') };
    await render(wrap(<Conta />));
    expect(screen.getByText('Não foi possível carregar o nome.')).toBeTruthy();
    expect(screen.queryByText(/Sportinguista|Adepto/)).toBeNull();
  });

  it('leitura do perfil falhada mostra erro no nome', async () => {
    mockProfile.current = { status: 'error', error: new Error('x') };
    await render(wrap(<Conta />));
    expect(screen.getByText('Não foi possível carregar o nome.')).toBeTruthy();
  });
});

describe('Mudar password', () => {
  const fill = async (current: string, next: string) => {
    await fireEvent.changeText(screen.getByLabelText('Password atual'), current);
    await fireEvent.changeText(screen.getByLabelText('Nova password'), next);
  };
  const save = () => screen.getByRole('button', { name: 'Guardar' });

  it('Guardar desativado até os dois campos terem texto', async () => {
    await render(wrap(<Password />));
    expect(save().props.accessibilityState.disabled).toBe(true);
    await fill('atual1', '123456');
    expect(save().props.accessibilityState.disabled).toBe(false);
  });

  it('nova com menos de 6 caracteres: aviso e sem chamar o serviço', async () => {
    await render(wrap(<Password />));
    await fill('atual1', '12345');
    await fireEvent.press(save());
    expect(screen.getByText(PASSWORD_TEXT.tooShort)).toBeTruthy();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('sucesso: chama changePassword, confirma e limpa os campos', async () => {
    await render(wrap(<Password />));
    await fill('atual1', '123456');
    await fireEvent.press(save());
    expect(changePassword).toHaveBeenCalledWith('atual1', '123456');
    expect(screen.getByText(PASSWORD_TEXT.done)).toBeTruthy();
    expect(screen.getByLabelText('Password atual').props.value).toBe('');
  });

  it('erro: mostra a mensagem e mantém o que se escreveu', async () => {
    (changePassword as jest.Mock).mockRejectedValueOnce(new Error('A password atual está incorreta.'));
    await render(wrap(<Password />));
    await fill('errada', '123456');
    await fireEvent.press(save());
    expect(screen.getByText('A password atual está incorreta.')).toBeTruthy();
    expect(screen.getByLabelText('Nova password').props.value).toBe('123456');
  });

  it('conta sem password: explica e não mostra o formulário', async () => {
    mockSession.providers = ['apple.com'];
    await render(wrap(<Password />));
    expect(screen.getByText(PASSWORD_TEXT.noPassword)).toBeTruthy();
    expect(screen.queryByLabelText('Password atual')).toBeNull();
  });
});
