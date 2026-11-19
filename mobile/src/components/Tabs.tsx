// Figma V7.1: tabs 4935:7125 (com scroll: espaço 24, topo 15, etiqueta a 11 do indicador) e 4942:7676 (iguais: topo 10, linha separator por baixo).
// Etiqueta Label 16: ativa branca, inativas text-subtle. Indicador de 3 pt, raio 2, primary-on-dark na ativa.
// Diferença deliberada: altura mínima 44 (alvo de toque).
import { ScrollView, View } from 'react-native';
import { Touchable } from '@/components/Touchable';
import { Text71 } from '@/theme/typography';
import { colors, layout, space } from '@/theme/tokens';

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
    const equal = mode === 'equal';
    return (
      <Touchable
        key={it.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        onPress={() => onChange(it.key)}
        style={{
          flex: equal ? 1 : undefined,
          minHeight: layout.minTouch,
          paddingTop: equal ? layout.tabTopEqual : layout.tabTopScroll,
          gap: equal ? layout.tabGapEqual : layout.tabGapScroll,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text71 variant="label16" color={active ? 'white' : 'textSubtle'} numberOfLines={1}>
          {it.label}
        </Text71>
        <View
          testID="tab-underline"
          style={{
            alignSelf: 'stretch',
            height: layout.tabUnderline,
            borderRadius: layout.tabUnderlineRadius,
            backgroundColor: active ? colors.primaryOnDark : 'transparent',
          }}
        />
      </Touchable>
    );
  });
  const line = { borderBottomWidth: layout.separator, borderBottomColor: mode === 'equal' ? colors.separator : colors.surface10 } as const;
  if (mode === 'scroll') {
    return (
      <View style={line}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="tablist"
          contentContainerStyle={{ paddingHorizontal: space.s16, gap: space.s24 }}
        >
          {tabs}
        </ScrollView>
      </View>
    );
  }
  return (
    <View style={[line, { flexDirection: 'row' }]} accessibilityRole="tablist">
      {tabs}
    </View>
  );
}
