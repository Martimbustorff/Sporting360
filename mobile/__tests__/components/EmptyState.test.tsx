// EmptyState: 47, 35f e 36f mantêm o espaçamento; `compact` é o dos avisos por cima de um botão (50b, 50c: 8 em cima, nada por baixo).
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { EmptyState } from '@/components/EmptyState';

jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: object) => <View {...props} /> };
});

const box = () => StyleSheet.flatten(screen.getByTestId('empty-state').props.style);

describe('EmptyState', () => {
  it('por defeito mantém o espaço de 32 em cima e em baixo (35f, 36f, 47)', async () => {
    await render(<EmptyState icon="info" text="Sem notícias." />);
    expect(box().paddingTop).toBe(32);
    expect(box().paddingBottom).toBe(32);
    expect(box().gap).toBe(12);
  });
  it('compact: 8 em cima e nada por baixo, o resto igual (50b, 50c)', async () => {
    await render(<EmptyState icon="info" compact text="Este empréstimo já não está ativo." />);
    expect(box().paddingTop).toBe(8);
    expect(box().paddingBottom).toBe(0);
    expect(box().gap).toBe(12);
    expect(box().paddingHorizontal).toBe(32);
    expect(screen.getByText('Este empréstimo já não está ativo.')).toBeTruthy();
  });
});
