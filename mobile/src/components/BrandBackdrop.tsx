// Figma V7.1 4924:6269 "Luz" + 4924:6270 "Anéis (marca)": o círculo da marca (design original do João, Welcome/Home).
// 20/11 (Martim): o fundo do ecrã de jogo passa a ser o fundo de todos os ecrãs menos a Home; fica fixo no topo, atrás,
// e o conteúdo passa por cima.
import { Image } from 'expo-image';
import { View } from 'react-native';
import { layout } from '@/theme/tokens';

const LUZ = require('../../assets/images/match-luz.svg') as number;
const RINGS = require('../../assets/images/welcome-rings.svg') as number;

export function BrandBackdrop() {
  const { width, height, top } = layout.matchLuz;
  const rings = layout.matchRings;
  return (
    <View
      testID="brand-backdrop"
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, top: 0, height: layout.matchBackdropHeight, overflow: 'hidden' }}
    >
      <Image source={LUZ} accessible={false} style={{ position: 'absolute', left: '50%', marginLeft: -width / 2, top, width, height }} />
      <Image
        source={RINGS}
        accessible={false}
        style={{ position: 'absolute', left: '50%', marginLeft: -rings.size / 2, top: rings.top, width: rings.size, height: rings.size, opacity: rings.opacity }}
      />
    </View>
  );
}
