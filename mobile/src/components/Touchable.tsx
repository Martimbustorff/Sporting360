import { useState } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { layout } from '@/theme/tokens';

export type TouchableProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Extra style applied only while pressed (e.g. a background change). */
  pressedStyle?: StyleProp<ViewStyle>;
  /** 'opacity' (default) dims to layout.pressedOpacity while pressed; 'none' leaves it to pressedStyle. */
  feedback?: 'opacity' | 'none';
  className?: string;
};

/**
 * Pressable com feedback de toque seguro. Com NativeWind 4.2.7 um `Pressable` com
 * uma função de estilo `({ pressed }) => ...` perde o estilo em runtime, por isso o estado
 * premido vive em React state e o estilo é sempre um array, nunca uma função.
 * Sem `hitSlop` explícito, mede o tamanho e alarga a área de toque até ao mínimo de 44 pt.
 */
export function Touchable({ style, pressedStyle, feedback = 'opacity', hitSlop, onPressIn, onPressOut, onLayout, ...rest }: TouchableProps) {
  const [pressed, setPressed] = useState(false);
  const [slop, setSlop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const autoSlop = hitSlop === undefined || hitSlop === null;
  return (
    <Pressable
      {...rest}
      hitSlop={autoSlop ? { top: slop.y, bottom: slop.y, left: slop.x, right: slop.x } : hitSlop}
      onLayout={(e: LayoutChangeEvent) => {
        if (autoSlop) {
          const { width, height } = e.nativeEvent.layout;
          const x = Math.max(0, (layout.minTouch - width) / 2);
          const y = Math.max(0, (layout.minTouch - height) / 2);
          setSlop((p) => (p.x === x && p.y === y ? p : { x, y }));
        }
        onLayout?.(e);
      }}
      onPressIn={(e: GestureResponderEvent) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      style={[style, feedback === 'opacity' && pressed ? { opacity: layout.pressedOpacity } : null, pressed ? pressedStyle : null]}
    />
  );
}
