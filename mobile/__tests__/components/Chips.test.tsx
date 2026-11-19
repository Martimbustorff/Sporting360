// Chips: cada pílula tem um alvo de 44 pt de altura (o Touchable), com a pílula desenhada por dentro.
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Chips } from '@/components/Chips';
import { AuthLinkRow } from '@/components/AuthForm';
import { colors, layout } from '@/theme/tokens';

const items = [
  { key: 'a', label: 'Futebol' },
  { key: 'b', label: 'Futsal' },
];

describe('Chips', () => {
  it.each([false, true])('alvo de 44 pt em cada pílula (wrap=%s) e pílula visual por dentro', async (wrap) => {
    const onChange = jest.fn();
    await render(<Chips items={items} value="a" onChange={onChange} wrap={wrap} />);
    const chip = screen.getByTestId('chip-b');
    expect(StyleSheet.flatten(chip.props.style).minHeight).toBe(layout.minTouch);
    const pill = chip.children[0] as unknown as { props: { style: Parameters<typeof StyleSheet.flatten>[0] } };
    expect((StyleSheet.flatten(pill.props.style) as { backgroundColor?: string }).backgroundColor).toBe(colors.surface10);
    await fireEvent.press(chip);
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.getByTestId('chip-a').props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
  });
});

describe('AuthLinkRow', () => {
  it('a ação tem 44 pt de altura mínima, sem hitSlop fixo', async () => {
    const onPress = jest.fn();
    await render(<AuthLinkRow text="Já tens conta?" action="Entrar" onPress={onPress} />);
    const link = screen.getByRole('link', { name: 'Entrar' });
    expect(StyleSheet.flatten(link.props.style).minHeight).toBe(layout.minTouch);
    expect(link.props.hitSlop).not.toBe(12);
    await fireEvent.press(link);
    expect(onPress).toHaveBeenCalled();
  });
});
