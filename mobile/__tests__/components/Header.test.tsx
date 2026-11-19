import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Header } from '@/components/Header';
import { colors } from '@/theme/tokens';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 0 } };
const renderHeader = (ui: React.ReactElement) =>
  render(<SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>);

describe('Header', () => {
  it('shows the title in uppercase style', async () => {
    await renderHeader(<Header title="Nova Conta" />);
    const style = StyleSheet.flatten(screen.getByText('Nova Conta').props.style);
    expect(style.textTransform).toBe('uppercase');
    expect(style.fontSize).toBe(24);
    expect(style.color).toBe(colors.primary);
  });

  it('has no back button without onBack', async () => {
    await renderHeader(<Header title="Calendário" />);
    expect(screen.queryByLabelText('Voltar')).toBeNull();
  });

  it('calls onBack when the back button is pressed', async () => {
    const onBack = jest.fn();
    await renderHeader(<Header title="Calendário" onBack={onBack} />);
    await fireEvent.press(screen.getByLabelText('Voltar'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders the right slot', async () => {
    await renderHeader(<Header title="X" right={<Text>dir</Text>} />);
    expect(screen.getByText('dir')).toBeTruthy();
  });

  it('title is a header role on one line', async () => {
    await renderHeader(<Header title="Nova Conta" />);
    const t = screen.getByText('Nova Conta');
    expect(t.props.accessibilityRole).toBe('header');
    expect(t.props.numberOfLines).toBe(1);
  });

  it('is the 52pt row plus the top inset', async () => {
    await renderHeader(<Header title="X" />);
    expect(StyleSheet.flatten(screen.getByTestId('header').props.style).height).toBe(47 + 52);
  });

  it('snapshot (default)', async () => {
    const r = await renderHeader(<Header title="Nova Conta" />);
    expect(r.toJSON()).toMatchSnapshot();
  });

  it('wide right action keeps the title centred (equal side slots, min 44)', async () => {
    await renderHeader(<Header title="X" onBack={() => {}} right={<Text>Guardar alterações</Text>} />);
    const right = screen.getByText('Guardar alterações').parent!;
    const side = StyleSheet.flatten(right.props.style);
    expect(side.minWidth).toBe(44);
    expect(side.flex).toBe(1);
    expect(side.flexBasis).toBe(0);
  });
});
