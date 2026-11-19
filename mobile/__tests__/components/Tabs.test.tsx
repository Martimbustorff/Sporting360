import { fireEvent, render, screen } from '@testing-library/react-native';
import { ScrollView, StyleSheet } from 'react-native';
import { colors, layout } from '@/theme/tokens';
import { Tabs } from '@/components/Tabs';

type K = 'results' | 'table';
const items: { key: K; label: string }[] = [
  { key: 'results', label: 'Resultados' },
  { key: 'table', label: 'Classificação' },
];

describe('Tabs', () => {
  it('calls onChange with the key', async () => {
    const onChange = jest.fn();
    await render(<Tabs items={items} value="table" onChange={onChange} mode="equal" />);
    await fireEvent.press(screen.getByText('Resultados'));
    expect(onChange).toHaveBeenCalledWith('results');
  });

  it('active tab is selected, others are not', async () => {
    await render(<Tabs items={items} value="results" onChange={() => {}} mode="equal" />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]!.props.accessibilityState.selected).toBe(true);
    expect(tabs[1]!.props.accessibilityState.selected).toBe(false);
  });

  it('scroll mode renders all tabs', async () => {
    await render(<Tabs items={items} value="results" onChange={() => {}} mode="scroll" />);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('active underline is primary-on-dark, inactive is transparent', async () => {
    await render(<Tabs items={items} value="results" onChange={() => {}} mode="equal" />);
    const [a, b] = screen.getAllByTestId('tab-underline').map((n) => StyleSheet.flatten(n.props.style));
    expect(a!.backgroundColor).toBe(colors.primaryOnDark);
    expect(a!.height).toBe(3);
    expect(b!.backgroundColor).toBe('transparent');
  });

  it.each(['scroll', 'equal'] as const)('%s mode: active label white, inactive text-subtle', async (mode) => {
    await render(<Tabs items={items} value="results" onChange={() => {}} mode={mode} />);
    expect(StyleSheet.flatten(screen.getByText('Resultados').props.style).color).toBe(colors.white);
    expect(StyleSheet.flatten(screen.getByText('Classificação').props.style).color).toBe(colors.textSubtle);
  });

  it('snapshot (default)', async () => {
    const r = await render(<Tabs items={items} value="results" onChange={() => {}} mode="equal" />);
    expect(r.toJSON()).toMatchSnapshot();
  });

  it('scroll mode: o separador ativo faz scroll para ficar à vista', async () => {
    const scrollTo = (ScrollView as unknown as { prototype: { scrollTo: jest.Mock } }).prototype.scrollTo;
    scrollTo.mockClear();
    const many = ['a', 'b', 'c', 'd'].map((k) => ({ key: k, label: k.toUpperCase() }));
    const { rerender } = await render(<Tabs items={many} value="a" onChange={() => {}} mode="scroll" />);
    for (const [i, t] of screen.getAllByRole('tab').entries()) {
      await fireEvent(t, 'layout', { nativeEvent: { layout: { x: 16 + i * 104, y: 0, width: 80, height: 48 } } });
    }
    await rerender(<Tabs items={many} value="d" onChange={() => {}} mode="scroll" />);
    expect(scrollTo).toHaveBeenLastCalledWith({ x: 16 + 3 * 104 - layout.tabsScrollPad, animated: true });
  });

  it('equal mode nunca faz scroll', async () => {
    const scrollTo = (ScrollView as unknown as { prototype: { scrollTo: jest.Mock } }).prototype.scrollTo;
    scrollTo.mockClear();
    await render(<Tabs items={items} value="table" onChange={() => {}} mode="equal" />);
    await fireEvent(screen.getByText('Classificação'), 'layout', { nativeEvent: { layout: { x: 300, y: 0, width: 80, height: 48 } } });
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
