// Figma V7.1: pílulas de filtro (4948:8261 modalidades, 4949:8482 competições, 4948:8508 rondas, 4935:7464 marcadores).
// Etiqueta Label 16; a ativa é branca com texto ink (`tone="white"`) ou primary com texto branco (`tone="primary"`,
// rondas do quadro); as inativas surface-10. Alvo de toque de 44 pt: o Touchable tem `minHeight` 44 e
// a pílula desenhada é uma View por dentro (o aspeto não muda; o alargamento automático do Touchable seria cortado por um
// pai da altura de uma pílula). Os 44 pt acrescentam espaço visível que o frame não tem: o excesso de cada lado
// ((44 menos a pílula) / 2) devolve-se com margem vertical negativa, para as folgas visíveis serem as do frame (8 entre
// linhas, tira com a altura da pílula). O alvo continua a ter 44 pt (a margem só mexe no espaço que ocupa).
// `wrap`: as pílulas quebram de linha (Marcadores); sem ele correm na horizontal com scroll (320 pt sem cortes).
// Movimento (20/11): sem `wrap`, a pílula ativa desliza de uma pílula para a outra (mola `SPRING`); até se medir
// (primeiro desenho, testes) cada pílula pinta o seu fundo, como antes.
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Touchable } from '@/components/Touchable';
import { canAnimate, SPRING } from '@/lib/motion';
import { Text71 } from '@/theme/typography';
import { colors, layout, space, text71 } from '@/theme/tokens';

export function Chips<K extends string>({
  items,
  value,
  onChange,
  tone = 'white',
  wrap = false,
  padX = layout.chipPadX,
  padY = layout.chipPadY,
  testIDPrefix = 'chip',
}: {
  items: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
  tone?: 'white' | 'primary';
  wrap?: boolean;
  padX?: number;
  padY?: number;
  testIDPrefix?: string;
}) {
  const pillHeight = 2 * padY + text71.label16.lineHeight;
  const overhang = Math.max(0, layout.minTouch - pillHeight) / 2;
  const slide = !wrap && canAnimate();
  const spans = useRef<Record<string, { x: number; y: number; width: number; height: number }>>({});
  const [measured, setMeasured] = useState(false);
  const pill = usePill(slide);
  useEffect(() => {
    const sp = spans.current[value];
    if (!pill || !sp) return;
    pill.x.set(withSpring(sp.x, SPRING));
    pill.w.set(withSpring(sp.width, SPRING));
  }, [value, pill]);
  const chips = items.map((it) => {
    const active = it.key === value;
    const activeBg = tone === 'primary' ? colors.primary : colors.white;
    const activeText = tone === 'primary' ? 'white' : 'ink';
    return (
      <Touchable
        key={it.key}
        testID={`${testIDPrefix}-${it.key}`}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={it.label}
        onPress={() => onChange(it.key)}
        onLayout={(e) => {
          if (!slide) return;
          const { x, y, width, height } = e.nativeEvent.layout;
          spans.current[it.key] = { x, y, width, height };
          if (active && pill) {
            pill.x.set(x);
            pill.w.set(width);
            pill.y.set(y + (height - pillHeight) / 2);
            setMeasured(true);
          }
        }}
        style={{ minHeight: layout.minTouch, justifyContent: 'center', marginVertical: wrap ? -overhang : 0 }}
      >
        <View
          style={{
            paddingHorizontal: padX,
            paddingVertical: padY,
            borderRadius: layout.pillRadius,
            backgroundColor: active ? (measured ? 'transparent' : activeBg) : colors.surface10,
          }}
        >
          <Text71 variant="label16" color={active ? activeText : 'white'} numberOfLines={1}>
            {it.label}
          </Text71>
        </View>
      </Touchable>
    );
  });
  if (wrap) {
    return (
      <View
        testID={`${testIDPrefix}-strip`}
        accessibilityRole="tablist"
        // Cada pílula sobressai `overhang` do espaço que ocupa; o enchimento mantém o alvo dentro do contentor e a margem
        // devolve esse espaço ao que está à volta.
        style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s8, rowGap: space.s8, paddingVertical: overhang, marginVertical: -overhang }}
      >
        {chips}
      </View>
    );
  }
  return (
    <ScrollView
      testID={`${testIDPrefix}-strip`}
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      style={{ marginVertical: -overhang }}
      contentContainerStyle={{ alignItems: 'center' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s8 }}>
        {measured && pill ? <Pill pill={pill} height={pillHeight} color={tone === 'primary' ? colors.primary : colors.white} /> : null}
        {chips}
      </View>
    </ScrollView>
  );
}

type Value = { get: () => number; set: (v: number) => void };
type PillValues = { x: Value; y: Value; w: Value };

/** Posição animada da pílula ativa; sem Reanimated (alguns testes) não há pílula a deslizar. */
function usePill(slide: boolean): PillValues | null {
  // `slide` é constante para cada instância (depende de `wrap` e do ambiente): a ordem dos hooks não muda.
  /* eslint-disable react-hooks/rules-of-hooks */
  if (!slide) return null;
  const x = useSharedValue(0) as unknown as Value;
  const y = useSharedValue(0) as unknown as Value;
  const w = useSharedValue(0) as unknown as Value;
  const ref = useRef({ x, y, w });
  /* eslint-enable react-hooks/rules-of-hooks */
  return ref.current;
}

function Pill({ pill, height, color }: { pill: PillValues; height: number; color: string }) {
  const style = useAnimatedStyle(() => ({ left: pill.x.get(), top: pill.y.get(), width: pill.w.get() }));
  return (
    <Animated.View
      testID="chip-pill"
      pointerEvents="none"
      style={[{ position: 'absolute', height, borderRadius: layout.pillRadius, backgroundColor: color }, style]}
    />
  );
}
