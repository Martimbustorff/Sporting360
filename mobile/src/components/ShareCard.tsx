// Figma V7.1: cartão S360 MATCHDAY (4946:8197, 347 pt): degradê do topo ao bg, raio 20, "S360" (S a primary) com "MATCH" em
// DIN Condensed Light e "DAY" em Title L 28, jornada + competição, data absoluta ("21 dezembro · 20:30", Europe/Lisbon, porque
// a imagem dura mais do que a semana do jogo), emblemas (Sporting com o 2026 local) e nomes, caixas brancas do prognóstico,
// "#JogoAJogoLadoALado" e rodapé com "Partilha o teu prognóstico", link curto e QR. Sem fotografias de pessoas.
// A View do cartão vai por ref para a captura (react-native-view-shot); `collapsable={false}` para o Android não a achatar.
// Em ecrãs estreitos o cartão encolhe à vista para caber com `layout.shareCardInset` de cada lado. A escala fica em Views
// por fora do cartão: o cartão capturado não tem transformação e mantém os 347 pt.
import { forwardRef, useState, type ComponentRef, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { TeamCrest, type TeamVM } from '@/components/GameHeader';
import { ValueBox } from '@/components/Stepper';
import type { Match } from '@/data/schemas';
import { formatRound } from '@/lib/formatRound';
import { competitionText, toGameHeaderVM } from '@/lib/matchVM';
import { formatDayMonth, formatTime } from '@/lib/ptDate';
import { SHARE_SHORT_TEXT, shareLink } from '@/lib/shareLink';
import { Text71 } from '@/theme/typography';
import { colors, layout } from '@/theme/tokens';

export const SHARE_CARD_TEXT = {
  hashtag: '#JogoAJogoLadoALado',
  invite: 'Partilha o teu prognóstico',
} as const;

type Props = { match: Match; home: number; away: number; onCardHeight?: (height: number) => void };
type CardProps = Omit<Props, 'onCardHeight'> & { onLayout: (e: LayoutChangeEvent) => void };

function Team({ team, side }: { team: TeamVM; side: 'home' | 'away' }) {
  return (
    <View style={{ width: layout.shareTeamWidth, alignItems: 'center', gap: layout.shareTeamGap }}>
      <TeamCrest team={team} testID={`share-crest-${side}`} size="md" />
      <Text71 variant="label16" numberOfLines={2} style={{ textAlign: 'center' }}>
        {team.name}
      </Text71>
    </View>
  );
}

/** Escala à vista: 1 quando o cartão cabe na janela com `shareCardInset` de cada lado; abaixo disso encolhe. */
export function shareCardScale(windowWidth: number): number {
  return Math.min(1, (windowWidth - 2 * layout.shareCardInset) / layout.shareCardWidth);
}

/**
 * Caixa com o tamanho já escalado e, centrado nela, o frame com a largura do design e a escala (em torno do centro),
 * para o cartão ficar exatamente dentro da caixa. A altura segue a do cartão medida no `onLayout`.
 */
function Fit({ scale, height, children }: { scale: number; height: number | null; children: ReactNode }) {
  const scaled = scale < 1;
  return (
    <View
      testID="share-card-fit"
      style={
        scaled
          ? {
              width: layout.shareCardWidth * scale,
              ...(height !== null ? { height: height * scale } : null),
              alignItems: 'center',
              justifyContent: 'center',
            }
          : undefined
      }
    >
      <View testID="share-card-frame" style={scaled ? { transform: [{ scale }] } : undefined}>
        {children}
      </View>
    </View>
  );
}

export const ShareCard = forwardRef<ComponentRef<typeof View>, Props>(function ShareCard({ onCardHeight, ...props }, ref) {
  const scale = shareCardScale(useWindowDimensions().width);
  const [height, setHeight] = useState<number | null>(null);
  return (
    <Fit scale={scale} height={height}>
      <Card ref={ref} {...props} onLayout={(e) => {
          setHeight(e.nativeEvent.layout.height);
          onCardHeight?.(e.nativeEvent.layout.height);
        }} />
    </Fit>
  );
});

const Card = forwardRef<ComponentRef<typeof View>, CardProps>(function Card({ match, home, away, onLayout }, ref) {
  const vm = toGameHeaderVM(match);
  const { name, round } = competitionText(match.competition);
  const roundText = formatRound(round);
  return (
    <View
      ref={ref}
      testID="share-card"
      collapsable={false}
      onLayout={onLayout}
      style={{
        width: layout.shareCardWidth,
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
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
        <Defs>
          <LinearGradient id="shareCardGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.shareCardTop} />
            <Stop offset="1" stopColor={colors.bg} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#shareCardGrad)" />
      </Svg>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: layout.shareBoxGap }}>
        <Text71 testID="share-logo" variant="brand48">
          <Text71 variant="brand48" color="primary">S</Text71>360
        </Text71>
        <Text71 testID="share-title" variant="titleL28">
          <Text71 variant="matchLight28">MATCH</Text71>DAY
        </Text71>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: layout.shareBoxGap }}>
        {roundText ? (
          <View
            testID="competition-badge"
            style={{
              backgroundColor: colors.primary,
              borderRadius: layout.chipRadius,
              paddingHorizontal: layout.badgeSmallPadX,
              paddingVertical: layout.badgeSmallPadY,
            }}
          >
            <Text71 variant="badge11">{roundText}</Text71>
          </View>
        ) : null}
        <Text71 variant="label16" numberOfLines={1} style={{ flexShrink: 1 }}>
          {name}
        </Text71>
      </View>

      <Text71 variant="caption12" color="textMuted" testID="share-kickoff">
        {`${formatDayMonth(match.kickoff)} \u00B7 ${formatTime(match.kickoff)}`}
      </Text71>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch' }}>
        <Team team={vm.home} side="home" />
        <View style={{ flexDirection: 'row', gap: layout.shareBoxGap }}>
          <ValueBox value={home} testID="share-score-home" size="share" />
          <ValueBox value={away} testID="share-score-away" size="share" />
        </View>
        <Team team={vm.away} side="away" />
      </View>

      <Text71 variant="captionStrong12" color="primaryOnDark">
        {SHARE_CARD_TEXT.hashtag}
      </Text71>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: layout.stepRowGap,
          alignSelf: 'stretch',
          borderTopWidth: layout.separator,
          borderTopColor: colors.shareCardRule,
          paddingTop: layout.shareFooterPadTop,
        }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: layout.gameboxTextGap }}>
          <Text71 variant="captionStrong12" numberOfLines={1}>
            {SHARE_CARD_TEXT.invite}
          </Text71>
          <Text71 variant="badge11" color="textMuted" numberOfLines={1}>
            {SHARE_SHORT_TEXT}
          </Text71>
        </View>
        <View testID="share-qr-box" style={{ backgroundColor: colors.white, padding: layout.shareQrPad }}>
          <QRCode
            value={shareLink(match.id)}
            size={layout.shareQr}
            ecl="L"
            color={colors.bg}
            backgroundColor={colors.white}
            quietZone={0}
          />
        </View>
      </View>
    </View>
  );
});
