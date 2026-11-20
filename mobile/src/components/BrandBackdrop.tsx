// Figma V7.1 4924:6269 "Luz" + 4924:6270 "Anéis (marca)": o círculo da marca (design original do João, Welcome/Home).
// 20/11 (Martim): o fundo do ecrã de jogo passa a ser o fundo de todos os ecrãs menos a Home; fica fixo no topo, atrás,
// e o conteúdo passa por cima. Por baixo do círculo, o leão desfocado do design do João (Definições 323:11631, desfoque
// 22): o mesmo leão e o mesmo sítio da Home, já desfocado no asset (lion-blur.png, nada desfocado em tempo real), a 55 %
// e com o tom verde da Home (lockTint a 50 %), para o texto se ler bem.
import { Image } from 'expo-image';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { layout } from '@/theme/tokens';

const LUZ = require('../../assets/images/match-luz.svg') as number;
const RINGS = require('../../assets/images/welcome-rings.svg') as number;
const LION_BLUR = require('../../assets/images/lion-blur.png') as number;

export function BrandBackdrop() {
  const { width, height, top } = layout.matchLuz;
  const rings = layout.matchRings;
  // A geometria do leão é a do frame de 375 pt (lockLion / lockLionImage), à escala da largura do ecrã.
  const k = useWindowDimensions().width / layout.lionFrameWidth;
  const box = layout.lockLion;
  const img = layout.lockLionImage;
  return (
    <View testID="brand-backdrop" pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        testID="brand-backdrop-lion"
        style={{ position: 'absolute', overflow: 'hidden', left: box.left * k, top: box.top * k, width: box.width * k, height: box.height * k, opacity: layout.screenLionOpacity }}
      >
        <Image
          source={LION_BLUR}
          accessible={false}
          contentFit="fill"
          style={{ position: 'absolute', left: img.left * k, top: img.top * k, width: img.width * k, height: img.height * k }}
        />
      </View>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: layout.lockTint, opacity: layout.lockTintOpacity }]} />
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
