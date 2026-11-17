import { fireEvent, render, screen } from '@testing-library/react-native';
import { TextField } from '@/components/TextField';

describe('TextField', () => {
  it('reports changes', async () => {
    const onChangeText = jest.fn();
    await render(<TextField label="Email" value="" onChangeText={onChangeText} />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'a@b.pt');
    expect(onChangeText).toHaveBeenCalledWith('a@b.pt');
  });

  it('secure hides the text and the eye toggles it', async () => {
    await render(<TextField label="Password" value="x" onChangeText={() => {}} secure />);
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByLabelText('Mostrar password'));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
    await fireEvent.press(screen.getByLabelText('Esconder password'));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
  });

  it('non secure has no eye button', async () => {
    await render(<TextField label="Email" value="" onChangeText={() => {}} />);
    expect(screen.queryByLabelText('Mostrar password')).toBeNull();
  });

  it('error shows as text and accessibilityHint', async () => {
    await render(<TextField label="Email" value="x" onChangeText={() => {}} error="Email inválido" />);
    expect(screen.getByText('Email inválido')).toBeTruthy();
    expect(screen.getByLabelText('Email').props.accessibilityHint).toBe('Email inválido');
  });

  it('snapshot (default)', async () => {
    const r = await render(<TextField label="Email" value="" onChangeText={() => {}} />);
    expect(r.toJSON()).toMatchSnapshot();
  });
});
