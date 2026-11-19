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

describe('MenuRow V7.1', () => {
  const { StyleSheet } = require('react-native');
  it('long label stays on one line', async () => {
    await render(<MenuRow icon={<Text>i</Text>} label="Preferências de notificação muito compridas para um ecrã de 320 pontos" onPress={() => {}} />);
    expect(screen.getByText(/Preferências de notificação/).props.numberOfLines).toBe(1);
  });
  it('L is 64 and M is 52, separator optional', async () => {
    const r = await render(<MenuRow icon={<Text>i</Text>} label="A" onPress={() => {}} />);
    expect(StyleSheet.flatten(screen.getByTestId('list-row').props.style).height).toBe(64);
    expect(screen.getByTestId('list-row-separator')).toBeTruthy();
    await r.unmount();
    await render(<MenuRow icon={<Text>i</Text>} label="A" size="M" separator={false} onPress={() => {}} />);
    expect(StyleSheet.flatten(screen.getByTestId('list-row').props.style).height).toBe(52);
    expect(screen.queryByTestId('list-row-separator')).toBeNull();
  });
});
