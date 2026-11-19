// Figma V7.1: pílulas de filtro (4948:8261 modalidades, 4949:8482 competições, 4948:8508 rondas, 4935:7464 marcadores).
// Etiqueta Label 16; a ativa é branca com texto ink (`tone="white"`) ou primary com texto branco (`tone="primary"`,
// rondas do quadro); as inativas surface-10. Alvo de toque de 44 pt: o Touchable tem `minHeight` 44 e
// a pílula desenhada é uma View por dentro (o aspeto não muda; o alargamento automático do Touchable seria cortado por um
// pai da altura de uma pílula). Os 44 pt acrescentam espaço visível que o frame não tem: o excesso de cada lado
// ((44 menos a pílula) / 2) devolve-se com margem vertical negativa, para as folgas visíveis serem as do frame (8 entre
// linhas, tira com a altura da pílula). O alvo continua a ter 44 pt (a margem só mexe no espaço que ocupa).
// `wrap`: as pílulas quebram de linha (Marcadores); sem ele correm na horizontal com scroll (320 pt sem cortes).
import { ScrollView, View } from 'react-native';
import { Touchable } from '@/components/Touchable';
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
        style={{ minHeight: layout.minTouch, justifyContent: 'center', marginVertical: wrap ? -overhang : 0 }}
      >
        <View
          style={{
            paddingHorizontal: padX,
            paddingVertical: padY,
            borderRadius: layout.pillRadius,
            backgroundColor: active ? activeBg : colors.surface10,
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
      contentContainerStyle={{ gap: space.s8, alignItems: 'center' }}
    >
      {chips}
    </ScrollView>
  );
}
