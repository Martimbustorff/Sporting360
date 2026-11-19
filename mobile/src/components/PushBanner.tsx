// SEM FIGMA (Plano 6): aviso de uma notificação recebida com a app aberta no Android (no iOS o sistema mostra-a).
// Faixa no topo, por cima do ecrã, só com tokens: título e corpo; tocar abre a rota (se houver) e fecha.
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ForegroundPush } from '@/services/push';
import { Body } from '@/theme/typography';
import { colors, layout, radius, spacing } from '@/theme/tokens';

/** Tempo até o aviso fechar sozinho. */
export const PUSH_BANNER_MS = 6000;

export const PUSH_BANNER_TEXT = {
  openHint: 'Toca para abrir.',
  closeHint: 'Toca para fechar.',
} as const;

export function PushBanner({ push, onPress }: { push: ForegroundPush; onPress: () => void }) {
  const insets = useSafeAreaInsets();
  const label = push.body ? `${push.title}. ${push.body}` : push.title;
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: insets.top + spacing.sm, left: spacing.md, right: spacing.md }}
    >
      <Pressable
        testID="push-banner"
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={push.route ? PUSH_BANNER_TEXT.openHint : PUSH_BANNER_TEXT.closeHint}
        accessibilityLiveRegion="polite"
        onPress={onPress}
        style={({ pressed }) => ({
          minHeight: layout.minTouch,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          gap: spacing.xs,
          borderRadius: radius.md,
          backgroundColor: colors.bg,
          borderWidth: layout.separator,
          borderColor: colors.primary,
          opacity: pressed ? layout.pressedOpacity : 1,
          ...layout.sheetShadow,
        })}
      >
        <Body variant="strip" numberOfLines={1}>{push.title}</Body>
        {push.body ? (
          <Body variant="body" numberOfLines={2}>{push.body}</Body>
        ) : null}
      </Pressable>
    </View>
  );
}
