import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Reanimated from 'react-native-reanimated';
import { Sheet } from '@/components/Sheet';

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
});
