// Figma V7.1: Header 4918:5132 (52 de altura, padding 12, voltar 44, título Title 24 primary centrado, ação 44).
// O Header trata da área segura de cima; a barra de estado do sistema não se desenha.
import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Touchable } from '@/components/Touchable';
import { Text71 } from '@/theme/typography';
import { colors, layout, space } from '@/theme/tokens';

const slot = { width: layout.minTouch, height: layout.minTouch, alignItems: 'center', justifyContent: 'center' } as const;

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  const { top } = useSafeAreaInsets();
  return (
    <View
      testID="header"
      style={{
        height: top + layout.headerRow,
        paddingTop: top,
        paddingHorizontal: space.s12,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <View style={slot}>
        {onBack ? (
          <Touchable accessibilityRole="button" accessibilityLabel="Voltar" onPress={onBack} style={slot}>
            <Feather name="chevron-left" size={layout.headerIcon} color={colors.white} accessibilityElementsHidden importantForAccessibility="no" />
          </Touchable>
        ) : null}
      </View>
      <Text71
        variant="title24"
        color="primary"
        accessibilityRole="header"
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{ flex: 1, minWidth: 0, textAlign: 'center' }}
      >
        {title}
      </Text71>
      <View style={slot}>{right}</View>
    </View>
  );
}
