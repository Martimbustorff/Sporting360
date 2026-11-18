// Task 26 (fix round 1): a ligação da Apple faz-se aqui, com o botão oficial; as Definições só trazem cá o utilizador.
import { Platform } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));
jest.mock('expo-apple-authentication', () => {
  const { Pressable } = require('react-native');
  return {
    AppleAuthenticationButton: (p: object) => <Pressable accessibilityRole="button" {...p} />,
    AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 },
    AppleAuthenticationButtonStyle: { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 },
  };
});
jest.mock('@/services/social', () => ({
  APPLE_IN_USE_MESSAGE: 'Esta conta Apple já está ligada a outra conta S360.',
  linkAppleToCurrentUser: jest.fn(),
}));

import { linkAppleToCurrentUser } from '@/services/social';
import LigarApple from '../../app/(app)/ligar-apple';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (el: React.ReactElement) => <SafeAreaProvider initialMetrics={METRICS}>{el}</SafeAreaProvider>;
const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'ios';
});
afterAll(() => {
  Platform.OS = originalOS;
});

describe('Ligar Apple', () => {
  it('usa o botão oficial da Apple (Continuar, branco)', async () => {
    await render(wrap(<LigarApple />));
    const btn = screen.getByTestId('apple-link');
    expect(btn.props.buttonType).toBe(1);
    expect(btn.props.buttonStyle).toBe(0);
  });

  it('sucesso: "Conta Apple ligada." e o botão desaparece', async () => {
    (linkAppleToCurrentUser as jest.Mock).mockResolvedValueOnce('linked');
    await render(wrap(<LigarApple />));
    await fireEvent.press(screen.getByTestId('apple-link'));
    expect(screen.getByText('Conta Apple ligada.')).toBeTruthy();
    expect(screen.queryByTestId('apple-link')).toBeNull();
  });

  it('Apple já usada noutra conta: APPLE_IN_USE_MESSAGE e o botão fica', async () => {
    (linkAppleToCurrentUser as jest.Mock).mockResolvedValueOnce('inUse');
    await render(wrap(<LigarApple />));
    await fireEvent.press(screen.getByTestId('apple-link'));
    expect(screen.getByText('Esta conta Apple já está ligada a outra conta S360.')).toBeTruthy();
    expect(screen.getByTestId('apple-link')).toBeTruthy();
  });

  it('cancelar não mostra mensagem', async () => {
    (linkAppleToCurrentUser as jest.Mock).mockResolvedValueOnce('cancelled');
    await render(wrap(<LigarApple />));
    await fireEvent.press(screen.getByTestId('apple-link'));
    expect(screen.queryByText('Conta Apple ligada.')).toBeNull();
    expect(screen.queryByText('Esta conta Apple já está ligada a outra conta S360.')).toBeNull();
    expect(screen.getByTestId('apple-link')).toBeTruthy();
  });

  it('erro mostra a mensagem do serviço', async () => {
    (linkAppleToCurrentUser as jest.Mock).mockRejectedValueOnce(new Error('Sem ligação à internet.'));
    await render(wrap(<LigarApple />));
    await fireEvent.press(screen.getByTestId('apple-link'));
    expect(screen.getByText('Sem ligação à internet.')).toBeTruthy();
  });

  it('Android: sem botão, explica que é no iPhone', async () => {
    Platform.OS = 'android';
    await render(wrap(<LigarApple />));
    expect(screen.queryByTestId('apple-link')).toBeNull();
    expect(screen.getByText('Disponível no iPhone.')).toBeTruthy();
  });
});
