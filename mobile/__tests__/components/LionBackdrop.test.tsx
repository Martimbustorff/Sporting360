import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { LionBackdrop } from '@/components/LionBackdrop';
import { homeBackdropLayout } from '@/lib/homeBackdrop';
import { colors, layout } from '@/theme/tokens';

const hidden = { includeHiddenElements: true } as const;
const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id, hidden).props.style);

async function layoutTo(width: number, height: number) {
  await fireEvent(screen.getByTestId('lion-backdrop', hidden), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width, height } } });
}

describe('LionBackdrop', () => {
  it('desenha o leão e os anéis pela geometria do ecrã medido, sem caixas de tamanho fixo', async () => {
    await render(<LionBackdrop />);
    await layoutTo(440, 956);
    const g = homeBackdropLayout(440, 956);
    expect(flat('lion-backdrop-lion')).toMatchObject({ ...g.lion, opacity: layout.homeBackdrop.lionOpacity });
    expect(flat('lion-backdrop-rings')).toMatchObject({ left: g.rings.left, top: g.rings.top, width: g.rings.size, height: g.rings.size });
    // Os anéis chegam à margem direita do ecrã (antes eram cortados aos 402 pt).
    expect(g.rings.left + g.rings.size).toBeGreaterThanOrEqual(440);
  });

  it('volta a calcular quando o tamanho muda (rodar o telemóvel)', async () => {
    await render(<LionBackdrop />);
    await layoutTo(402, 874);
    const before = flat('lion-backdrop-lion').width;
    await layoutTo(874, 402);
    expect(flat('lion-backdrop-lion').width).not.toBe(before);
    expect(flat('lion-backdrop-lion')).toMatchObject(homeBackdropLayout(874, 402).lion);
  });

  it('os gradientes levam a transparência em stopOpacity e a cor em tokens, nunca em rgba()', async () => {
    await render(<LionBackdrop />);
    await layoutTo(402, 874);
    const json = JSON.stringify(screen.toJSON());
    expect(json).not.toMatch(/rgba\(/);
    expect(json).toContain(colors.homeVeil);
    expect(json).toContain('"stopOpacity":0');
    expect(json).toContain(`"stopOpacity":${layout.homeBackdrop.fadeOpacity}`);
    expect(screen.getByTestId('lion-backdrop-fade', hidden).props.height).toBeCloseTo(220, 5);
  });

  it('não recebe toques nem fala para leitores de ecrã', async () => {
    await render(<LionBackdrop />);
    const root = screen.getByTestId('lion-backdrop', hidden);
    expect(StyleSheet.flatten(root.props.style).pointerEvents).toBe('none');
    expect(root.props.accessibilityElementsHidden).toBe(true);
  });

  it('a variante desfocada fica como estava, sem anéis', async () => {
    await render(<LionBackdrop blurred />);
    expect(screen.queryByTestId('lion-backdrop-rings', hidden)).toBeNull();
  });
});
