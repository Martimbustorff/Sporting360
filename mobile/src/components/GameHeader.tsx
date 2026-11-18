// Figma: nós 500:28956 (jogo futuro: faixa "Próximo", emblemas 75x87 com nome, badge J16, data, hora 24 display,
// chip de TV, tabs) e 655:31868 (ao vivo: faixa "Live - 23’", caixas de resultado 40 display sobre branco, raio 4).
// Emblemas: quando a equipa é o Sporting (id API 228) usa-se sempre o emblema local 2026.
// SEM FIGMA: estados Intervalo, Adiado e Cancelado (mesma faixa do 500:28956 com outro texto; adiado e
// cancelado mostram só a data, sem hora, resultado nem TV) e a linha do local (outras modalidades,
// spec 5.6; texto body a muted por baixo da data, como a data do 500:29057).
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { CompetitionBadge } from '@/components/CompetitionBadge';
import { stateLabel, type UiState } from '@/lib/matchVM';
import { formatKickoffDate, formatTime } from '@/lib/ptDate';
import { SPORTING_API_ID } from '@/lib/teams';
import { Body, Display } from '@/theme/typography';
import { colors, layout, radius, spacing } from '@/theme/tokens';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SPORTING_CREST = require('../../assets/images/sporting-cp-2026.png') as number;

export type TeamVM = {
  name: string;
  crestUrl: string | null;
  /** API team id. Pass 228 for Sporting so the local 2026 crest is used instead of crestUrl. */
  id?: number | null;
};
export type GameHeaderVM = {
  competitionName: string;
  round: string;
  home: TeamVM;
  away: TeamVM;
  state: UiState;
  kickoff: Date;
  tv?: string | null;
  minute?: number | null;
  /** Minuto já formatado ("45+2’"); quando existe, a faixa usa-o em vez de `minute`. */
  minuteText?: string | null;
  /** Local do jogo; só preenchido fora do futebol (o futebol tem a secção Informação do Jogo). */
  venue?: string | null;
  score?: { home: number; away: number } | null;
};

/** `size`: 'lg' no cabeçalho (75x87, Figma 500:28798), 'sm' nas linhas da Agenda (30x35, Figma 500:28825). */
export function TeamCrest({ team, testID, size = 'lg' }: { team: TeamVM; testID?: string; size?: 'lg' | 'sm' }) {
  const box = size === 'lg' ? layout.crestSize : layout.crestSmall;
  const source = team.id === SPORTING_API_ID ? SPORTING_CREST : team.crestUrl ? { uri: team.crestUrl } : null;
  if (!source) return <View testID={testID} style={box} />;
  return (
    <Image
      testID={testID}
      source={source}
      contentFit="contain"
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={box}
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

// `stateLabel` vive em lib/matchVM (partilhado com a linha da Agenda).
function stripText(game: GameHeaderVM): string {
  if (game.state !== 'live') return stateLabel(game.state);
  if (game.minuteText) return `${stateLabel('live')} - ${game.minuteText}`;
  return game.minute != null ? `${stateLabel('live')} - ${game.minute}’` : stateLabel('live');
}

export function GameHeader({ game, tabs, now }: { game: GameHeaderVM; tabs?: ReactNode; now?: Date }) {
  const date = formatKickoffDate(game.kickoff, now);
  const off = game.state === 'postponed' || game.state === 'cancelled';
  const score = off ? null : game.score;
  return (
    <View
      accessible={false}
      style={{ gap: spacing.md, alignItems: 'stretch' }}
    >
      <View
        accessible
        accessibilityRole="header"
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
          {/* SEM FIGMA: nome da competição não existe no cabeçalho do Figma; requisito do Martim (visível). Tipografia strip a muted. */}
          <Body
            variant="strip"
            testID="competition-name"
            numberOfLines={1}
            style={{ opacity: layout.mutedOpacity, textAlign: 'center', maxWidth: layout.teamColumnWidth + layout.headerColumnsGap }}
          >
            {game.competitionName}
          </Body>
          <CompetitionBadge label={game.round} size="lg" />
          <View style={{ alignItems: 'center', gap: layout.headerDateGap }}>
            <Body variant="body" style={{ opacity: layout.mutedOpacity }}>{date}</Body>
            {score ? (
              <View style={{ flexDirection: 'row', gap: layout.scoreBoxGap }}>
                <ScoreBox value={score.home} testID="score-home" />
                <ScoreBox value={score.away} testID="score-away" />
              </View>
            ) : off ? null : (
              <Display variant="sectionScore">{formatTime(game.kickoff)}</Display>
            )}
            {game.venue ? (
              <Body
                variant="body"
                testID="game-venue"
                numberOfLines={1}
                style={{ opacity: layout.mutedOpacity, textAlign: 'center', maxWidth: layout.teamColumnWidth + layout.headerColumnsGap }}
              >
                {game.venue}
              </Body>
            ) : null}
          </View>
          {game.tv && !score && !off ? (
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
