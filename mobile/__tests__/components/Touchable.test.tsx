import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { Touchable } from '@/components/Touchable';
import { layout } from '@/theme/tokens';

const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);

describe('Touchable', () => {
  it('keeps the given style before and after pressIn (never a function)', async () => {
    await render(
      <Touchable testID="t" style={{ height: 40, backgroundColor: 'red' }}>
        <Text>x</Text>
      </Touchable>,
    );
    expect(typeof screen.getByTestId('t').props.style).not.toBe('function');
    expect(flat('t')).toMatchObject({ height: 40, backgroundColor: 'red' });
    expect(flat('t').opacity).toBeUndefined();
    await fireEvent(screen.getByTestId('t'), 'pressIn');
    expect(flat('t')).toMatchObject({ height: 40, backgroundColor: 'red', opacity: layout.pressedOpacity });
    await fireEvent(screen.getByTestId('t'), 'pressOut');
    expect(flat('t')).toMatchObject({ height: 40 });
    expect(flat('t').opacity).toBeUndefined();
  });

  it('applies pressedStyle while pressed and feedback none skips opacity', async () => {
    await render(
      <Touchable testID="t" feedback="none" style={{ backgroundColor: 'red' }} pressedStyle={{ backgroundColor: 'blue' }}>
        <Text>x</Text>
      </Touchable>,
    );
    await fireEvent(screen.getByTestId('t'), 'pressIn');
    expect(flat('t')).toMatchObject({ backgroundColor: 'blue' });
    expect(flat('t').opacity).toBeUndefined();
  });

  it('still calls user onPressIn/onPressOut and onPress, and passes accessibility props', async () => {
    const onPressIn = jest.fn();
    const onPressOut = jest.fn();
    const onPress = jest.fn();
    await render(
      <Touchable testID="t" accessibilityRole="button" accessibilityLabel="Ir" onPressIn={onPressIn} onPressOut={onPressOut} onPress={onPress}>
        <Text>x</Text>
      </Touchable>,
    );
    await fireEvent(screen.getByTestId('t'), 'pressIn');
    await fireEvent(screen.getByTestId('t'), 'pressOut');
    await fireEvent.press(screen.getByTestId('t'));
    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Ir' })).toBeTruthy();
  });

  it('does not press when disabled', async () => {
    const onPress = jest.fn();
    await render(
      <Touchable testID="t" disabled onPress={onPress}>
        <Text>x</Text>
      </Touchable>,
    );
    await fireEvent.press(screen.getByTestId('t'));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('Touchable hit area', () => {
  const lay = (w: number, h: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width: w, height: h } } });

  it('24x24 gets hitSlop 10 each side', async () => {
    const onLayout = jest.fn();
    await render(<Touchable testID="t" onLayout={onLayout}><Text>x</Text></Touchable>);
    await fireEvent(screen.getByTestId('t'), 'layout', lay(24, 24));
    expect(screen.getByTestId('t').props.hitSlop).toEqual({ top: 10, bottom: 10, left: 10, right: 10 });
    expect(onLayout).toHaveBeenCalledTimes(1);
  });

  it('64x52 gets 0', async () => {
    await render(<Touchable testID="t"><Text>x</Text></Touchable>);
    await fireEvent(screen.getByTestId('t'), 'layout', lay(64, 52));
    expect(screen.getByTestId('t').props.hitSlop).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });

  it('explicit hitSlop wins', async () => {
    await render(<Touchable testID="t" hitSlop={8}><Text>x</Text></Touchable>);
    await fireEvent(screen.getByTestId('t'), 'layout', lay(24, 24));
    expect(screen.getByTestId('t').props.hitSlop).toBe(8);
  });
});
