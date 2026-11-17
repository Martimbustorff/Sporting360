import { fireEvent, render, screen } from '@testing-library/react-native';
import { PrimaryButton } from '@/components/PrimaryButton';

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

  it('snapshots (primary, secondary)', async () => {
    const a = await render(<PrimaryButton label="Entrar" onPress={() => {}} />);
    expect(a.toJSON()).toMatchSnapshot('primary');
    a.unmount();
    const b = await render(<PrimaryButton label="Criar uma conta" onPress={() => {}} variant="secondary" />);
    expect(b.toJSON()).toMatchSnapshot('secondary');
  });
});
