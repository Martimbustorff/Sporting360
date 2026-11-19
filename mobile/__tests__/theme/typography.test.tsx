import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Body, Display, Text71 } from '@/theme/typography';
import { colors } from '@/theme/tokens';

describe('typography', () => {
  it('Display menuItem', async () => {
    await render(<Display variant="menuItem">Agenda</Display>);
    const style = StyleSheet.flatten(screen.getByText('Agenda').props.style);
    expect(style).toMatchObject({
      fontFamily: 'DinCondensed',
      fontSize: 20,
      textTransform: 'uppercase',
    });
  });

  it('Display forces uppercase even for sectionScore', async () => {
    await render(<Display variant="sectionScore">1</Display>);
    expect(StyleSheet.flatten(screen.getByText('1').props.style).textTransform).toBe('uppercase');
  });

  it('Body tab', async () => {
    await render(<Body variant="tab">Jogos</Body>);
    expect(StyleSheet.flatten(screen.getByText('Jogos').props.style).fontFamily).toBe('PoppinsMedium');
  });
});

describe('Text71', () => {
  it('applies the variant and a colour token', async () => {
    await render(<Text71 variant="label16" color="primaryOnDark">Olá</Text71>);
    expect(StyleSheet.flatten(screen.getByText('Olá').props.style)).toMatchObject({
      fontSize: 16,
      lineHeight: 17.6,
      color: colors.primaryOnDark,
    });
  });
});
