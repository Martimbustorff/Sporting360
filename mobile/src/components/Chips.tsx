// Figma V7.1: pílulas de filtro (4948:8261 modalidades, 4949:8482 competições, 4948:8508 rondas, 4935:7464 marcadores).
// Etiqueta Label 16; a ativa é branca com texto ink (`tone="white"`) ou primary com texto branco (`tone="primary"`,
// rondas do quadro); as inativas surface-10. Alvo de toque de 44 pt: o Touchable tem `minHeight` 44 e
// a pílula desenhada é uma View por dentro (o aspeto não muda; o alargamento automático do Touchable seria cortado por um
// pai da altura de uma pílula).
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
  // A altura extra do alvo (44 menos a pílula) já separa as linhas: o espaço entre linhas desconta-a.
  const pillHeight = 2 * padY + text71.label16.lineHeight;
  const rowGap = Math.max(0, space.s8 - Math.max(0, layout.minTouch - pillHeight));
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
        style={{ minHeight: layout.minTouch, justifyContent: 'center' }}
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
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s8, rowGap }}>
        {chips}
      </View>
    );
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      contentContainerStyle={{ gap: space.s8, alignItems: 'center' }}
    >
      {chips}
    </ScrollView>
  );
}
