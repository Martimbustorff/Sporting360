import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Reanimated from 'react-native-reanimated';
import { Sheet } from '@/components/Sheet';
import { colors, layout } from '@/theme/tokens';

const wrap = (ui: React.ReactElement) => <GestureHandlerRootView>{ui}</GestureHandlerRootView>;
const base = { title: 'GameBox Digital', collapsedHeight: 100, expandedHeight: 500 };

describe('Sheet', () => {
  it('fechada: conteúdo escondido das tecnologias de apoio', async () => {
    await render(wrap(<Sheet {...base} open={false} onOpenChange={() => {}}><Text>corpo</Text></Sheet>));
    expect(screen.getByTestId('sheet-content', { hidden: true }).props.accessibilityElementsHidden).toBe(true);
  });
  it('aberta: conteúdo visível', async () => {
    await render(wrap(<Sheet {...base} open onOpenChange={() => {}}><Text>corpo</Text></Sheet>));
    expect(screen.getByTestId('sheet-content', { hidden: true }).props.accessibilityElementsHidden).toBe(false);
  });
  it('carregar no título abre', async () => {
    const onOpenChange = jest.fn();
    await render(wrap(<Sheet {...base} open={false} onOpenChange={onOpenChange}><Text>corpo</Text></Sheet>));
    fireEvent.press(screen.getByText('GameBox Digital'));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
  it('carregar no título aberto fecha', async () => {
    const onOpenChange = jest.fn();
    await render(wrap(<Sheet {...base} open onOpenChange={onOpenChange}><Text>corpo</Text></Sheet>));
    fireEvent.press(screen.getByText('GameBox Digital'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
  it('reduzir movimento: anima com timing instantâneo, sem mola', async () => {
    const mock = Reanimated as unknown as {
      useReducedMotion: jest.Mock;
      withSpring: jest.Mock;
      withTiming: jest.Mock;
    };
    mock.useReducedMotion.mockReturnValue(true);
    mock.withSpring.mockClear();
    mock.withTiming.mockClear();
    try {
      await render(wrap(<Sheet {...base} open onOpenChange={() => {}}><Text>corpo</Text></Sheet>));
      expect(mock.withTiming).toHaveBeenCalledWith(0, { duration: 0 });
      expect(mock.withSpring).not.toHaveBeenCalled();
    } finally {
      mock.useReducedMotion.mockReturnValue(false);
    }
  });
  it('sombra e recorte em vistas separadas', async () => {
    await render(wrap(<Sheet {...base} open onOpenChange={() => {}}><Text>corpo</Text></Sheet>));
    const outer = StyleSheet.flatten(screen.getByTestId('sheet').props.style);
    const inner = StyleSheet.flatten(screen.getByTestId('sheet-clip').props.style);
    expect(outer.shadowOpacity).toBeGreaterThan(0);
    expect(outer.overflow).toBeUndefined();
    expect(inner.overflow).toBe('hidden');
  });
  it('light (default): white, radius 28 on top, grabber 36x5 centred', async () => {
    await render(wrap(<Sheet {...base} open onOpenChange={() => {}}><Text>corpo</Text></Sheet>));
    const outer = StyleSheet.flatten(screen.getByTestId('sheet').props.style);
    expect(outer.backgroundColor).toBe(colors.white);
    expect(outer.borderTopLeftRadius).toBe(28);
    expect(outer.borderTopRightRadius).toBe(28);
    const g = StyleSheet.flatten(screen.getByTestId('sheet-grabber').props.style);
    expect(g.width).toBe(36);
    expect(g.height).toBe(5);
    expect(g.alignSelf).toBe('center');
    expect(StyleSheet.flatten(screen.getByText('GameBox Digital').props.style).color).toBe(colors.primary);
  });
  it('dark: bg-raised, white Title S 20 title, surface-20 grabber on the left', async () => {
    await render(wrap(<Sheet {...base} tone="dark" open onOpenChange={() => {}}><Text>corpo</Text></Sheet>));
    const outer = StyleSheet.flatten(screen.getByTestId('sheet').props.style);
    expect(outer.backgroundColor).toBe(colors.bgRaised);
    expect(outer.borderTopLeftRadius).toBe(28);
    const g = StyleSheet.flatten(screen.getByTestId('sheet-grabber').props.style);
    expect(g.width).toBe(36);
    expect(g.height).toBe(5);
    expect(g.backgroundColor).toBe(colors.surface20);
    expect(g.left).toBe(24);
    const t = StyleSheet.flatten(screen.getByText('GameBox Digital').props.style);
    expect(t.color).toBe(colors.white);
    expect(t.fontSize).toBe(20);
  });
  it('night: bg, título Title 24 em primaryOnDark, grabber ao centro mais abaixo', async () => {
    await render(wrap(<Sheet {...base} tone="night" open onOpenChange={() => {}}><Text>corpo</Text></Sheet>));
    const outer = StyleSheet.flatten(screen.getByTestId('sheet').props.style);
    expect(outer.backgroundColor).toBe(colors.bg);
    expect(outer.borderTopLeftRadius).toBe(28);
    const g = StyleSheet.flatten(screen.getByTestId('sheet-grabber').props.style);
    expect(g.backgroundColor).toBe(colors.surface20);
    expect(g.alignSelf).toBe('center');
    expect(g.top).toBe(layout.sheetGrabberTopOpen);
    const t = StyleSheet.flatten(screen.getByText('GameBox Digital').props.style);
    expect(t.color).toBe(colors.primaryOnDark);
    expect(t.fontSize).toBe(24);
  });
});
