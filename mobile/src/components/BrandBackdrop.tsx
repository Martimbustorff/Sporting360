// Figma V7.1 4924:6269 "Luz" + 4924:6270 "Anéis (marca)": o círculo da marca (design original do João, Welcome/Home).
// 20/11 (Martim): o fundo do ecrã de jogo passa a ser o fundo de todos os ecrãs menos a Home; fica fixo no topo, atrás,
// e o conteúdo passa por cima. Por baixo do círculo, o leão desfocado do design do João (Definições 323:11631, desfoque
// 22), já desfocado no asset (lion-blur.png), a 55 % e com o tom verde da Home (lockTint a 50 %).
// 21/11 (Martim): "é visível a linha em cima e em baixo o fundo termina". O leão segue agora a geometria da Home
// (homeBackdropLayout: alinhado pelo fundo e a sair por baixo, por isso cobre sempre o ecrã até ao fim) e a aresta de
// cima é esbatida para a cor do fundo, sem linha.
import { useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { homeBackdropLayout } from '@/lib/homeBackdrop';
import { colors, layout } from '@/theme/tokens';

const LUZ = require('../../assets/images/match-luz.svg') as number;
const RINGS = require('../../assets/images/welcome-rings.svg') as number;
const LION_BLUR = require('../../assets/images/lion-blur.png') as number;

export function BrandBackdrop() {
  const { width, height, top } = layout.matchLuz;
  const rings = layout.matchRings;
  const win = useWindowDimensions();
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setBox((b) => (b && b.width === w && b.height === h ? b : { width: w, height: h }));
  };
  const g = homeBackdropLayout(box?.width ?? win.width, box?.height ?? win.height);
  const fadeTop = Math.max(0, g.lion.top);
  const fadeHeight = g.lion.height * layout.brandLionFade;
  return (
    <View testID="brand-backdrop" pointerEvents="none" onLayout={onLayout} style={[StyleSheet.absoluteFill, styles.clip]}>
      <View testID="brand-backdrop-lion" style={[styles.abs, g.lion, { opacity: layout.screenLionOpacity }]}>
        <Image source={LION_BLUR} accessible={false} contentFit="fill" style={StyleSheet.absoluteFill} />
      </View>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: layout.lockTint, opacity: layout.lockTintOpacity }]} />
      {/* Aresta de cima do leão: a cor do fundo opaca até ao topo do leão, a esbater até 0 por cima dele. */}
      <Svg testID="brand-backdrop-fade" width="100%" height={fadeTop + fadeHeight} style={styles.topFade}>
        <Defs>
          <LinearGradient id="brandLionFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset={0} stopColor={colors.bg} stopOpacity={1} />
            <Stop offset={fadeTop / (fadeTop + fadeHeight || 1)} stopColor={colors.bg} stopOpacity={1} />
            <Stop offset={1} stopColor={colors.bg} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#brandLionFade)" />
      </Svg>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: layout.matchBackdropHeight, overflow: 'hidden' }}>
        <Image source={LUZ} accessible={false} style={{ position: 'absolute', left: '50%', marginLeft: -width / 2, top, width, height }} />
        <Image
          source={RINGS}
          accessible={false}
          style={{ position: 'absolute', left: '50%', marginLeft: -rings.size / 2, top: rings.top, width: rings.size, height: rings.size, opacity: rings.opacity }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  clip: { overflow: 'hidden' },
  topFade: { position: 'absolute', left: 0, right: 0, top: 0 },
});
