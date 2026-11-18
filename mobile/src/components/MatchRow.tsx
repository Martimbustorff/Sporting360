// Figma: nós 500:28822 (linha de jogo por jogar, ecrã 500:28787) e 489:7003 (a mesma linha com
// resultado, nó 489:7038). Linha de 102 px: em cima o badge pequeno da jornada ou fase, a data
// (com a hora) a muted e a seta; em baixo nome + emblema da casa, a hora (DIN 24) ou as caixas do
// resultado, e o emblema + nome de fora.
// SEM FIGMA: o nome da competição ao lado do badge (requisito da Task 7; muted, numa linha, com
// reticências); "Adiado"/"Cancelado" no lugar da hora, com as palavras da faixa do GameHeader, e
// nesses estados a hora sai também da linha de cima; o desempate por penáltis por baixo das caixas
// (`penaltiesText`, Task 4); seta Feather "arrow-right" (como no MenuRow).
// A linha só é botão quando recebe `onPress`: na Task 13 as jornadas têm jogos sem Sporting, que não
// têm documento em `matches/{id}` e portanto não abrem o detalhe.
import Feather from '@expo/vector-icons/Feather';
import { Pressable, View } from 'react-native';
import { CompetitionBadge } from '@/components/CompetitionBadge';
import { TeamCrest, type TeamVM } from '@/components/GameHeader';
import type { Match } from '@/data/schemas';
import { penaltiesText, toGameHeaderVM } from '@/lib/matchVM';
import { formatKickoffDate, formatTime } from '@/lib/ptDate';
import { Body, Display } from '@/theme/typography';
import { colors, layout, radius, spacing } from '@/theme/tokens';

function TeamSide({ team, side }: { team: TeamVM; side: 'home' | 'away' }) {
  const crest = <TeamCrest team={team} size="sm" testID={`row-crest-${side}`} />;
  const name = (
    <Body
      variant="rowTeam"
      numberOfLines={1}
      ellipsizeMode="tail"
      style={{ flex: 1, textAlign: side === 'home' ? 'right' : 'left' }}
    >
      {team.name}
    </Body>
  );
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      {side === 'home' ? name : crest}
      {side === 'home' ? crest : name}
    </View>
  );
}

function ScoreBox({ value, testID }: { value: number; testID: string }) {
  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderRadius: radius.sm,
        padding: spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Display variant="rowScore" testID={testID}>{value}</Display>
    </View>
  );
}

export function MatchRow({ match, onPress }: { match: Match; onPress?: (id: string) => void }) {
  // O view-model da Task 4 dá a competição em pt-PT, os emblemas (Sporting sempre com o local) e o
  // resultado já filtrado (null antes do jogo, adiado ou cancelado).
  const vm = toGameHeaderVM(match);
  const offText = vm.state === 'postponed' ? 'Adiado' : vm.state === 'cancelled' ? 'Cancelado' : null;
  const score = vm.score ?? null;
  const pen = score && match.score.penalty;
  const date = formatKickoffDate(match.kickoff);
  const time = formatTime(match.kickoff);

  const content = (
    <View
      style={{
        paddingHorizontal: spacing.screenX,
        paddingVertical: layout.matchRowPadY,
        gap: layout.matchRowGap,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <CompetitionBadge label={vm.round} size="sm" />
        <Body
          variant="body"
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{ flex: 1, opacity: layout.mutedOpacity }}
        >
          {vm.competitionName}
        </Body>
        <Body variant="body" numberOfLines={1} style={{ opacity: layout.mutedOpacity }}>
          {offText ? date : `${date}, ${time}`}
        </Body>
        {onPress ? (
          <Feather
            testID="row-arrow"
            name="arrow-right"
            size={layout.menuRowIcon}
            color={colors.white}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TeamSide team={vm.home} side="home" />
        <View style={{ flexShrink: 0, alignItems: 'center', gap: layout.headerDateGap, paddingHorizontal: spacing.sm }}>
          {offText ? (
            <Body variant="strip" testID="row-state">{offText}</Body>
          ) : score ? (
            <>
              <View testID="row-score" style={{ flexDirection: 'row', gap: layout.scoreBoxGap, flexShrink: 0 }}>
                <ScoreBox value={score.home} testID="row-score-home" />
                <ScoreBox value={score.away} testID="row-score-away" />
              </View>
              {pen && pen.home != null && pen.away != null ? (
                <Body variant="badgeSmall" style={{ opacity: layout.mutedOpacity }}>
                  {penaltiesText(pen.home, pen.away)}
                </Body>
              ) : null}
            </>
          ) : (
            <Display variant="sectionScore" testID="row-time">{time}</Display>
          )}
        </View>
        <TeamSide team={vm.away} side="away" />
      </View>
    </View>
  );

  if (!onPress) return <View testID={`match-row-${match.id}`}>{content}</View>;
  return (
    <Pressable
      testID={`match-row-${match.id}`}
      accessibilityRole="button"
      onPress={() => onPress(match.id)}
      style={({ pressed }) => ({ opacity: pressed ? layout.pressedOpacity : 1 })}
    >
      {content}
    </Pressable>
  );
}
