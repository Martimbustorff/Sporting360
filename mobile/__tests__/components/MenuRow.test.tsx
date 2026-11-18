import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { MenuRow } from '@/components/MenuRow';

describe('MenuRow', () => {
  it('sem external é botão e chama onPress', async () => {
    const onPress = jest.fn();
    await render(<MenuRow icon={<Text>i</Text>} label="Agenda" onPress={onPress} />);
    const row = screen.getByRole('button', { name: 'Agenda' });
    fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it('external é link', async () => {
    await render(<MenuRow icon={<Text>i</Text>} label="Sporting num Minuto" external onPress={() => {}} />);
    expect(screen.getByRole('link', { name: 'Sporting num Minuto' })).toBeTruthy();
  });
});
