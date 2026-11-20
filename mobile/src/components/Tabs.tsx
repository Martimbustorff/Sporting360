// Figma V7.1: tabs 4935:7125 (com scroll: espaço 24, topo 15, etiqueta a 11 do indicador) e 4942:7676 (iguais: topo 10, linha separator por baixo).
// Etiqueta Label 16: ativa branca, inativas text-subtle. Indicador de 3 pt, raio 2, primary-on-dark na ativa.
// Diferença deliberada: altura mínima 44 (alvo de toque).
// Movimento (20/11): o indicador desliza de um separador para o outro com mola (`SPRING`). Até cada separador se medir
// (primeiro desenho, testes) o indicador fica no próprio separador, como antes.
// `plain` (modo scroll): variante das Notícias (4943:7909): começa a 24, sem linha por baixo, topo 10 e espaço 10.
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Touchable } from '@/components/Touchable';
import { canAnimate, SPRING } from '@/lib/motion';
import { Text71 } from '@/theme/typography';
import { colors, layout, space } from '@/theme/tokens';

export function Tabs<K extends string>({
  items,
  value,
  onChange,
  mode,
  plain = false,
}: {
  items: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
  mode: 'equal' | 'scroll';
  plain?: boolean;
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
  const slide = canAnimate();
  const [measured, setMeasured] = useState(false);
  const ix = useSlideValue(slide);
  const iw = useSlideValue(slide);
  useEffect(() => {
    const span = spans.current[value];
    if (!slide || !span) return;
    ix?.set(withSpring(span.x, SPRING));
    iw?.set(withSpring(span.width, SPRING));
  }, [value, slide, ix, iw]);
  const tabs = items.map((it) => {
    const active = it.key === value;
    const equal = mode === 'equal';
    const compact = equal || plain;
    return (
      <Touchable
        key={it.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        onLayout={(e) => {
          const { x, width } = e.nativeEvent.layout;
          spans.current[it.key] = { x, width };
          if (active) {
            reveal(it.key);
            // Primeira medição do ativo: o indicador nasce no sítio, sem deslizar.
            ix?.set(x);
            iw?.set(width);
            if (slide) setMeasured(true);
          }
        }}
        onPress={() => onChange(it.key)}
        style={{
          flex: equal ? 1 : undefined,
          minHeight: layout.minTouch,
          paddingTop: compact ? layout.tabTopEqual : layout.tabTopScroll,
          gap: compact ? layout.tabGapEqual : layout.tabGapScroll,
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
            backgroundColor: active && !measured ? colors.primaryOnDark : 'transparent',
          }}
        />
      </Touchable>
    );
  });
  const indicator = measured && ix && iw ? <Indicator x={ix} w={iw} /> : null;
  const line = plain
    ? {}
    : ({ borderBottomWidth: layout.separator, borderBottomColor: mode === 'equal' ? colors.separator : colors.surface10 } as const);
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
          contentContainerStyle={{ paddingHorizontal: plain ? space.s24 : space.s16 }}
        >
          <View style={{ flexDirection: 'row', gap: space.s24 }}>
            {tabs}
            {indicator}
          </View>
        </ScrollView>
      </View>
    );
  }
  return (
    <View style={[line, { flexDirection: 'row' }]} accessibilityRole="tablist">
      {tabs}
      {indicator}
    </View>
  );
}

type Slide = { get: () => number; set: (v: number) => void };

/** Valor animado do indicador; sem Reanimated (alguns testes) não há indicador a deslizar. */
function useSlideValue(slide: boolean): Slide | null {
  // `canAnimate()` é constante durante a execução: a ordem dos hooks não muda.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return slide ? (useSharedValue(0) as unknown as Slide) : null;
}

function Indicator({ x, w }: { x: Slide; w: Slide }) {
  const style = useAnimatedStyle(() => ({ left: x.get(), width: w.get() }));
  return (
    <Animated.View
      testID="tab-indicator"
      pointerEvents="none"
      style={[
        { position: 'absolute', bottom: 0, height: layout.tabUnderline, borderRadius: layout.tabUnderlineRadius, backgroundColor: colors.primaryOnDark },
        style,
      ]}
    />
  );
}
