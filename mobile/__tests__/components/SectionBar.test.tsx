import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { colors, radius } from '@/theme/tokens';
import { InfoRow, SectionBar } from '@/components/SectionBar';

describe('SectionBar', () => {
  it('label and right value on a surface10 bar', async () => {
    await render(<SectionBar label="1ª Parte" right="0-0" />);
    expect(screen.getByText('1ª Parte')).toBeTruthy();
    expect(screen.getByText('0-0')).toBeTruthy();
    const box = StyleSheet.flatten(screen.getByTestId('section-bar').props.style);
    expect(box.backgroundColor).toBe(colors.surface10);
    expect(box.borderRadius).toBe(radius.md);
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
