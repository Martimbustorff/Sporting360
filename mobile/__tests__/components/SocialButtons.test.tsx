import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SocialButtons } from '@/components/SocialButtons';
import { colors } from '@/theme/tokens';

jest.mock('@/services/social', () => ({
  signInWithGoogle: jest.fn(),
  signInWithApple: jest.fn(),
  NEEDS_EXISTING_LOGIN_MESSAGE: 'Já tens conta S360?',
}));
jest.mock('expo-apple-authentication', () => {
  const { Pressable } = require('react-native');
  const R = require('react');
  return {
    AppleAuthenticationButton: (p: Record<string, unknown>) =>
      R.createElement(Pressable, { testID: p.testID, accessibilityRole: 'button', accessibilityLabel: 'apple', style: p.style, buttonType: p.buttonType, buttonStyle: p.buttonStyle, cornerRadius: p.cornerRadius }),
    AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 },
    AppleAuthenticationButtonStyle: { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 },
  };
});

describe('SocialButtons', () => {
  it('Google: white pill 52 high with the Portuguese label', async () => {
    await render(<SocialButtons />);
    const btn = screen.getByRole('button', { name: 'Continuar com o Google' });
    const st = StyleSheet.flatten(btn.props.style);
    expect(st.backgroundColor).toBe(colors.white);
    expect(st.height).toBe(52);
    expect(st.borderRadius).toBe(26);
    expect(screen.getByText('Continuar com o Google')).toBeTruthy();
  });

  it('Apple (iOS): official button, CONTINUE and WHITE, same height and radius', async () => {
    await render(<SocialButtons />);
    const apple = screen.getByTestId('apple-sign-in');
    expect(apple.props.buttonType).toBe(1);
    expect(apple.props.buttonStyle).toBe(0);
    expect(apple.props.cornerRadius).toBe(26);
    expect(StyleSheet.flatten(apple.props.style).height).toBe(52);
  });
});
