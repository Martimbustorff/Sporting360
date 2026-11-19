// Figma V7.1: OfflineBanner 4952:9047 (frame 47 "Estados do sistema"): surface-20, raio 10, padding 14/10, ícone sem rede 18, texto Caption 12 branco.
import Feather from '@expo/vector-icons/Feather';
import { View } from 'react-native';
import { Text71 } from '@/theme/typography';
import { colors, layout, radii, space } from '@/theme/tokens';

export const OFFLINE_TEXT = 'Sem ligação. A mostrar os últimos dados guardados.';

export function OfflineBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <View
      testID="offline-banner"
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s8,
        backgroundColor: colors.surface20,
        borderRadius: radii.r12,
        paddingHorizontal: layout.bannerPadX,
        paddingVertical: layout.bannerPadY,
      }}
    >
      <Feather name="wifi-off" size={layout.bannerIcon} color={colors.white} accessibilityElementsHidden importantForAccessibility="no" />
      <Text71 variant="caption12" style={{ flex: 1, minWidth: 0 }}>{OFFLINE_TEXT}</Text71>
    </View>
  );
}
