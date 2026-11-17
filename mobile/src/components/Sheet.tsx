// Figma: nós 564:6981 (fechada: fundo branco, raio superior 48, padding 40/38, título DIN 24 preto, seta em baixo)
// e 564:7119 (aberta: padding 24/32, título verde `primary`, seta em cima). Sombra do Figma em layout.sheetShadow.
// SEM FIGMA: gesto de arrastar (skill expo-animation): só transform, mola com velocidade, "reduzir movimento".
// A paginação (564:7160) e o conteúdo da folha aberta pertencem a quem usa o Sheet.
import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { colors, layout, radius, type } from '@/theme/tokens';

export type SheetProps = {
  title: string;
  collapsedHeight: number;
  expandedHeight: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: ReactNode;
};

export function Sheet({ title, collapsedHeight, expandedHeight, open, onOpenChange, children }: SheetProps) {
  const reduced = useReducedMotion();
  const range = Math.max(0, expandedHeight - collapsedHeight);
  // 0 = aberta, range = fechada
  const y = useSharedValue(open ? 0 : range);
  const start = useSharedValue(0);

  useEffect(() => {
    const target = open ? 0 : range;
    y.set(reduced ? withTiming(target, { duration: 0 }) : withSpring(target, { duration: 300, dampingRatio: 0.8 }));
  }, [open, range, reduced, y]);

  const pan = Gesture.Pan()
    .onStart(() => {
      'worklet';
      start.set(y.get());
    })
    .onUpdate((e) => {
      'worklet';
      const next = start.get() + e.translationY;
      // resistência elástica fora dos limites
      y.set(next < 0 ? next / 3 : next > range ? range + (next - range) / 3 : next);
    })
    .onEnd((e) => {
      'worklet';
      const wantOpen =
        Math.abs(e.velocityY) > layout.sheetVelocity ? e.velocityY < 0 : y.get() < range / 2;
      y.set(
        reduced
          ? withTiming(wantOpen ? 0 : range, { duration: 0 })
          : withSpring(wantOpen ? 0 : range, { duration: 300, dampingRatio: 0.8, velocity: e.velocityY }),
      );
      if (wantOpen !== open) scheduleOnRN(onOpenChange, wantOpen);
    });

  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));

  const pad = open
    ? { paddingHorizontal: layout.sheetPadXOpen, paddingVertical: layout.sheetPadYOpen }
    : { paddingHorizontal: layout.sheetPadXCollapsed, paddingVertical: layout.sheetPadYCollapsed };

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        testID="sheet"
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: expandedHeight,
            backgroundColor: colors.white,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            overflow: 'hidden',
            ...layout.sheetShadow,
            ...pad,
          },
          animated,
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityState={{ expanded: open }}
          onPress={() => onOpenChange(!open)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: layout.minTouch }}
        >
          <Text style={open ? type.sheetTitleOpen : type.sheetTitle}>{title}</Text>
          <Feather name={open ? 'chevron-down' : 'chevron-up'} size={layout.sheetChevron} color={colors.black} />
        </Pressable>
        <View
          testID="sheet-content"
          accessibilityElementsHidden={!open}
          importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
          style={{ flex: 1 }}
        >
          {children}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}
