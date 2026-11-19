import { useState } from 'react';
import { Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
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
 */
export function Touchable({ style, pressedStyle, feedback = 'opacity', onPressIn, onPressOut, ...rest }: TouchableProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      {...rest}
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
