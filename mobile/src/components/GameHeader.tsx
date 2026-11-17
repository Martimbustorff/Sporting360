// Figma: nós 500:28956 (jogo futuro: faixa "Próximo", emblemas 75x87 com nome, badge J16, data, hora 24 display,
// chip de TV, tabs) e 655:31868 (ao vivo: faixa "Live - 23’", caixas de resultado 40 display sobre branco, raio 4).
// Emblemas: quando a equipa é o Sporting (id API 228) usa-se sempre o emblema local 2026.
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { CompetitionBadge } from '@/components/CompetitionBadge';
import { formatKickoffDate, formatTime } from '@/lib/ptDate';
import { Body, Display } from '@/theme/typography';
import { colors, layout, radius, spacing } from '@/theme/tokens';

export const SPORTING_API_ID = 228;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SPORTING_CREST = require('../../assets/images/sporting-cp-2026.png') as number;

export type TeamVM = { name: string; crestUrl: string | null; id?: number | null };
export type GameHeaderVM = {
  competitionName: string;
  round: string;
  home: TeamVM;
  away: TeamVM;
  state: 'scheduled' | 'live' | 'finished';
  kickoff: Date;
  tv?: string | null;
  minute?: number | null;
  score?: { home: number; away: number } | null;
};

export function TeamCrest({ team, testID }: { team: TeamVM; testID?: string }) {
  const source = team.id === SPORTING_API_ID ? SPORTING_CREST : team.crestUrl ? { uri: team.crestUrl } : null;
  if (!source) return <View testID={testID} style={layout.crestSize} />;
  return (
    <Image
      testID={testID}
      source={source}
      contentFit="contain"
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={layout.crestSize}
    />
  );
}

function Team({ team, side }: { team: TeamVM; side: 'home' | 'away' }) {
  return (
    <View style={{ width: layout.teamColumnWidth, alignItems: 'center', gap: layout.headerCrestNameGap }}>
      <TeamCrest team={team} testID={`crest-${side}`} />
      <Body variant="body" numberOfLines={2} style={{ textAlign: 'center' }}>{team.name}</Body>
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
      <Display variant="scoreBox" testID={testID}>{value}</Display>
    </View>
  );
}

function stripText(game: GameHeaderVM): string {
  if (game.state === 'live') return game.minute != null ? `Live - ${game.minute}’` : 'Live';
  if (game.state === 'finished') return 'Terminado';
  return 'Próximo';
}

export function GameHeader({ game, tabs, now }: { game: GameHeaderVM; tabs?: ReactNode; now?: Date }) {
  const date = formatKickoffDate(game.kickoff, now);
  return (
    <View
      accessible={false}
      style={{ gap: spacing.md, alignItems: 'stretch' }}
    >
      <View
        accessibilityRole="header"
        accessibilityLabel={`${game.competitionName}, ${stripText(game)}`}
        style={{
          backgroundColor: colors.surface20,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Body variant="strip">{stripText(game)}</Body>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: layout.headerColumnsGap,
        }}
      >
        <Team team={game.home} side="home" />
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <CompetitionBadge label={game.round} size="lg" />
          <View style={{ alignItems: 'center', gap: layout.headerDateGap }}>
            <Body variant="body" style={{ opacity: layout.mutedOpacity }}>{date}</Body>
            {game.score ? (
              <View style={{ flexDirection: 'row', gap: layout.scoreBoxGap }}>
                <ScoreBox value={game.score.home} testID="score-home" />
                <ScoreBox value={game.score.away} testID="score-away" />
              </View>
            ) : (
              <Display variant="sectionScore">{formatTime(game.kickoff)}</Display>
            )}
          </View>
          {game.tv && !game.score ? (
            <View
              style={{
                backgroundColor: colors.surface20,
                borderRadius: radius.pill,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
              }}
            >
              <Body variant="body">{game.tv}</Body>
            </View>
          ) : null}
        </View>
        <Team team={game.away} side="away" />
      </View>
      {tabs ? <View style={{ paddingHorizontal: spacing.screenX }}>{tabs}</View> : null}
    </View>
  );
}
