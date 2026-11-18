import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ToggleRow } from '@/components/ToggleRow';
import { colors } from '@/theme/tokens';

const icon = <Text>i</Text>;

it('liga e desliga com o valor contrário', async () => {
  const onChange = jest.fn();
  await render(<ToggleRow icon={icon} label="Golos" value={false} onChange={onChange} />);
  const sw = screen.getByRole('switch', { name: 'Golos' });
  expect(sw.props.accessibilityState.checked).toBe(false);
  await fireEvent.press(sw);
  expect(onChange).toHaveBeenCalledWith(true);
});

it('ligado mostra o trilho verde e envia false', async () => {
  const onChange = jest.fn();
  await render(<ToggleRow icon={icon} label="Golos" value onChange={onChange} />);
  expect(screen.getByTestId('toggle-track').props.style.backgroundColor).toBe(colors.toggleOn);
  await fireEvent.press(screen.getByRole('switch', { name: 'Golos' }));
  expect(onChange).toHaveBeenCalledWith(false);
});

it('desativado não responde', async () => {
  const onChange = jest.fn();
  await render(<ToggleRow icon={icon} label="Golos" value onChange={onChange} disabled />);
  await fireEvent.press(screen.getByRole('switch', { name: 'Golos' }));
  expect(onChange).not.toHaveBeenCalled();
});
