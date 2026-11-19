// Figma V7.1: linha do Ranking 4943:7812 (círculo da posição 32: primary nos três primeiros, surface-10 nos outros, Label 16;
// nome Body 14; pontos Label 16 text-muted; padding 10, espaço 12, separador de 1 pt) e a linha própria 4943:7863
// (nome Strong 14 com " (tu)", pontos brancos). Mostra só o nome público, nunca o email. O nome ocupa uma linha com
// reticências e os pontos nunca encolhem (Review Focus 4). Sem avatar nem inicial (o frame não os tem).
import { View } from 'react-native';
import { Text71 } from '@/theme/typography';
import { colors, layout, space } from '@/theme/tokens';

export type RankingVM = {
  position: number;
  uid: string;
  displayName: string;
  points: number;
};

/** Primeira letra do nome público, em maiúscula; `?` se o nome vier vazio. */
export function initialOf(name: string): string {
  const first = [...name.trim()][0];
  return first ? first.toLocaleUpperCase('pt-PT') : '?';
}

/** `last`: sem separador (linha fixa em baixo). */
export function RankingRow({ row, highlighted, last = false }: { row: RankingVM; highlighted: boolean; last?: boolean }) {
  const label = `${highlighted ? 'Tu, ' : ''}${row.position}.º, ${row.displayName}, ${row.points} ${row.points === 1 ? 'ponto' : 'pontos'}`;
  return (
    <View
      testID="ranking-row"
      accessible
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s12,
        minHeight: layout.minTouch,
        paddingVertical: layout.rankRowPadY,
        borderBottomWidth: last ? 0 : layout.separator,
        borderBottomColor: colors.separator,
      }}
    >
      <View
        testID="ranking-position"
        style={{
          width: layout.rankCircle,
          height: layout.rankCircle,
          borderRadius: layout.rankCircle / 2,
          backgroundColor: row.position <= 3 ? colors.primary : colors.surface10,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Text71 variant="label16" numberOfLines={1}>{String(row.position)}</Text71>
      </View>
      <Text71 variant={highlighted ? 'strong14' : 'body14'} numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, minWidth: 0 }}>
        {highlighted ? `${row.displayName} (tu)` : row.displayName}
      </Text71>
      <Text71 variant="label16" color={highlighted ? 'white' : 'textMuted'} numberOfLines={1} style={{ flexShrink: 0 }}>
        {`${row.points} pts`}
      </Text71>
    </View>
  );
}
