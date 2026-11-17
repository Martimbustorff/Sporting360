import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Header } from '@/components/Header';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 0 } };
const renderHeader = (ui: React.ReactElement) =>
  render(<SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>);

describe('Header', () => {
  it('shows the title in uppercase style', async () => {
    await renderHeader(<Header title="Nova Conta" />);
    const style = StyleSheet.flatten(screen.getByText('Nova Conta').props.style);
    expect(style.textTransform).toBe('uppercase');
    expect(style.fontSize).toBe(24);
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

  it('grows by the extra top inset beyond the 44px status bar area', async () => {
    await renderHeader(<Header title="X" />);
    expect(StyleSheet.flatten(screen.getByTestId('header').props.style).height).toBe(96 + 3);
  });

  it('snapshot (default)', async () => {
    const r = await renderHeader(<Header title="Nova Conta" />);
    expect(r.toJSON()).toMatchSnapshot();
  });
});
