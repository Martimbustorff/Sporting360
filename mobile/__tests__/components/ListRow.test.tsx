import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { ListRow } from '@/components/ListRow';
import { colors } from '@/theme/tokens';

const base = { icon: <Text>i</Text>, label: 'Notificações', onPress: () => {}, accessibilityRole: 'button' as const };

describe('ListRow', () => {
  it('L is 64 and M is 52', async () => {
    const r = await render(<ListRow {...base} />);
    expect(StyleSheet.flatten(screen.getByTestId('list-row').props.style).height).toBe(64);
    await r.unmount();
    await render(<ListRow {...base} size="M" />);
    expect(StyleSheet.flatten(screen.getByTestId('list-row').props.style).height).toBe(52);
  });

  it('separator is 1pt in the separator colour and can be hidden', async () => {
    const r = await render(<ListRow {...base} />);
    const sep = StyleSheet.flatten(screen.getByTestId('list-row-separator').props.style);
    expect(sep.height).toBe(1);
    expect(sep.backgroundColor).toBe(colors.separator);
    await r.unmount();
    await render(<ListRow {...base} separator={false} />);
    expect(screen.queryByTestId('list-row-separator')).toBeNull();
  });

  it('label is one line with ellipsis, trailing renders, press works', async () => {
    const onPress = jest.fn();
    await render(<ListRow {...base} label="Um nome muito comprido" trailing={<Text>fim</Text>} onPress={onPress} />);
    const label = screen.getByText('Um nome muito comprido');
    expect(label.props.numberOfLines).toBe(1);
    expect(label.props.ellipsizeMode).toBe('tail');
    expect(screen.getByText('fim')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disabled ignores presses', async () => {
    const onPress = jest.fn();
    await render(<ListRow {...base} disabled onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
