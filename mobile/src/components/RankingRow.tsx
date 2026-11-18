// Posição: círculo do Figma 500:29423 (26, raio 24, DIN 20). SEM FIGMA: o resto da linha (nome, pontos, destaque do
// utilizador) é construído com tokens, a validar pelo Martim na galeria. Mostra só o nome público, nunca o email.
import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import { Body, Display } from '@/theme/typography';
import { colors, layout, radius, spacing } from '@/theme/tokens';

export type RankingVM = {
  position: number;
  uid: string;
  displayName: string;
  points: number;
  avatarId?: string | null;
};

export function RankingRow({ row, highlighted, avatarUri }: { row: RankingVM; highlighted: boolean; avatarUri?: string }) {
  const label = `${highlighted ? 'Tu, ' : ''}${row.position}.º, ${row.displayName}, ${row.points} ${row.points === 1 ? 'ponto' : 'pontos'}`;
  return (
    <View
      testID="ranking-row"
      accessible
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        minHeight: layout.rankingRowMinHeight,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        backgroundColor: highlighted ? colors.surface20 : 'transparent',
      }}
    >
      <View
        style={{
          width: layout.positionCircle,
          height: layout.positionCircle,
          borderRadius: radius.line,
          backgroundColor: highlighted ? colors.positionCircle : colors.surface10,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Display variant="minute" style={{ color: highlighted ? colors.black : colors.white }}>{String(row.position)}</Display>
      </View>
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} contentFit="cover" style={{ width: layout.avatarSize, height: layout.avatarSize, borderRadius: radius.pill }} />
      ) : null}
      <Body variant="body" numberOfLines={1} style={{ flex: 1 }}>{row.displayName}</Body>
      <Display variant="sectionScore">{String(row.points)}</Display>
    </View>
  );
}
