import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { colors } from '@/theme/tokens';
import { InfoRow, SectionBar } from '@/components/SectionBar';

describe('SectionBar', () => {
  it('eyebrow label in text-subtle and action in primary-on-dark', async () => {
    const onRightPress = jest.fn();
    await render(<SectionBar label="Informação do Jogo" right="Ver tudo" onRightPress={onRightPress} />);
    expect(StyleSheet.flatten(screen.getByText('Informação do Jogo').props.style).color).toBe(colors.textSubtle);
    expect(StyleSheet.flatten(screen.getByText('Ver tudo').props.style).color).toBe(colors.primaryOnDark);
    fireEvent.press(screen.getByText('Ver tudo'));
    expect(onRightPress).toHaveBeenCalledTimes(1);
  });
  it('without right', async () => {
    await render(<SectionBar label="Informação do Jogo" />);
    expect(screen.queryByTestId('section-bar-right')).toBeNull();
  });
  it('InfoRow shows label and value', async () => {
    await render(<InfoRow label="Árbitro" value="Branco Godinho L. M." />);
    expect(screen.getByText('Árbitro')).toBeTruthy();
    expect(screen.getByText('Branco Godinho L. M.')).toBeTruthy();
  });
});
