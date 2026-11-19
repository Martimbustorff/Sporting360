// Figma V7.1: 47 Estados do sistema, "Esqueleto" 4952:9070: linhas com um círculo de 32 e uma barra de 12 (raio 6), 12 de
// distância entre eles e 10 entre linhas; larguras 100 %, 76 % e 89 % do espaço da barra. Cor surface-10 lisa (o brilho do
// Figma é um degradé: aqui é um pulsar de opacidade, parado com "reduzir movimento").
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { colors, layout, space, spacing } from '@/theme/tokens';

const WIDTHS = ['100%', '76%', '89%'] as const;

/** `padded`: com a margem lateral dos separadores (os ecrãs de jogo e a classificação). */
export function SkeletonRows({ testID, rows = 3, padded = false }: { testID: string; rows?: number; padded?: boolean }) {
  const reduced = useReducedMotion();
  const v = useSharedValue(1);
  useEffect(() => {
    if (reduced) {
      v.set(1);
      return;
    }
    v.set(withRepeat(withTiming(layout.shimmerMin, { duration: layout.shimmerMs }), -1, true));
  }, [reduced, v]);
  const animated = useAnimatedStyle(() => ({ opacity: v.get() }));
  return (
    <View testID={testID} accessible accessibilityLabel="A carregar" accessibilityState={{ busy: true }} style={{ gap: layout.skeletonRowsGap, paddingHorizontal: padded ? spacing.lg : 0 }}>
      {Array.from({ length: rows }, (_, i) => (
        <Animated.View key={i} style={[{ flexDirection: 'row', alignItems: 'center', gap: layout.skeletonGap }, animated]}>
          <View style={{ width: layout.skeletonCircle, height: layout.skeletonCircle, borderRadius: layout.skeletonCircle / 2, backgroundColor: colors.surface10 }} />
          <View style={{ flex: 1, alignItems: 'flex-start' }}>
            <View style={{ width: WIDTHS[i % WIDTHS.length], height: layout.skeletonBar, borderRadius: layout.skeletonBar / 2, backgroundColor: colors.surface10 }} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

/** Ecrã inteiro a carregar (35c, 36c, 22c, 38c, 42c, 11c): o esqueleto a 24 dos lados e a 8 do cabeçalho. */
export function ScreenSkeleton({ testID }: { testID: string }) {
  return (
    <View style={{ paddingTop: space.s8 }}>
      <SkeletonRows padded testID={testID} />
    </View>
  );
}
