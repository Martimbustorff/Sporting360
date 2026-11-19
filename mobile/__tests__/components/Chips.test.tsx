// Chips: cada pílula tem um alvo de 44 pt de altura (o Touchable), com a pílula desenhada por dentro.
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Chips } from '@/components/Chips';
import { AuthLinkRow } from '@/components/AuthForm';
import { colors, layout, space, text71 } from '@/theme/tokens';

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

describe('Chips: espaço visível igual ao frame', () => {
  const overhang = (layout.minTouch - (2 * layout.chipPadY + text71.label16.lineHeight)) / 2;
  const flat = (node: { props: { style: Parameters<typeof StyleSheet.flatten>[0] } }) => StyleSheet.flatten(node.props.style) as Record<string, number>;

  it('tira horizontal: margem vertical negativa de (44 - pílula) / 2, calculada dos tokens', async () => {
    await render(<Chips items={items} value="a" onChange={jest.fn()} />);
    expect(overhang).toBeGreaterThan(0);
    expect(flat(screen.getByTestId('chip-strip') as never).marginVertical).toBe(-overhang);
    expect(StyleSheet.flatten(screen.getByTestId('chip-a').props.style).minHeight).toBe(layout.minTouch);
  });

  it('linhas quebradas: folga entre linhas de 8 e cada pílula devolve o excesso; o contentor mantém o alvo dentro', async () => {
    await render(<Chips items={items} value="a" onChange={jest.fn()} wrap />);
    const strip = flat(screen.getByTestId('chip-strip') as never);
    expect(strip.rowGap).toBe(space.s8);
    expect(strip.paddingVertical).toBe(overhang);
    expect(strip.marginVertical).toBe(-overhang);
    const chip = StyleSheet.flatten(screen.getByTestId('chip-a').props.style);
    expect(chip.minHeight).toBe(layout.minTouch);
    expect(chip.marginVertical).toBe(-overhang);
  });
});

describe('AuthLinkRow', () => {
  it('a linha devolve o excesso do alvo com margem vertical negativa (linhas a 12 como no frame)', async () => {
    await render(<AuthLinkRow text="Já tens conta?" action="Entrar" onPress={jest.fn()} />);
    const row = StyleSheet.flatten(screen.getByTestId('auth-link-row').props.style);
    expect(row.marginVertical).toBe(-(layout.minTouch - text71.captionStrong12.lineHeight) / 2);
  });

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
