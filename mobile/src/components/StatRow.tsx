// Figma V7.1: 4947:8247 (bloco de estatística: valores Title S 20 nos cantos, rótulo Caption 12 text-muted ao centro,
// barra de 4 pt por baixo com as duas equipas lado a lado, raio 2) e 4947:8311 (linha "Cartões": amarelo e vermelho de
// cada equipa, 10x14 raio 2, contagem Label 16). A barra da equipa com o valor maior é primary-on-dark, a outra
// surface-20 (empate sem líder). Antes do jogo (500:29279) os valores e as barras ficam esbatidos: prop `muted`.
import { View } from 'react-native';
import { statBars } from '@/lib/stats';
import { Text71 } from '@/theme/typography';
import { colors, layout, space } from '@/theme/tokens';

export type StatRowProps = {
  label: string;
  home: string;
  away: string;
  /** Valores esbatidos (jogo ainda sem estatísticas). */
  muted?: boolean;
};

export function StatRow({ label, home, away, muted }: StatRowProps) {
  const bars = statBars(home, away);
  const bar = (side: 'home' | 'away') => (
    <View
      testID={`stat-bar-${side}`}
      style={{
        flexGrow: bars[side].grow,
        flexShrink: 1,
        flexBasis: 0,
        minWidth: bars[side].grow > 0 ? layout.statBarHeight : 0,
        height: layout.statBarHeight,
        borderRadius: layout.statBarHeight / 2,
        backgroundColor: bars[side].leader ? colors.primaryOnDark : colors.surface20,
      }}
    />
  );
  return (
    <View
      testID="stat-row"
      accessible
      accessibilityLabel={`${label}: ${home} contra ${away}`}
      style={{ gap: layout.statLabelGap, opacity: muted ? layout.statMutedOpacity : 1 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s8 }}>
        <Text71 variant="titleS20" testID="stat-home" numberOfLines={1}>{home}</Text71>
        <Text71 variant="caption12" color="textMuted" numberOfLines={1} style={{ flexShrink: 1, textAlign: 'center' }}>
          {label}
        </Text71>
        <Text71 variant="titleS20" testID="stat-away" numberOfLines={1}>{away}</Text71>
      </View>
      <View style={{ flexDirection: 'row', gap: layout.statBarGap }}>
        {bar('home')}
        {bar('away')}
      </View>
    </View>
  );
}

function CardCount({ yellow, red, side }: { yellow: string; red: string; side: 'home' | 'away' }) {
  const chip = (color: string) => (
    <View style={{ width: layout.statCardW, height: layout.statCardH, borderRadius: layout.statCardRadius, backgroundColor: color }} />
  );
  return (
    <View testID={`cards-${side}`} style={{ flexDirection: 'row', alignItems: 'center', gap: layout.statCardCountGap }}>
      {chip(colors.yellow71)}
      <Text71 variant="label16" testID={`cards-${side}-yellow`}>{yellow}</Text71>
      {chip(colors.formLoss)}
      <Text71 variant="label16" testID={`cards-${side}-red`}>{red}</Text71>
    </View>
  );
}

export type CardsRowProps = {
  home: { yellow: string; red: string };
  away: { yellow: string; red: string };
  muted?: boolean;
};

/** Última linha das Estatísticas: cartões amarelos e vermelhos das duas equipas (4947:8311). */
export function CardsRow({ home, away, muted }: CardsRowProps) {
  return (
    <View
      testID="cards-row"
      accessible
      accessibilityLabel={`Cartões: ${home.yellow} amarelos e ${home.red} vermelhos contra ${away.yellow} amarelos e ${away.red} vermelhos`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space.s8,
        opacity: muted ? layout.statMutedOpacity : 1,
      }}
    >
      <CardCount side="home" {...home} />
      <Text71 variant="caption12" color="textMuted">Cartões</Text71>
      <CardCount side="away" {...away} />
    </View>
  );
}
