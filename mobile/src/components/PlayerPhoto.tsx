// Figma V7.1: Foto do jogador 4959:9550 (círculo surface-10 com a foto da API-Football; distintivo do número em baixo à direita:
// primary, contorno 1.5 bg, raio 6, Badge 11). Sem foto ou com falha a carregar: silhueta desenhada com react-native-svg.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Path } from 'react-native-svg';
import { Text71 } from '@/theme/typography';
import { colors, layout, radii, space } from '@/theme/tokens';

export function PlayerPhoto({
  photo,
  size,
  number,
  testID,
}: {
  photo: string | null;
  size: number;
  number?: string | number | null;
  testID?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photo]);
  const showImage = !!photo && !failed;
  const hasNumber = number !== undefined && number !== null && String(number) !== '';
  return (
    <View testID={testID} style={{ width: size, height: size, flexShrink: 0 }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          backgroundColor: colors.surface10,
        }}
      >
        {showImage ? (
          <Image
            testID="player-photo-image"
            source={{ uri: photo }}
            contentFit="cover"
            accessibilityElementsHidden
            importantForAccessibility="no"
            onError={() => setFailed(true)}
            style={{ width: size, height: size }}
          />
        ) : (
          <Svg testID="player-silhouette" width={size} height={size} viewBox="0 0 40 40" accessible={false}>
            <Circle cx={20} cy={15} r={6.5} fill={colors.separator} />
            <Path d="M7 40c0-8.5 5.8-14 13-14s13 5.5 13 14z" fill={colors.separator} />
          </Svg>
        )}
      </View>
      {hasNumber ? (
        <View
          testID="player-number"
          style={{
            position: 'absolute',
            bottom: -layout.playerBadgeOffsetY,
            right: -layout.playerBadgeOffsetX,
            paddingHorizontal: space.s4,
            paddingVertical: 1,
            backgroundColor: colors.primary,
            borderWidth: layout.playerBadgeBorder,
            borderColor: colors.bg,
            borderRadius: radii.r8 - 2,
          }}
        >
          <Text71 variant="badge11" numberOfLines={1}>{String(number)}</Text71>
        </View>
      ) : null}
    </View>
  );
}
