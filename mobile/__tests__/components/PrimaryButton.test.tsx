import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors } from '@/theme/tokens';

describe('PrimaryButton', () => {
  it('calls onPress', async () => {
    const onPress = jest.fn();
    await render(<PrimaryButton label="Entrar" onPress={onPress} />);
    await fireEvent.press(screen.getByText('Entrar'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it.each([['loading'], ['disabled']] as const)('%s ignores presses and is disabled', async (prop) => {
    const onPress = jest.fn();
    await render(<PrimaryButton label="Entrar" onPress={onPress} {...{ [prop]: true }} />);
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button').props.accessibilityState.disabled).toBe(true);
  });

  it('loading shows an indicator', async () => {
    await render(<PrimaryButton label="Entrar" onPress={() => {}} loading />);
    expect(screen.getByTestId('button-loading')).toBeTruthy();
  });

  it('enabled state is not disabled', async () => {
    await render(<PrimaryButton label="Entrar" onPress={() => {}} />);
    expect(screen.getByRole('button').props.accessibilityState.disabled).toBe(false);
  });

  it('white variant: white background, primary text', async () => {
    await render(<PrimaryButton label="Apagar conta" variant="white" onPress={() => {}} />);
    expect(StyleSheet.flatten(screen.getByRole('button').props.style).backgroundColor).toBe(colors.white);
    expect(StyleSheet.flatten(screen.getByText('Apagar conta').props.style).color).toBe(colors.primary);
  });

  it('dark variant: ink background, white text', async () => {
    await render(<PrimaryButton label="X" variant="dark" onPress={() => {}} />);
    expect(StyleSheet.flatten(screen.getByRole('button').props.style).backgroundColor).toBe(colors.ink);
    expect(StyleSheet.flatten(screen.getByText('X').props.style).color).toBe(colors.white);
  });

  it('secondary maps to outline: border, no fill', async () => {
    await render(<PrimaryButton label="X" variant="secondary" onPress={() => {}} />);
    const st = StyleSheet.flatten(screen.getByRole('button').props.style);
    expect(st.borderColor).toBe(colors.white);
    expect(st.backgroundColor).toBeUndefined();
  });

  it('is 52 high with a fully round radius', async () => {
    await render(<PrimaryButton label="X" onPress={() => {}} />);
    const st = StyleSheet.flatten(screen.getByRole('button').props.style);
    expect(st.height).toBe(52);
    expect(st.borderRadius).toBe(26);
    expect(st.backgroundColor).toBe(colors.primary);
  });
});
