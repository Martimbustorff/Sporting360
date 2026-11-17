import { render, screen } from '@testing-library/react-native';
import { RankingRow, type RankingVM } from '@/components/RankingRow';

const row: RankingVM = { position: 3, uid: 'u1', displayName: 'Sportinguista #1234', points: 87 };

describe('RankingRow', () => {
  it('mostra posição, nome público tal e qual e pontos', async () => {
    await render(<RankingRow row={row} highlighted={false} />);
    expect(screen.getByText('Sportinguista #1234')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('87')).toBeTruthy();
  });
  it('destacada: etiqueta de acessibilidade com "Tu"', async () => {
    await render(<RankingRow row={row} highlighted />);
    expect(screen.getByTestId('ranking-row').props.accessibilityLabel).toMatch(/Tu/);
  });
  it('não destacada: sem "Tu"', async () => {
    await render(<RankingRow row={row} highlighted={false} />);
    expect(screen.getByTestId('ranking-row').props.accessibilityLabel).not.toMatch(/Tu/);
  });
});
