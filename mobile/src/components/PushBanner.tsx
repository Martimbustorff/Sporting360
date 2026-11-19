// Figma V7.1 47 (PushBanner 4952:9052: bg-raised, raio 16, emblema 26x30, padding 14/12, espaço 12). Plano 6: aviso de uma notificação recebida com a app aberta no Android (no iOS o sistema mostra-a).
// Faixa no topo, por cima do ecrã, só com tokens: título e corpo; tocar abre a rota (se houver) e fecha.
import { Image } from 'expo-image';
import { View } from 'react-native';
import { Touchable } from '@/components/Touchable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ForegroundPush } from '@/services/push';
import { Text71 } from '@/theme/typography';
import { colors, layout, radii, space } from '@/theme/tokens';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const CREST = require('../../assets/images/sporting-cp-2026.png') as number;

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
      style={{ position: 'absolute', top: insets.top + space.s8, left: space.s16, right: space.s16 }}
    >
      <Touchable
        testID="push-banner"
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={push.route ? PUSH_BANNER_TEXT.openHint : PUSH_BANNER_TEXT.closeHint}
        accessibilityLiveRegion="polite"
        onPress={onPress}
        style={{
          minHeight: layout.minTouch,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: layout.bannerPadX,
          paddingVertical: layout.pushBannerPadY,
          gap: space.s12,
          borderRadius: radii.r16,
          backgroundColor: colors.bgRaised,
          ...layout.pushBannerShadow,
        }}
      >
        <Image source={CREST} contentFit="contain" accessible={false} style={{ width: layout.pushBannerCrestW, height: layout.pushBannerCrestH }} />
        <View style={{ flex: 1, minWidth: 0, gap: layout.pushBannerTextGap }}>
          <Text71 variant="strong14" numberOfLines={1}>{push.title}</Text71>
          {push.body ? (
            <Text71 variant="caption12" color="textMuted" numberOfLines={2}>{push.body}</Text71>
          ) : null}
        </View>
      </Touchable>
    </View>
  );
}
