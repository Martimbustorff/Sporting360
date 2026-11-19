import { render, screen } from '@testing-library/react-native';
import { RankingRow, type RankingVM } from '@/components/RankingRow';

const row: RankingVM = { position: 3, uid: 'u1', displayName: 'Sportinguista #1234', points: 87 };

describe('RankingRow', () => {
  it('mostra posição, nome público tal e qual e pontos', async () => {
    await render(<RankingRow row={row} highlighted={false} />);
    expect(screen.getByText('Sportinguista #1234')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('87 pts')).toBeTruthy();
  });
  it('destacada: o nome leva "(tu)" e a etiqueta de acessibilidade "Tu"', async () => {
    await render(<RankingRow row={row} highlighted />);
    expect(screen.getByText('Sportinguista #1234 (tu)')).toBeTruthy();
  });
  it('só mostra o nome público: sem avatar nem outro nome', async () => {
    await render(<RankingRow row={row} highlighted={false} />);
    expect(screen.queryByTestId('ranking-avatar')).toBeNull();
  });
  it('destacada: etiqueta de acessibilidade com "Tu"', async () => {
    await render(<RankingRow row={row} highlighted />);
    expect(screen.getByTestId('ranking-row').props.accessibilityLabel).toMatch(/Tu/);
  });
  it('não destacada: sem "Tu"', async () => {
    await render(<RankingRow row={row} highlighted={false} />);
    expect(screen.getByTestId('ranking-row').props.accessibilityLabel).not.toMatch(/Tu/);
  });
  it('singular: 1 ponto', async () => {
    await render(<RankingRow row={{ ...row, points: 1 }} highlighted={false} />);
    expect(screen.getByTestId('ranking-row').props.accessibilityLabel).toMatch(/1 ponto$/);
  });
});
