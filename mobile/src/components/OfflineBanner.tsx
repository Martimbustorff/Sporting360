// Figma V7.1: OfflineBanner 4952:9047 (frame 47 "Estados do sistema"): surface-20, raio 10, padding 14/10, ícone sem rede 18, texto Caption 12 branco.
// SEM FIGMA: a tolerância antes de aparecer. Cada leitura nova do Firestore (ex. mudar de modalidade no Calendário) dá
// primeiro o que está na cache e o servidor confirma logo a seguir: sem a tolerância o aviso piscava e empurrava o ecrã.
import Feather from '@expo/vector-icons/Feather';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text71 } from '@/theme/typography';
import { colors, layout, radii, space } from '@/theme/tokens';

export const OFFLINE_TEXT = 'Sem ligação. A mostrar os últimos dados guardados.';
/** Só se avisa quando os dados continuam a vir da cache passado este tempo (ms). */
export const OFFLINE_GRACE_MS = 1500;

export function OfflineBanner({ visible }: { visible: boolean }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!visible) {
      setShown(false);
      return undefined;
    }
    const t = setTimeout(() => setShown(true), OFFLINE_GRACE_MS);
    return () => clearTimeout(t);
  }, [visible]);
  if (!visible || !shown) return null;
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
