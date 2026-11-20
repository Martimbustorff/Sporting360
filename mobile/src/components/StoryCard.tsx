// A minha história do jogo (Plano 10, Figma 54 · 5049:18769, Martim 20/11 23:10): 9:16, desenhado a 360x640 e capturado a
// 3x (1080x1920). Foto de adeptos em fundo inteiro (gerada por IA, sem emblemas nem caras reconhecíveis) com véu verde e,
// tudo centrado: S360 MATCHDAY, competição com a jornada, data com "FINAL", emblemas e resultado nas caixas brancas,
// O MEU PROGNÓSTICO, a pílula dos pontos, O MEU MVP (só se votou), a hashtag e o rodapé com o QR. Sem legendas.
// Só para quem fez prognóstico. A View vai por ref para a captura; `collapsable={false}` para o Android não a achatar.
import { Image } from 'expo-image';
import { forwardRef, useId, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { TeamCrest } from '@/components/GameHeader';
import { SHARE_CARD_TEXT } from '@/components/ShareCard';
import { ValueBox } from '@/components/Stepper';
import type { Match } from '@/data/schemas';
import { formatRound } from '@/lib/formatRound';
import { competitionText, toGameHeaderVM } from '@/lib/matchVM';
import { formatDayMonth, formatTime } from '@/lib/ptDate';
import { shareLink } from '@/lib/shareLink';
import { Text71 } from '@/theme/typography';
import { colors, layout, space } from '@/theme/tokens';

const FANS = require('../../assets/images/story-fans.jpg') as number;

export const STORY_TEXT = {
  final: 'Final',
  pick: 'O meu prognóstico',
  mvp: 'O meu MVP',
  invite: 'Joga também na app S360',
  points: 'pts',
} as const;

/** Véu do Figma (5049:18770): bg a 55 % no topo, 25 % a 35 %, 85 % a 60 % e opaco em baixo. */
const VEIL = [
  [0, 0.55],
  [0.35, 0.25],
  [0.6, 0.85],
  [1, 1],
] as const;

function Veil() {
  const id = `storyVeil${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            {VEIL.map(([o, a]) => (
              <Stop key={o} offset={String(o)} stopColor={colors.bg} stopOpacity={a} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

type Props = {
  match: Match;
  pick: { home: number; away: number };
  points: number | null;
  mvpName: string | null;
};

export const StoryCard = forwardRef<ComponentRef<typeof View>, Props>(function StoryCard({ match, pick, points, mvpName }, ref) {
  const vm = toGameHeaderVM(match);
  const { name, round } = competitionText(match.competition);
  const badge = formatRound(round);
  return (
    <View
      ref={ref}
      testID="story-card"
      collapsable={false}
      style={{
        width: layout.storyCard.width,
        height: layout.storyCard.height,
        backgroundColor: colors.bg,
        overflow: 'hidden',
        alignItems: 'center',
        paddingVertical: layout.storyPad,
      }}
    >
      <Image source={FANS} contentFit="cover" accessible={false} style={StyleSheet.absoluteFill} />
      <Veil />

      <View style={{ alignItems: 'center' }}>
        <Text71 variant="brand48">
          <Text71 variant="brand48" color="primary">S</Text71>360
        </Text71>
        <Text71 variant="titleL28">
          <Text71 variant="matchLight28">MATCH</Text71>DAY
        </Text71>
      </View>

      <View style={{ alignItems: 'center', gap: space.s8, marginTop: space.s24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s8 }}>
          <Text71 variant="label16">{name}</Text71>
          {badge ? (
            <View
              style={{
                backgroundColor: colors.white,
                borderRadius: layout.shareBoxRadius,
                paddingHorizontal: layout.storyBadgePadX,
                paddingVertical: layout.storyBadgePadY,
              }}
            >
              <Text71 variant="eyebrow13" color="ink">{badge}</Text71>
            </View>
          ) : null}
        </View>
        <Text71 variant="caption12" color="textMuted" testID="story-date">
          {`${formatDayMonth(match.kickoff)} · ${formatTime(match.kickoff)} · ${STORY_TEXT.final}`}
        </Text71>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s24, marginTop: space.s24 }}>
        <TeamCrest team={vm.home} size="md" testID="story-crest-home" />
        <View style={{ flexDirection: 'row', gap: layout.storyBoxGap }}>
          <ValueBox value={match.score.home ?? 0} testID="story-score-home" size="story" />
          <ValueBox value={match.score.away ?? 0} testID="story-score-away" size="story" />
        </View>
        <TeamCrest team={vm.away} size="md" testID="story-crest-away" />
      </View>

      <View style={{ alignItems: 'center', marginTop: space.s32 }}>
        <Text71 variant="eyebrow13" color="textMuted">{STORY_TEXT.pick}</Text71>
        <Text71 variant="score56" testID="story-pick">{`${pick.home} - ${pick.away}`}</Text71>
        {points != null ? (
          <View
            testID="story-points"
            style={{
              marginTop: space.s12,
              backgroundColor: colors.primary,
              borderRadius: layout.storyPillRadius,
              paddingHorizontal: layout.storyPillPadX,
              paddingVertical: layout.storyPillPadY,
            }}
          >
            <Text71 variant="label16">{`+${points} ${STORY_TEXT.points}`}</Text71>
          </View>
        ) : null}
      </View>

      {mvpName ? (
        <View style={{ alignItems: 'center', marginTop: space.s32 }}>
          <Text71 variant="eyebrow13" color="textMuted">{STORY_TEXT.mvp}</Text71>
          <Text71 variant="display40" testID="story-mvp" numberOfLines={1}>{mvpName}</Text71>
        </View>
      ) : null}

      <View style={{ flex: 1 }} />
      <Text71 variant="captionStrong12" color="primaryOnDark">{SHARE_CARD_TEXT.hashtag}</Text71>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s12, marginTop: space.s16 }}>
        <Text71 variant="captionStrong12">{STORY_TEXT.invite}</Text71>
        <View style={{ backgroundColor: colors.white, padding: layout.storyQrPad }}>
          <QRCode value={shareLink(match.id)} size={layout.storyQr} ecl="L" color={colors.bg} backgroundColor={colors.white} quietZone={0} />
        </View>
      </View>
    </View>
  );
});
