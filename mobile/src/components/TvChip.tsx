// Figma V7.1: canal de TV 4920:5103 (frame 01 4921:5155): pílula surface-10, raio 12, ícone TV 14 e o canal em Badge 11.
// Só se desenha com texto; null, vazio ou ausente não mostram nada.
import { Image } from 'expo-image';
import { View } from 'react-native';
import { Text71 } from '@/theme/typography';
import { colors, layout, radii, space } from '@/theme/tokens';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ICON_TV = require('../../assets/icons/tv.svg') as number;

export function TvChip({ tv, testID = 'tv-chip' }: { tv?: string | null; testID?: string }) {
  const label = tv?.trim();
  if (!label) return null;
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`Transmissão: ${label}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s4,
        backgroundColor: colors.surface10,
        borderRadius: radii.r12,
        paddingHorizontal: space.s8,
        paddingVertical: space.s4,
        maxWidth: '100%',
      }}
    >
      <Image source={ICON_TV} accessible={false} style={{ width: layout.tvChipIcon, height: layout.tvChipIcon }} />
      <Text71 variant="badge11" numberOfLines={1} style={{ flexShrink: 1 }}>{label}</Text71>
    </View>
  );
}
