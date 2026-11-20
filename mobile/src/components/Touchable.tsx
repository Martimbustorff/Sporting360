import { useState } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { canAnimate, MOTION, PRESS_SCALE } from '@/lib/motion';
import { layout } from '@/theme/tokens';

// Criado na primeira utilização: alguns testes trocam o Reanimated por um mock sem `createAnimatedComponent`.
let animatedPressable: typeof Pressable | null = null;
const getAnimatedPressable = (): typeof Pressable => {
  if (!animatedPressable) {
    animatedPressable = typeof Animated?.createAnimatedComponent === 'function' ? (Animated.createAnimatedComponent(Pressable) as unknown as typeof Pressable) : Pressable;
  }
  return animatedPressable;
};
const AnimatedPressable = getAnimatedPressable();

export type TouchableProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Extra style applied only while pressed (e.g. a background change). */
  pressedStyle?: StyleProp<ViewStyle>;
  /**
   * 'opacity' (default) dims to layout.pressedOpacity while pressed; 'scale' (20/11: botões e cartões) encolhe para
   * `PRESS_SCALE` e volta; 'none' leaves it to pressedStyle.
   */
  feedback?: 'opacity' | 'scale' | 'none';
  className?: string;
};

/**
 * Pressable com feedback de toque seguro. Com NativeWind 4.2.7 um `Pressable` com
 * uma função de estilo `({ pressed }) => ...` perde o estilo em runtime, por isso o estado
 * premido vive em React state e o estilo é sempre um array, nunca uma função.
 * Sem `hitSlop` explícito, mede o tamanho e alarga a área de toque até ao mínimo de 44 pt.
 */
export function Touchable(props: TouchableProps) {
  if (props.feedback === 'scale') return canAnimate() ? <ScaleTouchable {...props} /> : <PlainTouchable {...props} feedback="opacity" />;
  return <PlainTouchable {...props} />;
}

/** Encolhe ao premir (só o transform anima, na UI thread). */
function ScaleTouchable({ style, pressedStyle, hitSlop, onPressIn, onPressOut, ...rest }: TouchableProps) {
  const [pressed, setPressed] = useState(false);
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      {...rest}
      hitSlop={hitSlop ?? layout.pressScaleSlop}
      onPressIn={(e: GestureResponderEvent) => {
        setPressed(true);
        scale.set(withTiming(PRESS_SCALE, { duration: MOTION.fast }));
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        setPressed(false);
        scale.set(withTiming(1, { duration: MOTION.fast }));
        onPressOut?.(e);
      }}
      style={[style, animated as StyleProp<ViewStyle>, pressed ? pressedStyle : null]}
    />
  );
}

function PlainTouchable({ style, pressedStyle, feedback = 'opacity', hitSlop, onPressIn, onPressOut, onLayout, ...rest }: TouchableProps) {
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
