// Figma V7.1 47 "Esqueleto" (4952:9070): três linhas com círculo de 32 e barra de 12.
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ScreenSkeleton, SkeletonRows } from '@/components/Skeleton';

describe('SkeletonRows', () => {
  it('desenha três linhas ocupadas, anunciadas como "A carregar"', async () => {
    await render(<SkeletonRows testID="sk" />);
    const root = screen.getByTestId('sk');
    expect(root.props.accessibilityLabel).toBe('A carregar');
    expect(root.props.accessibilityState).toEqual({ busy: true });
    expect(root.children).toHaveLength(3);
  });

  it('o círculo tem 32 pt', async () => {
    await render(<SkeletonRows testID="sk" rows={1} />);
    const row = screen.getByTestId('sk').children[0] as unknown as { props: { children: { props: { style: unknown } }[] } };
    const circle = StyleSheet.flatten(row.props.children[0]!.props.style as never) as { width: number; height: number };
    expect(circle.width).toBe(32);
    expect(circle.height).toBe(32);
  });
});

describe('ScreenSkeleton (35c, 36c, 22c, 38c, 42c, 11c)', () => {
  it('três linhas a 24 dos lados e a 8 do cabeçalho, anunciado como ocupado', async () => {
    await render(<ScreenSkeleton testID="sk" />);
    const root = screen.getByTestId('sk');
    expect(root.props.accessibilityState).toEqual({ busy: true });
    expect(root.children).toHaveLength(3);
    expect(StyleSheet.flatten(root.props.style).paddingHorizontal).toBe(24);
    expect(StyleSheet.flatten(root.parent!.props.style).paddingTop).toBe(8);
  });
});
