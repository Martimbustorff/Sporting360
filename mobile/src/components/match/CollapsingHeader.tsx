// SEM FIGMA (comportamento, notas 06 e 08): o cabeçalho completo fecha com o scroll do separador ativo, sem saltos: a
// altura natural mede-se uma vez (onLayout) e a altura animada vai dela a 0 ao longo de `layout.collapseRange` pt, com a
// opacidade a cair mais depressa. Os separadores ficam por baixo, fixos. Sem provider de scroll mostra o cabeçalho inteiro.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useMatchScrollContext } from '@/components/match/MatchScroll';
import { layout } from '@/theme/tokens';

export function CollapsingHeader({ children }: { children: ReactNode }) {
  const ctx = useMatchScrollContext();
  const natural = useSharedValue(-1);
  const style = useAnimatedStyle(() => {
    const h = natural.get();
    const y = ctx ? ctx.y.get() : 0;
    const p = interpolate(y, [0, layout.collapseRange], [0, 1], Extrapolation.CLAMP);
    return {
      ...(h >= 0 ? { height: h * (1 - p) } : {}),
      opacity: 1 - Math.min(1, p * 1.5),
    };
  });
  return (
    <Animated.View testID="collapsing-header" style={[{ overflow: 'hidden' }, style]} pointerEvents={ctx?.compact ? 'none' : 'auto'}>
      <View onLayout={(e) => natural.set(e.nativeEvent.layout.height)}>{children}</View>
    </Animated.View>
  );
}

/** Cabeçalho compacto e título da competição em cruzamento (4933:7267 / 4924:6365), no centro da barra de navegação. */
export function CrossfadeCenter({ title, compact }: { title: ReactNode; compact: ReactNode }) {
  const ctx = useMatchScrollContext();
  const isCompact = ctx?.compact === true;
  const titleStyle = useAnimatedStyle(() => {
    const y = ctx ? ctx.y.get() : 0;
    return { opacity: interpolate(y, [0, layout.collapseRange], [1, 0], Extrapolation.CLAMP) };
  });
  const compactStyle = useAnimatedStyle(() => {
    const y = ctx ? ctx.y.get() : 0;
    return { opacity: interpolate(y, [0, layout.collapseRange], [0, 1], Extrapolation.CLAMP) };
  });
  const fill = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' } as const;
  return (
    <>
      <Animated.View style={[fill, titleStyle]} accessibilityElementsHidden={isCompact} importantForAccessibility={isCompact ? 'no-hide-descendants' : 'auto'}>
        {title}
      </Animated.View>
      <Animated.View testID="compact-layer" style={[fill, compactStyle]} accessibilityElementsHidden={!isCompact} importantForAccessibility={isCompact ? 'auto' : 'no-hide-descendants'}>
        {compact}
      </Animated.View>
    </>
  );
}
