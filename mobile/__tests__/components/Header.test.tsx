import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Header } from '@/components/Header';

describe('Header', () => {
  it('shows the title in uppercase style', async () => {
    await render(<Header title="Nova Conta" />);
    const style = StyleSheet.flatten(screen.getByText('Nova Conta').props.style);
    expect(style.textTransform).toBe('uppercase');
    expect(style.fontSize).toBe(24);
  });

  it('has no back button without onBack', async () => {
    await render(<Header title="Calendário" />);
    expect(screen.queryByLabelText('Voltar')).toBeNull();
  });

  it('calls onBack when the back button is pressed', async () => {
    const onBack = jest.fn();
    await render(<Header title="Calendário" onBack={onBack} />);
    await fireEvent.press(screen.getByLabelText('Voltar'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders the right slot', async () => {
    await render(<Header title="X" right={<></>} />);
    expect(screen.getByText('X')).toBeTruthy();
  });

  it('snapshot (default)', async () => {
    const r = await render(<Header title="Nova Conta" />);
    expect(r.toJSON()).toMatchSnapshot();
  });
});
