// Bloco sobreposto do detalhe do jogo (ver MatchScroll.tsx): cabeçalho completo + separadores sobem juntos `min(y, H)`
// com translateY; o cabeçalho completo esmorece mais depressa. O conteúdo fica numa janela constante por baixo.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useMatchScrollContext } from '@/components/match/MatchScroll';
import { colors, layout } from '@/theme/tokens';

/** Progresso 0 a 1 do colapso: scroll sobre a altura medida do cabeçalho completo. */
function useCollapse() {
  const ctx = useMatchScrollContext();
  const fallback = useSharedValue(0);
  return { y: ctx?.y ?? fallback, height: ctx?.headerHeight ?? fallback };
}

export function MatchDetailLayout({ header, tabs, children }: { header: ReactNode; tabs: ReactNode; children: ReactNode }) {
  const ctx = useMatchScrollContext();
  const { y, height } = useCollapse();
  const compact = ctx?.compact === true;
  const slide = useAnimatedStyle(() => {
    const h = height.get();
    return { transform: [{ translateY: -Math.min(Math.max(y.get(), 0), h) }] };
  });
  const fade = useAnimatedStyle(() => {
    const h = height.get();
    const p = h > 0 ? Math.min(Math.max(y.get(), 0), h) / h : 0;
    return { opacity: 1 - Math.min(1, p * 1.5) };
  });
  return (
    <View testID="match-detail" style={{ flex: 1, overflow: 'hidden' }}>
      <View style={{ flex: 1, paddingTop: ctx?.inset ?? 0 }}>{children}</View>
      <Animated.View testID="collapsing-header" style={[{ position: 'absolute', top: 0, left: 0, right: 0 }, slide]} pointerEvents="box-none">
        <Animated.View
          style={fade}
          pointerEvents={compact ? 'none' : 'auto'}
          accessibilityElementsHidden={compact}
          importantForAccessibility={compact ? 'no-hide-descendants' : 'auto'}
          onLayout={(e) => ctx?.setHeaderHeight(e.nativeEvent.layout.height)}
        >
          {header}
        </Animated.View>
        <View style={{ backgroundColor: colors.bg }} onLayout={(e) => ctx?.setTabsHeight(e.nativeEvent.layout.height)}>{tabs}</View>
      </Animated.View>
    </View>
  );
}

/** Competição e resultado compacto em cruzamento (4924:6365 / 4933:7267), no centro da barra de navegação. */
export function CrossfadeCenter({ title, compact }: { title: ReactNode; compact: ReactNode }) {
  const ctx = useMatchScrollContext();
  const { y, height } = useCollapse();
  const isCompact = ctx?.compact === true;
  const titleStyle = useAnimatedStyle(() => {
    const h = height.get() > 0 ? height.get() : layout.collapseRange;
    return { opacity: interpolate(y.get(), [0, h], [1, 0], Extrapolation.CLAMP) };
  });
  const compactStyle = useAnimatedStyle(() => {
    const h = height.get() > 0 ? height.get() : layout.collapseRange;
    return { opacity: interpolate(y.get(), [0, h], [0, 1], Extrapolation.CLAMP) };
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
