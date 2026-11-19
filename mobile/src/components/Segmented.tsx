// Figma V7.1: alternador "Parte" 4947:8240 (Jogo / 1.ª parte / 2.ª parte) e "Equipa" 4947:8526 (Sporting · 3-4-3 /
// adversário). Fundo surface-06 raio 10 com 4 de folga; item Label 16, ativo branco sobre primary raio 8, inativo
// text-muted. O alvo de toque de 44 pt vem do Touchable.
import { View } from 'react-native';
import { Touchable } from '@/components/Touchable';
import { Text71 } from '@/theme/typography';
import { colors, layout, radii } from '@/theme/tokens';

export function Segmented<K extends string>({
  items,
  value,
  onChange,
  testID,
}: {
  items: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        gap: layout.segmentedGap,
        padding: layout.segmentedPad,
        borderRadius: layout.segmentedRadius,
        backgroundColor: colors.surface06,
      }}
    >
      {items.map((it) => {
        const active = it.key === value;
        return (
          <Touchable
            key={it.key}
            testID={`segment-${it.key}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={it.label}
            onPress={() => onChange(it.key)}
            style={{
              flex: 1,
              minWidth: 0,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: layout.segmentedItemPadY,
              paddingHorizontal: layout.segmentedGap,
              borderRadius: radii.r8,
              backgroundColor: active ? colors.primary : undefined,
            }}
          >
            <Text71 variant="label16" color={active ? 'white' : 'textMuted'} numberOfLines={1}>{it.label}</Text71>
          </Touchable>
        );
      })}
    </View>
  );
}
