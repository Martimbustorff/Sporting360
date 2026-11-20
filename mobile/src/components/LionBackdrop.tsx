// Figma V7.1: "V7.1 / Home backdrop" 4920:5141, revisto a 20/11: verde limpo em cima, leão e anéis mais abaixo, véu
// verde por cima e esbatido escuro em baixo. A geometria vem de src/lib/homeBackdrop.ts e escala com o ecrã, para não
// haver arestas em nenhum telemóvel. Mesmos assets do ecrã de bloqueio (lock-lion.png, welcome-rings.svg).
// `blurred` (Comunidade Leonina 406:13212): o leão desfocado e sem anéis, como antes.
import { useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { homeBackdropLayout } from '@/lib/homeBackdrop';
import { colors, layout } from '@/theme/tokens';

const LION = require('../../assets/images/lock-lion.png');
const RINGS = require('../../assets/images/welcome-rings.svg');

/** Fundo da Home (V7.1); com `blurred` o leão desfocado sem anéis. Ocupa o pai inteiro, sem toques. */
export function LionBackdrop({ blurred = false }: { blurred?: boolean }) {
  const win = useWindowDimensions();
  // O pai pode não ter o tamanho da janela (barras do sistema no Android): vale a medida real, quando chega.
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((b) => (b && b.width === width && b.height === height ? b : { width, height }));
  };

  if (blurred) {
    return (
      <View
        testID="lion-backdrop"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.black, pointerEvents: 'none' }]}
      >
        <View style={[styles.abs, styles.clip, layout.lockLion]}>
          <Image source={LION} accessible={false} contentFit="fill" blurRadius={layout.lionBlur} style={[styles.abs, layout.lockLionImage]} />
        </View>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: layout.lockTint, opacity: layout.lockTintOpacity }]} />
      </View>
    );
  }

  const t = layout.homeBackdrop;
  const g = homeBackdropLayout(box?.width ?? win.width, box?.height ?? win.height);
  return (
    <View
      testID="lion-backdrop"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={onLayout}
      style={[StyleSheet.absoluteFill, styles.clip, { backgroundColor: colors.black, pointerEvents: 'none' }]}
    >
      <Image testID="lion-backdrop-lion" source={LION} accessible={false} contentFit="fill" style={[styles.abs, g.lion, { opacity: t.lionOpacity }]} />
      <Image
        testID="lion-backdrop-rings"
        source={RINGS}
        accessible={false}
        style={[styles.abs, { left: g.rings.left, top: g.rings.top, width: g.rings.size, height: g.rings.size }]}
      />
      {/* Véu: verde opaco em cima (tapa a aresta de cima do leão), a esbater para a tinta verde por cima do leão. */}
      <Svg testID="lion-backdrop-veil" width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="lionVeilGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset={0} stopColor={colors.homeVeil} stopOpacity={1} />
            <Stop offset={g.veil.solidTo} stopColor={colors.homeVeil} stopOpacity={1} />
            <Stop offset={g.veil.fadeTo} stopColor={colors.bgTint} stopOpacity={t.tintOpacity} />
            <Stop offset={1} stopColor={colors.bgTint} stopOpacity={t.tintOpacity} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#lionVeilGrad)" />
      </Svg>
      {/* A transparência vai em stopOpacity: o react-native-svg ignora o alfa de uma cor com transparência no stopColor. */}
      <Svg testID="lion-backdrop-fade" width="100%" height={g.fadeHeight} style={styles.fade}>
        <Defs>
          <LinearGradient id="lionFadeGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset={0} stopColor={colors.bg} stopOpacity={0} />
            <Stop offset={1} stopColor={colors.bg} stopOpacity={t.fadeOpacity} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#lionFadeGrad)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  clip: { overflow: 'hidden' },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
