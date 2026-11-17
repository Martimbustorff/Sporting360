// Figma: ficheiro R3IhhyNxNZuVINgUtJjZE3, nó 564:6950 (HEADER com fundo, "Nova Conta"); 500:28788 (Calendário) não consultado (limite MCP).
// A barra de estado do dispositivo (9:41, bateria) é chrome do sistema e não é implementada.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Display } from '@/theme/typography';
import { colors, layout } from '@/theme/tokens';

// Figma 564:6953: chevron para cima rodado -90 graus (seta para a esquerda).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const CHEVRON = require('../../assets/icons/chevron-up.svg');

export function Header({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  // Header owns the top inset: the 96px of Figma already include a 44px status bar area;
  // devices with a taller inset (notch / Dynamic Island) grow the header by the difference.
  const { top } = useSafeAreaInsets();
  const height = layout.headerHeight + Math.max(0, top - layout.statusBarHeight);
  return (
    <View testID="header" style={{ height }} className="w-full overflow-hidden">
      <BlurView intensity={layout.headerBlur} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={StyleSheet.absoluteFill} className="bg-s360-header" />
      <View
        className="absolute inset-x-0 bottom-0 flex-row items-center justify-between"
        style={{
          paddingBottom: layout.headerRowBottom,
          paddingHorizontal: layout.headerSideX,
        }}
      >
        <View style={{ width: layout.headerIcon, height: layout.headerIcon }}>
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              onPress={onBack}
              hitSlop={12}
            >
              <Image
                source={CHEVRON}
                style={{
                  width: layout.headerIcon,
                  height: layout.headerIcon,
                  transform: [{ rotate: '-90deg' }],
                }}
                tintColor={colors.white}
                accessible={false}
              />
            </Pressable>
          ) : null}
        </View>
        <View
          className="absolute inset-x-0 items-center"
          style={{ bottom: layout.headerRowBottom, pointerEvents: 'none', paddingHorizontal: layout.headerSideX + layout.headerIcon }}
        >
          <Display variant="screenTitle" accessibilityRole="header" numberOfLines={1}>{title}</Display>
        </View>
        <View style={{ minWidth: layout.headerIcon }}>{right}</View>
      </View>
    </View>
  );
}
