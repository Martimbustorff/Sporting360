// Figma V7.1: "V7.1 / Home backdrop" 4920:5141 (fundo preto, leão "image 2" a partir de 80 pt a 62 %, anéis "Frame 39"
// no topo à direita, verde bg-tint a 60 % por cima e esbatido escuro em baixo). Mesmos assets do ecrã de bloqueio
// (lock-lion.png, welcome-rings.svg). `blurred` (Sites do clube 348:44569, Comunidade Leonina 406:13212, Definições): o
// leão desfocado e sem anéis, como antes.
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors, layout } from '@/theme/tokens';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LION = require('../../assets/images/lock-lion.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RINGS = require('../../assets/images/welcome-rings.svg');

/** Fundo da Home (V7.1); com `blurred` o leão desfocado sem anéis. Ocupa o pai inteiro, sem toques. */
export function LionBackdrop({ blurred = false }: { blurred?: boolean }) {
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
  const fade = layout.homeBackdropFade;
  return (
    <View
      testID="lion-backdrop"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.black, pointerEvents: 'none' }]}
    >
      <View style={[styles.abs, styles.clip, layout.homeBackdropLion, { opacity: layout.homeBackdropLionOpacity }]}>
        <Image source={LION} accessible={false} contentFit="fill" style={[styles.abs, layout.homeBackdropLionImage]} />
      </View>
      <View style={[styles.abs, styles.clip, { left: 0, top: 0 }, layout.homeBackdropRingsClip]}>
        <Image source={RINGS} accessible={false} style={[styles.abs, layout.homeBackdropRings]} />
      </View>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgTint, opacity: layout.homeBackdropTintOpacity }]} />
      <Svg width="100%" height={fade.height} style={styles.fade}>
        <Defs>
          <LinearGradient id="lionFadeGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={fade.from} />
            <Stop offset="1" stopColor={fade.to} />
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
