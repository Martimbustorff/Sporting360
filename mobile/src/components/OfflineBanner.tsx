// SEM FIGMA: faixa de aviso composta com tokens (surface20, texto `strip`), no topo do conteúdo,
// para quando os dados vêm da cache (Review Focus 3).
import { View } from 'react-native';
import { Text71 } from '@/theme/typography';
import { colors, layout, space } from '@/theme/tokens';

export const OFFLINE_TEXT = 'Sem ligação. A mostrar os últimos dados guardados.';

export function OfflineBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <View
      testID="offline-banner"
      accessibilityRole="alert"
      style={{
        backgroundColor: colors.surface10,
        paddingHorizontal: space.s16,
        paddingVertical: layout.offlineBannerPadY,
      }}
    >
      <Text71 variant="caption12" style={{ textAlign: 'center' }}>{OFFLINE_TEXT}</Text71>
    </View>
  );
}
