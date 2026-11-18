// Figma: nó 500:29854 (Calendar / Calendar_Check, 122 px, branco a 30 %): ícone `calendar`.
// SEM FIGMA: ícone `info` (Feather "info" no mesmo tamanho e opacidade) e o texto por baixo (`body`, centrado).
import { View } from 'react-native';
import { Image } from 'expo-image';
import Feather from '@expo/vector-icons/Feather';
import { Body } from '@/theme/typography';
import { colors, layout, spacing } from '@/theme/tokens';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const CALENDAR = require('../../assets/icons/calendar-check.svg');

export function EmptyState({ text, icon = 'calendar' }: { text: string; icon?: 'calendar' | 'info' }) {
  return (
    <View
      testID="empty-state"
      style={{ alignItems: 'center', gap: layout.emptyGap, paddingHorizontal: spacing.xl, paddingVertical: spacing.xl }}
    >
      {icon === 'calendar' ? (
        <Image
          testID="empty-icon-calendar"
          source={CALENDAR}
          style={{ width: layout.emptyIcon, height: layout.emptyIcon }}
          accessible={false}
        />
      ) : (
        <Feather
          testID="empty-icon-info"
          name="info"
          size={layout.emptyIcon}
          color={colors.white}
          style={{ opacity: layout.emptyInfoIconOpacity }}
          accessible={false}
        />
      )}
      <Body variant="body" style={{ textAlign: 'center' }}>{text}</Body>
    </View>
  );
}
