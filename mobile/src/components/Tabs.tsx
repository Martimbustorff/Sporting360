// Figma: nós 500:28814 (2 tabs iguais) e 500:28976 (tabs com scroll): NÃO consultados (limite de chamadas do MCP Figma atingido).
// SEM FIGMA (provisório): tab ativa com sublinhado primary, inativas textDisabled sobre divider; rever contra os nós.
import { Pressable, ScrollView, View } from 'react-native';
import { Body } from '@/theme/typography';
import { colors, layout, spacing } from '@/theme/tokens';

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
    return (
      <Pressable
        key={it.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        onPress={() => onChange(it.key)}
        className={`items-center justify-center ${active ? 'border-s360-primary' : 'border-s360-divider'} ${mode === 'equal' ? 'flex-1' : ''}`}
        hitSlop={layout.minTouch / 4}
        style={{
          minHeight: layout.minTouch,
          borderBottomWidth: layout.tabUnderline,
          paddingHorizontal: mode === 'scroll' ? spacing.md : 0,
        }}
      >
        <Body variant="tab" style={{ color: active ? colors.white : colors.textDisabled }}>
          {it.label}
        </Body>
      </Pressable>
    );
  });
  if (mode === 'scroll') {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist">
        {tabs}
      </ScrollView>
    );
  }
  return (
    <View className="flex-row" accessibilityRole="tablist">
      {tabs}
    </View>
  );
}
