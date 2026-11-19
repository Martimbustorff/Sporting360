import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Switch } from '@/components/Switch';
import { colors } from '@/theme/tokens';

describe('Switch', () => {
  it('on is primary, off is surface20, toggles value', async () => {
    const onValueChange = jest.fn();
    const r = await render(<Switch label="Golos" value onValueChange={onValueChange} />);
    expect(StyleSheet.flatten(screen.getByTestId('toggle-track').props.style).backgroundColor).toBe(colors.primary);
    await fireEvent.press(screen.getByRole('switch', { name: 'Golos' }));
    expect(onValueChange).toHaveBeenCalledWith(false);
    await r.unmount();
    await render(<Switch label="Golos" value={false} onValueChange={() => {}} />);
    expect(StyleSheet.flatten(screen.getByTestId('toggle-track').props.style).backgroundColor).toBe(colors.surface20);
  });
});
