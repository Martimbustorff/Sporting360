import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { colors } from '@/theme/tokens';
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

  it('active underline is white, inactive uses the divider colour', async () => {
    await render(<Tabs items={items} value="results" onChange={() => {}} mode="equal" />);
    const [a, b] = screen.getAllByTestId('tab-underline').map((n) => StyleSheet.flatten(n.props.style));
    expect(a!.backgroundColor).toBe(colors.white);
    expect(b!.backgroundColor).toBe(colors.divider);
  });

  it('scroll mode dims inactive labels, equal mode does not (Figma)', async () => {
    const { rerender } = await render(<Tabs items={items} value="results" onChange={() => {}} mode="scroll" />);
    expect(StyleSheet.flatten(screen.getByText('Classificação').props.style).color).toBe(colors.textDisabled);
    await rerender(<Tabs items={items} value="results" onChange={() => {}} mode="equal" />);
    expect(StyleSheet.flatten(screen.getByText('Classificação').props.style).color).toBe(colors.white);
  });

  it('snapshot (default)', async () => {
    const r = await render(<Tabs items={items} value="results" onChange={() => {}} mode="equal" />);
    expect(r.toJSON()).toMatchSnapshot();
  });
});
