// Figma: nó 500:29854 (Calendar / Calendar_Check, 122 px, branco a 30 %): ícone `calendar`.
// V7.1: texto Body 14 text-muted.
// Ícone `info`: V7.1 47 Vazio (4952:9060), 64 pt com o SVG do Figma (opacidade 30 % no próprio SVG), espaço 12 ao texto.
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Text71 } from '@/theme/typography';
import { layout, space } from '@/theme/tokens';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const CALENDAR = require('../../assets/icons/calendar-check.svg');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const INFO = require('../../assets/icons/info.svg');

/** `compact` (50b, 50c): ícone a 8 do topo e nada por baixo; os 24 até ao botão são do ecrã. */
export function EmptyState({ text, icon = 'calendar', compact = false }: { text: string; icon?: 'calendar' | 'info'; compact?: boolean }) {
  return (
    <View
      testID="empty-state"
      style={{ alignItems: 'center', gap: icon === 'info' ? layout.emptyInfoGap : layout.emptyGap, paddingHorizontal: space.s32, paddingTop: compact ? layout.emptyCompactTop : space.s32, paddingBottom: compact ? 0 : space.s32 }}
    >
      {icon === 'calendar' ? (
        <Image
          testID="empty-icon-calendar"
          source={CALENDAR}
          style={{ width: layout.emptyIcon, height: layout.emptyIcon }}
          accessible={false}
        />
      ) : (
        <Image
          testID="empty-icon-info"
          source={INFO}
          style={{ width: layout.emptyInfoIcon, height: layout.emptyInfoIcon }}
          accessible={false}
        />
      )}
      <Text71 variant="body14" color="textMuted" style={{ textAlign: 'center' }}>{text}</Text71>
    </View>
  );
}
