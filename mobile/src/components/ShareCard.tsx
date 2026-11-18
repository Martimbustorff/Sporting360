// SEM FIGMA: cartão "S360 MATCHDAY" partilhável (Task 17). Sem frame vetorial; referência visual na imagem raster da
// página "Appstore S360" (818:20427, ver com get_screenshot). Composto com tokens: "S360" com o S a primary,
// "MATCH" fino + "DAY" carregado, nome da competição, CompetitionBadge com a jornada, data e hora (Europe/Lisbon),
// emblemas e nomes (TeamCrest: Sporting com o emblema local 2026), caixas brancas do prognóstico (ScoreBox do
// GameHeader), "#JogoAJogoLadoALado", "Partilha o teu prognóstico" e, a mais do que a referência (requisito do
// Martim, plano2-inputs "Cartão de prognóstico partilhável"), o QR e o link curto em texto, porque algumas apps
// largam a mensagem. Sem fotografias de pessoas. A View raiz vai por ref para a captura (react-native-view-shot);
// `collapsable={false}` para o Android não a achatar.
import { forwardRef, type ComponentRef } from 'react';
import { Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { CompetitionBadge } from '@/components/CompetitionBadge';
import { ScoreBox, TeamCrest, type TeamVM } from '@/components/GameHeader';
import type { Match } from '@/data/schemas';
import { competitionText, toGameHeaderVM } from '@/lib/matchVM';
import { formatKickoffDate, formatTime } from '@/lib/ptDate';
import { SHARE_SHORT_TEXT, shareLink } from '@/lib/shareLink';
import { Body } from '@/theme/typography';
import { colors, layout, radius, spacing, type } from '@/theme/tokens';

export const SHARE_CARD_TEXT = {
  hashtag: '#JogoAJogoLadoALado',
  invite: 'Partilha o teu prognóstico',
} as const;

type Props = { match: Match; home: number; away: number };

function Team({ team, side }: { team: TeamVM; side: 'home' | 'away' }) {
  return (
    <View style={{ width: layout.teamColumnWidth, alignItems: 'center', gap: layout.headerCrestNameGap }}>
      <TeamCrest team={team} testID={`share-crest-${side}`} />
      <Body variant="body" numberOfLines={2} style={{ textAlign: 'center' }}>
        {team.name}
      </Body>
    </View>
  );
}

export const ShareCard = forwardRef<ComponentRef<typeof View>, Props>(function ShareCard({ match, home, away }, ref) {
  const vm = toGameHeaderVM(match);
  const { name, round } = competitionText(match.competition);
  return (
    <View
      ref={ref}
      testID="share-card"
      collapsable={false}
      style={{
        width: layout.shareCardWidth,
        backgroundColor: colors.bg,
        borderRadius: radius.md,
        padding: spacing.lg,
        gap: spacing.md,
        alignItems: 'center',
      }}
    >
      <View style={{ alignItems: 'center' }}>
        <Text testID="share-logo" style={type.shareLogo}>
          <Text style={{ color: colors.primary }}>S</Text>360
        </Text>
        <Text testID="share-title" style={type.shareMatch}>
          MATCH<Text style={type.shareDay}>DAY</Text>
        </Text>
      </View>

      <Body variant="badge" numberOfLines={1}>
        {name}
      </Body>

      <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          <CompetitionBadge label={round} size="sm" />
        </View>
        <Body variant="body" testID="share-kickoff" style={{ opacity: layout.mutedOpacity }}>
          {`${formatKickoffDate(match.kickoff)} ${formatTime(match.kickoff)}`}
        </Body>
        <View style={{ flex: 1 }} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
        <Team team={vm.home} side="home" />
        <View style={{ flexDirection: 'row', gap: layout.scoreBoxGap }}>
          <ScoreBox value={home} testID="share-score-home" />
          <ScoreBox value={away} testID="share-score-away" />
        </View>
        <Team team={vm.away} side="away" />
      </View>

      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        <Body variant="badge">{SHARE_CARD_TEXT.hashtag}</Body>
        <Body variant="body">{SHARE_CARD_TEXT.invite}</Body>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <QRCode
          value={shareLink(match.id)}
          size={layout.shareQr}
          color={colors.bg}
          backgroundColor={colors.white}
          quietZone={layout.shareQrQuietZone}
        />
        <Body variant="body">{SHARE_SHORT_TEXT}</Body>
      </View>
    </View>
  );
});
