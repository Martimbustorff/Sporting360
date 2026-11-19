// Figma V7.1: Header 4918:5132 (52 de altura, padding 12, voltar 44, título Title 24 primary centrado, ação 44).
// O Header trata da área segura de cima; a barra de estado do sistema não se desenha.
import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Touchable } from '@/components/Touchable';
import { Text71 } from '@/theme/typography';
import { colors, layout, space } from '@/theme/tokens';

const btn = { width: layout.minTouch, height: layout.minTouch, alignItems: 'center', justifyContent: 'center' } as const;
// Lados iguais (flex 1, mínimo 44): o título fica centrado e uma ação mais larga cresce sem o deslocar.
const side = { flex: 1, flexBasis: 0, minWidth: layout.minTouch, height: layout.minTouch, justifyContent: 'center' } as const;

/** `center` (opcional) substitui o título de texto (cabeçalho do jogo: competição e resultado compacto). */
export function Header({ title, onBack, right, center }: { title: string; onBack?: () => void; right?: ReactNode; center?: ReactNode }) {
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
      <View style={[side, { alignItems: 'flex-start' }]}>
        {onBack ? (
          <Touchable accessibilityRole="button" accessibilityLabel="Voltar" onPress={onBack} style={btn}>
            <Feather name="chevron-left" size={layout.headerIcon} color={colors.white} accessibilityElementsHidden importantForAccessibility="no" />
          </Touchable>
        ) : null}
      </View>
      {center ? (
        <View testID="header-center" style={{ flex: 3, flexBasis: 0, height: layout.minTouch, alignItems: 'center', justifyContent: 'center' }}>
          {center}
        </View>
      ) : (
      <Text71
        variant="title24"
        color="primary"
        accessibilityRole="header"
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{ flexShrink: 1, textAlign: 'center' }}
      >
        {title}
      </Text71>
      )}
      <View style={[side, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}
