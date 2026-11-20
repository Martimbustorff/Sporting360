// Anéis da marca a 100 % (design do João: Splashscreen 564:7339 e Welcome 564:7178): 72 elipses (welcome-rings.svg) a
// 709/375 da largura do ecrã, centradas no pai. O pai centra o conteúdo (alignItems/justifyContent 'center'): os anéis
// ficam por trás, maiores do que o pai, e o logótipo cai dentro do círculo.
import { Image } from 'expo-image';
import { useWindowDimensions, View } from 'react-native';
import { layout } from '@/theme/tokens';

const RINGS = require('../../assets/images/welcome-rings.svg') as number;

export function BrandRings({ testID, opacity = layout.welcomeRingsOpacity }: { testID?: string; opacity?: number }) {
  const { width } = useWindowDimensions();
  const size = Math.round(width * layout.welcomeRingsScale);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, alignSelf: 'center' }}>
      <Image testID={testID} source={RINGS} accessible={false} style={{ width: size, height: size, opacity }} />
    </View>
  );
}
