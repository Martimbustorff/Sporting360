// Figma: nó 564:7096 (AGENDA, ícone 24 + gap 16 + etiqueta DIN 18 maiúsculas + seta direita 24) e 564:6990
// (variante externa, seta diagonal). Separador `divider` abaixo (SEM FIGMA: linha não está no nó).
import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Touchable } from './Touchable';
import { colors, layout, spacing, type } from '@/theme/tokens';

export function MenuRow({
  icon,
  label,
  onPress,
  external = false,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  external?: boolean;
}) {
  return (
    <Touchable
      accessibilityRole={external ? 'link' : 'button'}
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minHeight: layout.minTouch,
        paddingVertical: spacing.sm,
        borderBottomWidth: layout.fieldLineWidth,
        borderBottomColor: colors.divider,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: layout.menuRowGap, flexShrink: 1 }}>
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>{icon}</View>
          <Text style={type.menuRow}>{label}</Text>
        </View>
        <Feather
          name={external ? 'arrow-up-right' : 'arrow-right'}
          size={layout.menuRowIcon}
          color={colors.white}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>
    </Touchable>
  );
}
