// Figma V7.1: linha de jogador da classificação de marcadores (4935:7488): posição, foto 36, nome com a linha de apoio ao
// lado, barra proporcional ao líder (primary-on-dark) e valor em Title S 20. Usada nos Marcadores da equipa e nos tops
// da competição (Marcadores, Assistências, Cartões). Só é botão quando recebe `onPress` (os jogadores de outras equipas
// não têm ecrã de jogador).
import { View } from 'react-native';
import { PlayerPhoto } from '@/components/PlayerPhoto';
import { Touchable } from '@/components/Touchable';
import { Text71 } from '@/theme/typography';
import { colors, layout, space } from '@/theme/tokens';

export function LeaderPlayerRow({
  testID,
  barTestID,
  label,
  rank,
  photo,
  name,
  sub,
  value,
  top,
  onPress,
}: {
  testID?: string;
  barTestID?: string;
  /** Rótulo de acessibilidade da linha inteira. */
  label: string;
  rank: number;
  photo: string | null;
  name: string;
  /** Linha de apoio ao lado do nome (posição, equipa...). */
  sub?: string;
  value: number;
  /** Valor do líder: a barra desta linha é `value / top`. */
  top: number;
  onPress?: () => void;
}) {
  const ratio = top > 0 ? Math.min(1, value / top) : 0;
  const style = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s12,
    paddingVertical: layout.leaderRowPadY,
    borderBottomWidth: layout.separator,
    borderBottomColor: colors.separator,
  } as const;
  const content = (
    <>
      <Text71 variant="label16" color="textSubtle" style={{ width: layout.leaderRankWidth }}>{rank}</Text71>
      <PlayerPhoto photo={photo} size={layout.leaderRowPhoto} />
      <View style={{ flex: 1, minWidth: 0, gap: layout.leaderNameGap }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: layout.leaderNameGap }}>
          <Text71 variant="strong14" numberOfLines={1} ellipsizeMode="tail" style={{ flexShrink: 1 }}>{name}</Text71>
          {sub ? (
            <Text71 variant="caption12" color="textSubtle" numberOfLines={1} ellipsizeMode="tail" style={{ flexShrink: 0 }}>{sub}</Text71>
          ) : null}
        </View>
        <View style={{ height: layout.leaderBarHeight, borderRadius: layout.leaderBarRadius, backgroundColor: colors.surface10, overflow: 'hidden' }}>
          <View
            testID={barTestID}
            style={{ width: `${ratio * 100}%`, height: layout.leaderBarHeight, borderRadius: layout.leaderBarRadius, backgroundColor: colors.primaryOnDark }}
          />
        </View>
      </View>
      <Text71 variant="titleS20" style={{ flexShrink: 0 }}>{value}</Text71>
    </>
  );
  if (!onPress) {
    return (
      <View testID={testID} accessible accessibilityLabel={label} style={style}>
        {content}
      </View>
    );
  }
  return (
    <Touchable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={style}>
      {content}
    </Touchable>
  );
}
