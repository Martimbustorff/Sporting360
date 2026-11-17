// Figma: nós 500:28814 (2 tabs iguais), 500:28976 (tabs com scroll) e 500:28788 (cabeçalho do ecrã Calendário, já coberto pelo Header).
// Barra surface20 com raio 8; etiqueta tipografia tab com 8px acima; sublinhado 2px (ativa: branco; inativa: divider).
// Modo 'equal': inativas a branco (como no Figma). Modo 'scroll': inativas a 40% (textDisabled), 16px de margem à esquerda e entre tabs.
// Diferença deliberada: altura mínima 44 (alvo de toque) em vez dos 40 do Figma.
import { Pressable, ScrollView, View } from 'react-native';
import { Body } from '@/theme/typography';
import { colors, layout, radius, spacing } from '@/theme/tokens';

export function Tabs<K extends string>({
  items,
  value,
  onChange,
  mode,
}: {
  items: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
  mode: 'equal' | 'scroll';
}) {
  const tabs = items.map((it) => {
    const active = it.key === value;
    const labelColor = active || mode === 'equal' ? colors.white : colors.textDisabled;
    return (
      <Pressable
        key={it.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        onPress={() => onChange(it.key)}
        hitSlop={layout.minTouch / 4}
        style={{
          flex: mode === 'equal' ? 1 : undefined,
          minHeight: layout.minTouch,
          paddingTop: spacing.sm,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Body variant="tab" style={{ color: labelColor }}>
          {it.label}
        </Body>
        <View
          testID="tab-underline"
          style={{
            alignSelf: 'stretch',
            height: layout.tabUnderline,
            borderRadius: radius.hairline,
            backgroundColor: active ? colors.white : colors.divider,
          }}
        />
      </Pressable>
    );
  });
  const bar = { backgroundColor: colors.surface20, borderRadius: radius.md, overflow: 'hidden' } as const;
  if (mode === 'scroll') {
    return (
      <View style={bar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="tablist"
          contentContainerStyle={{ paddingLeft: spacing.md, gap: spacing.md }}
        >
          {tabs}
        </ScrollView>
      </View>
    );
  }
  return (
    <View style={[bar, { flexDirection: 'row' }]} accessibilityRole="tablist">
      {tabs}
    </View>
  );
}
