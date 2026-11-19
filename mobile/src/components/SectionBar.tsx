// Figma V7.1: secção 4942:7656 (Eyebrow 13 text-subtle, padding de cima 8, ação opcional Caption Strong primary-on-dark)
// e linha de informação 4942:7659 (padding 12, etiqueta Body 14 text-muted, valor Strong 14, separador por baixo).
import { View } from 'react-native';
import { Touchable } from '@/components/Touchable';
import { Text71 } from '@/theme/typography';
import { colors, layout, space } from '@/theme/tokens';

/** `right`: texto da ação à direita; só é tocável com `onRightPress`. */
export function SectionBar({ label, right, onRightPress }: { label: string; right?: string; onRightPress?: () => void }) {
  const action = right ? (
    <Text71 variant="captionStrong12" color="primaryOnDark" testID="section-bar-right" numberOfLines={1}>
      {right}
    </Text71>
  ) : null;
  return (
    <View testID="section-bar" style={{ paddingTop: space.s8, flexDirection: 'row', alignItems: 'center', gap: space.s16 }}>
      <Text71 variant="eyebrow13" color="textSubtle" accessibilityRole="header" numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>
        {label}
      </Text71>
      {action && onRightPress ? (
        <Touchable accessibilityRole="button" accessibilityLabel={right} onPress={onRightPress}>
          {action}
        </Touchable>
      ) : (
        action
      )}
    </View>
  );
}

/** `singleLine`: o valor fica numa linha com reticências (Perfil: jogador favorito, lugar anual). */
export function InfoRow({ label, value, singleLine = false }: { label: string; value: string; singleLine?: boolean }) {
  return (
    <View
      style={{
        minHeight: layout.minTouch,
        paddingVertical: space.s12,
        borderBottomWidth: layout.separator,
        borderBottomColor: colors.separator,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s16,
      }}
    >
      <Text71 variant="body14" color="textMuted" style={{ flex: 1, flexShrink: 0 }}>
        {label}
      </Text71>
      <Text71
        variant="strong14"
        numberOfLines={singleLine ? 1 : undefined}
        ellipsizeMode={singleLine ? 'tail' : undefined}
        style={{ flexShrink: 1, textAlign: 'right' }}
      >
        {value}
      </Text71>
    </View>
  );
}
