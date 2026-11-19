// Figma V7.1: List row 4919:5133 (L 64 / M 52 com separador de 1 pt incluído; ícone 24, espaço 16, etiqueta Menu 15).
import type { ReactNode } from 'react';
import { View, type AccessibilityRole, type AccessibilityState } from 'react-native';
import { Touchable } from '@/components/Touchable';
import { Text71 } from '@/theme/typography';
import { colors, layout, space } from '@/theme/tokens';

export type ListRowSize = 'L' | 'M';

export function ListRow({
  icon,
  label,
  trailing,
  size = 'L',
  separator = true,
  onPress,
  disabled = false,
  accessibilityRole,
  accessibilityState,
  tone = 'default',
}: {
  icon: ReactNode;
  label: string;
  trailing?: ReactNode;
  size?: ListRowSize;
  separator?: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityRole: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  /** `danger`: etiqueta em danger (Apagar conta, 4922:5949). */
  tone?: 'default' | 'danger';
}) {
  return (
    <Touchable
      testID="list-row"
      accessibilityRole={accessibilityRole}
      accessibilityLabel={label}
      accessibilityState={accessibilityState}
      disabled={disabled}
      onPress={onPress}
      style={{ height: size === 'L' ? layout.listRowL : layout.listRowM, opacity: disabled ? layout.disabledOpacity : undefined }}
    >
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.s16 }}>
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>{icon}</View>
        <Text71 variant="menu15" color={tone === 'danger' ? 'danger' : 'white'} numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, minWidth: 0 }}>
          {label}
        </Text71>
        {trailing}
      </View>
      {separator ? <View testID="list-row-separator" style={{ height: layout.separator, backgroundColor: colors.separator }} /> : null}
    </Touchable>
  );
}
