// Figma V7.1: cartão S360 MATCHDAY (4946:8197, 347 pt): degradê do topo ao bg, raio 20, "S360" (S a primary) com "MATCH" em
// DIN Condensed Light e "DAY" em Title L 28, jornada + competição, data absoluta ("21 dezembro · 20:30", Europe/Lisbon, porque
// a imagem dura mais do que a semana do jogo), emblemas (Sporting com o 2026 local) e nomes, caixas brancas do prognóstico,
// "#JogoAJogoLadoALado" e rodapé com "Partilha o teu prognóstico", link curto e QR. Sem fotografias de pessoas.
// O layout comum (degradê, competição, data, emblemas) está em MatchCard, partilhado com o empréstimo de GameBox.
// A View do cartão vai por ref para a captura (react-native-view-shot); `collapsable={false}` para o Android não a achatar.
// Em ecrãs estreitos o cartão encolhe à vista para caber com `layout.shareCardInset` de cada lado. A escala fica em Views
// por fora do cartão: o cartão capturado não tem transformação e mantém os 347 pt.
import { forwardRef, useState, type ComponentRef, type ReactNode } from 'react';
import { useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { MatchCard } from '@/components/MatchCard';
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
  return (
    <MatchCard
      ref={ref}
      testID="share-card"
      width={layout.shareCardWidth}
      onLayout={onLayout}
      home={vm.home}
      away={vm.away}
      competition={name}
      round={formatRound(round) || null}
      kickoff={`${formatDayMonth(match.kickoff)} \u00B7 ${formatTime(match.kickoff)}`}
      kickoffTestID="share-kickoff"
      crestTestIDPrefix="share-crest"
      header={
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: layout.shareBoxGap }}>
          <Text71 testID="share-logo" variant="brand48">
            <Text71 variant="brand48" color="primary">S</Text71>360
          </Text71>
          <Text71 testID="share-title" variant="titleL28">
            <Text71 variant="matchLight28">MATCH</Text71>DAY
          </Text71>
        </View>
      }
      center={
        <View style={{ flexDirection: 'row', gap: layout.shareBoxGap }}>
          <ValueBox value={home} testID="share-score-home" size="share" />
          <ValueBox value={away} testID="share-score-away" size="share" />
        </View>
      }
    >
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
    </MatchCard>
  );
});
