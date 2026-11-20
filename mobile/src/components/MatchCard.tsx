// Figma V7.1: layout comum do cartão de jogo (frame 30 4946:8197, cartão do prognóstico; frame 50 4984:12744, empréstimo):
// degradê do topo ao bg, raio 20, competição (com a jornada em etiqueta, se houver), data, emblemas e nomes (com um miolo
// opcional entre eles: o prognóstico põe aí as caixas do resultado) e, por baixo, o recinto e os `children` de cada ecrã.
// A View do cartão vai por ref (captura do ShareCard com react-native-view-shot); `collapsable={false}` para o Android não
// a achatar. A largura é a do design quando se passa `width`; sem ela o cartão ocupa a largura do contentor.
import { forwardRef, useId, type ComponentRef, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { TeamCrest, type TeamVM } from '@/components/GameHeader';
import { Text71 } from '@/theme/typography';
import { colors, layout } from '@/theme/tokens';

export type MatchCardProps = {
  home: TeamVM;
  away: TeamVM;
  competition: string;
  /** Jornada ou fase, na etiqueta primary à esquerda da competição; sem ela não há etiqueta. */
  round?: string | null;
  /** Data e hora já formatadas. */
  kickoff: string;
  /** Nome do recinto, por baixo das equipas; sem ele não há linha. */
  venue?: string | null;
  /** Entre os dois emblemas (o prognóstico põe aqui as caixas do resultado). */
  center?: ReactNode;
  /** Por cima da competição (a marca do cartão de prognóstico). */
  header?: ReactNode;
  /** Competição numa linha e a jornada/fase por baixo, centradas (cartão do prognóstico, Martim 20/11). */
  stacked?: boolean;
  children?: ReactNode;
  width?: number;
  onLayout?: (e: LayoutChangeEvent) => void;
  testID?: string;
  kickoffTestID?: string;
  /** `${prefixo}-home` e `${prefixo}-away` nos emblemas. */
  crestTestIDPrefix?: string;
};

function Team({ team, side, testIDPrefix }: { team: TeamVM; side: 'home' | 'away'; testIDPrefix?: string }) {
  return (
    <View style={{ width: layout.shareTeamWidth, alignItems: 'center', gap: layout.shareTeamGap }}>
      <TeamCrest team={team} testID={testIDPrefix ? `${testIDPrefix}-${side}` : undefined} size="md" />
      <Text71 variant="label16" numberOfLines={2} style={{ textAlign: 'center' }}>
        {team.name}
      </Text71>
    </View>
  );
}

function RoundBadge({ round }: { round: string }) {
  return (
    <View
      testID="competition-badge"
      style={{
        backgroundColor: colors.primary,
        borderRadius: layout.chipRadius,
        paddingHorizontal: layout.badgeSmallPadX,
        paddingVertical: layout.badgeSmallPadY,
      }}
    >
      <Text71 variant="badge11">{round}</Text71>
    </View>
  );
}

export const MatchCard = forwardRef<ComponentRef<typeof View>, MatchCardProps>(function MatchCard(
  { home, away, competition, round, kickoff, venue, center, header, stacked, children, width, onLayout, testID, kickoffTestID, crestTestIDPrefix },
  ref,
) {
  // Um id por instância: com vários cartões no ecrã, ids iguais fariam um degradê referir-se ao de outro cartão.
  const gradId = `matchCardGrad${useId().replace(/[^A-Za-z0-9_-]/g, '')}`;
  return (
    <View
      ref={ref}
      testID={testID}
      collapsable={false}
      onLayout={onLayout}
      style={{
        ...(width !== undefined ? { width } : { alignSelf: 'stretch' }),
        backgroundColor: colors.bg,
        borderRadius: layout.shareCardRadius,
        overflow: 'hidden',
        paddingHorizontal: layout.shareCardPadX,
        paddingTop: layout.shareCardPadTop,
        paddingBottom: layout.shareCardPadBottom,
        gap: layout.shareCardGap,
        alignItems: 'center',
      }}
    >
      {/* O degradê vive numa View sem padding: com o Svg direto no cartão, os 100 % do iOS contavam só a largura do
          conteúdo e ficava uma faixa escura à direita (visto na partilha a 20/11). */}
      <View testID="match-card-bg" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.shareCardTop} />
              <Stop offset="1" stopColor={colors.bg} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradId})`} />
        </Svg>
      </View>

      {header}

      {stacked ? (
        <View testID="match-card-competition" style={{ alignItems: 'center', gap: layout.shareBoxGap }}>
          <Text71 variant="label16" numberOfLines={1} style={{ textAlign: 'center' }}>
            {competition}
          </Text71>
          {round ? <RoundBadge round={round} /> : null}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: layout.shareBoxGap }}>
          {round ? <RoundBadge round={round} /> : null}
          <Text71 variant="label16" numberOfLines={1} style={{ flexShrink: 1 }}>
            {competition}
          </Text71>
        </View>
      )}

      <Text71 variant="caption12" color="textMuted" testID={kickoffTestID}>
        {kickoff}
      </Text71>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch' }}>
        <Team team={home} side="home" testIDPrefix={crestTestIDPrefix} />
        {center}
        <Team team={away} side="away" testIDPrefix={crestTestIDPrefix} />
      </View>

      {venue ? <Text71 variant="caption12">{venue}</Text71> : null}

      {children}
    </View>
  );
});
