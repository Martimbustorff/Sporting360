// Figma: nó 1561:5056 (Home: "image 2" 1561:5057, tinta 1561:5058, anéis 1561:5059), igual ao ecrã de bloqueio
// 348:37997. Mesmos assets (lock-lion.png, welcome-rings.svg) e mesmas medidas (layout.lockLion / lockRings / lockTint).
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { colors, layout } from '@/theme/tokens';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LION = require('../../assets/images/lock-lion.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RINGS = require('../../assets/images/welcome-rings.svg');

/** Fundo da Home: preto, leão recortado, verde a 50 % por cima e os anéis. Ocupa o pai inteiro, sem toques. */
export function LionBackdrop() {
  return (
    <View
      testID="lion-backdrop"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.black, pointerEvents: 'none' }]}
    >
      <View style={[styles.abs, styles.clip, layout.lockLion]}>
        <Image source={LION} accessible={false} contentFit="fill" style={[styles.abs, layout.lockLionImage]} />
      </View>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: layout.lockTint, opacity: layout.lockTintOpacity }]} />
      <Image source={RINGS} accessible={false} style={[styles.abs, layout.lockRings]} />
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  clip: { overflow: 'hidden' },
});
