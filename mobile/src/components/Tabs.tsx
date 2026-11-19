// Figma V7.1: tabs 4935:7125 (com scroll: espaço 24, topo 15, etiqueta a 11 do indicador) e 4942:7676 (iguais: topo 10, linha separator por baixo).
// Etiqueta Label 16: ativa branca, inativas text-subtle. Indicador de 3 pt, raio 2, primary-on-dark na ativa.
// Diferença deliberada: altura mínima 44 (alvo de toque).
import { useCallback, useEffect, useRef, type ComponentRef } from 'react';
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
  // Modo scroll: o separador ativo faz scroll para ficar à vista (também quando muda por `?tab=` ou por toque).
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const spans = useRef<Record<string, { x: number; width: number }>>({});
  // Janela visível do scroll (largura e deslocamento atuais): só se faz scroll quando o separador não está todo à vista.
  const view = useRef({ width: 0, x: 0 });
  const reveal = useCallback(
    (key: string) => {
      const span = spans.current[key];
      if (mode !== 'scroll' || !span) return;
      const { width, x } = view.current;
      const visible = width > 0 && span.x >= x && span.x + span.width <= x + width;
      if (!visible) scroller.current?.scrollTo({ x: Math.max(0, span.x - layout.tabsScrollPad), animated: true });
    },
    [mode],
  );
  useEffect(() => reveal(value), [value, reveal]);
  const tabs = items.map((it) => {
    const active = it.key === value;
    const equal = mode === 'equal';
    return (
      <Touchable
        key={it.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        onLayout={(e) => {
          const { x, width } = e.nativeEvent.layout;
          spans.current[it.key] = { x, width };
          if (active) reveal(it.key);
        }}
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
          ref={scroller}
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="tablist"
          testID="tabs-scroll"
          scrollEventThrottle={16}
          onLayout={(e) => {
            view.current.width = e.nativeEvent.layout.width;
          }}
          onScroll={(e) => {
            view.current.x = e.nativeEvent.contentOffset.x;
          }}
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
