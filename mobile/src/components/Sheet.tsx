// Figma V7.1: GameBox sheet 4920:5083 (fundo branco, raio superior 28, grabber 36x5 a 8 do topo, título Title 24 primary,
// seta à direita, padding 24). Sombra em layout.sheetShadow. Conflito com o resumo da Tarefa 3 (bg-raised): ganha o frame.
// SEM FIGMA: gesto de arrastar (skill expo-animation): só transform, mola com velocidade, "reduzir movimento".
// A paginação (564:7160) e o conteúdo da folha aberta pertencem a quem usa o Sheet.
import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { resolveSheetEnd } from '@/lib/sheetEnd';
import { Touchable } from '@/components/Touchable';
import { Text71 } from '@/theme/typography';
import { colors, layout, radii, space } from '@/theme/tokens';

const titleRow = { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: layout.minTouch } as const;

export type SheetProps = {
  title: string;
  collapsedHeight: number;
  expandedHeight: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `false`: folha fixa (consentimento): o título é só cabeçalho, sem toque nem seta, e o gesto não muda nada. */
  toggleable?: boolean;
  /**
   * `light` (por omissão): fundo branco, título Title 24 primary (GameBox recolhida, 4920:5083). `dark`: bg-raised, título
   * Title S 20 branco, grabber à esquerda (folhas escuras do Figma, ex. 4953:9228). `night`: fundo bg, título Title 24
   * primary-on-dark, grabber ao centro, seta para baixo (GameBox aberta, 4951:8673 e 4951:9190).
   */
  tone?: 'light' | 'dark' | 'night';
  children?: ReactNode;
};

export function Sheet({ title, collapsedHeight, expandedHeight, open, onOpenChange, toggleable = true, tone = 'light', children }: SheetProps) {
  const dark = tone === 'dark';
  const night = tone === 'night';
  const onDark = dark || night;
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
    .enabled(toggleable)
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
      const { wantOpen, changed } = resolveSheetEnd({
        position: y.get(),
        velocity: e.velocityY,
        open,
        range,
        flickVelocity: layout.sheetVelocity,
      });
      y.set(
        reduced
          ? withTiming(wantOpen ? 0 : range, { duration: 0 })
          : withSpring(wantOpen ? 0 : range, { duration: 300, dampingRatio: 0.8, velocity: e.velocityY }),
      );
      if (changed) scheduleOnRN(onOpenChange, wantOpen);
    });

  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));

  const pad = { paddingHorizontal: space.s24, paddingTop: dark ? space.s24 : night ? space.s16 + space.s4 : space.s16, paddingBottom: space.s24 };

  return (
    <GestureDetector gesture={pan}>
      {/* Vista exterior leva a sombra (iOS corta a sombra numa vista com overflow hidden); a interior recorta. */}
      <Animated.View
        testID="sheet"
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: expandedHeight,
            backgroundColor: dark ? colors.bgRaised : night ? colors.bg : colors.white,
            borderTopLeftRadius: radii.r28,
            borderTopRightRadius: radii.r28,
            ...layout.sheetShadow,
          },
          animated,
        ]}
      >
        <View
          testID="sheet-grabber"
          style={{
            position: 'absolute',
            top: night ? layout.sheetGrabberTopOpen : space.s8,
            ...(dark ? { top: space.s12, left: space.s24 } : { alignSelf: 'center' as const }),
            width: layout.grabberWidth,
            height: layout.grabberHeight,
            borderRadius: layout.grabberHeight / 2,
            backgroundColor: onDark ? colors.surface20 : colors.ink,
            opacity: onDark ? undefined : layout.grabberOpacity,
            zIndex: 1,
          }}
        />
        <View
          testID="sheet-clip"
          style={{
            flex: 1,
            borderTopLeftRadius: radii.r28,
            borderTopRightRadius: radii.r28,
            overflow: 'hidden',
            ...pad,
          }}
        >
          {toggleable ? (
            <Touchable
              accessibilityRole="button"
              accessibilityLabel={title}
              accessibilityState={{ expanded: open }}
              onPress={() => onOpenChange(!open)}
              style={titleRow}
            >
              <Text71 variant={dark ? 'titleS20' : 'title24'} color={dark ? 'white' : night ? 'primaryOnDark' : 'primary'} numberOfLines={1} style={{ flex: 1 }}>{title}</Text71>
              <Feather name={open ? 'chevron-down' : 'chevron-up'} size={layout.sheetChevron} color={onDark ? colors.white : colors.ink} />
            </Touchable>
          ) : (
            <View style={titleRow}>
              <Text71 variant={dark ? 'titleS20' : 'title24'} color={dark ? 'white' : night ? 'primaryOnDark' : 'primary'} accessibilityRole="header" numberOfLines={1} style={{ flex: 1 }}>{title}</Text71>
            </View>
          )}
          <View
            testID="sheet-content"
            accessibilityElementsHidden={!open}
            importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
            style={{ flex: 1 }}
          >
            {children}
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}
