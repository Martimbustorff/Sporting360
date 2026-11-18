// Figma: nó 500:28650 (linhas de estatística: valor da casa à esquerda, rótulo ao centro, valor de fora à direita,
// DIN 32; divisória de 1 px a 20 % entre linhas; cartões com o retângulo amarelo 498:28525 / vermelho 500:28655,
// 13x19 raio 2 rodado 9.07º). Antes do jogo (500:29279) os valores ficam a 30 %: prop `muted`.
import { View } from 'react-native';
import { Body, Display } from '@/theme/typography';
import { colors, layout, spacing } from '@/theme/tokens';

export type StatRowProps = {
  label: string;
  home: string;
  away: string;
  /** Retângulo de cartão antes do rótulo. */
  card?: 'yellow' | 'red';
  /** Valores esbatidos (jogo ainda sem estatísticas). */
  muted?: boolean;
};

export function StatRow({ label, home, away, card, muted }: StatRowProps) {
  const value = (v: string, align: 'left' | 'right', testID: string) => (
    <View style={{ width: layout.statValueWidth, alignItems: align === 'left' ? 'flex-start' : 'flex-end' }}>
      <Display
        variant="heroTitle"
        testID={testID}
        numberOfLines={1}
        style={{ opacity: muted ? layout.statMutedOpacity : 1 }}
      >
        {v}
      </Display>
    </View>
  );
  return (
    <View
      testID="stat-row"
      accessible
      accessibilityLabel={`${label}: ${home} contra ${away}`}
      style={{
        minHeight: layout.statRowHeight,
        paddingHorizontal: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      {value(home, 'left', 'stat-home')}
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: layout.statCardGap }}>
        {card ? (
          <View
            testID="stat-card"
            style={{
              width: layout.cardWidth,
              height: layout.cardHeight,
              borderRadius: layout.cardRadius,
              backgroundColor: card === 'red' ? colors.cardRed : colors.cardYellowStat,
              transform: [{ rotate: layout.cardRotation }],
            }}
          />
        ) : null}
        <Body variant="tab" numberOfLines={1} style={{ flexShrink: 1, textAlign: 'center' }}>{label}</Body>
      </View>
      {value(away, 'right', 'stat-away')}
    </View>
  );
}
