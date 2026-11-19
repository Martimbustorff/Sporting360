// Figma V7.1 4924:6410 "O teu prognóstico": cartão de 64 pt (surface-06, contorno surface-10, raio 12), eyebrow a
// text-subtle, palpite Title S 20 e, à direita, os pontos em primary. Só se desenha quando o utilizador tem prognóstico.
// Os pontos vêm dos eventos do servidor (`lib/predictionPoints`); sem eles (jogo ainda por liquidar) não há selo.
import { View } from 'react-native';
import { Text71 } from '@/theme/typography';
import { colors, layout, radii, space } from '@/theme/tokens';

export type PredictionVM = {
  home: number;
  away: number;
  points: number | null;
  /** Ao vivo: linha com o tipo de acerto provisório (só quando os pontos são provisórios). */
  note?: string | null;
};

export const PREDICTION_SUMMARY_TEXT = { title: 'O teu prognóstico', points: 'PTS' } as const;

export function PredictionSummary({ prediction }: { prediction: PredictionVM }) {
  const { home, away, points, note } = prediction;
  const pick = `${home}-${away}`;
  return (
    <View
      testID="prediction-summary"
      accessible
      accessibilityLabel={`${PREDICTION_SUMMARY_TEXT.title}: ${pick}${points != null ? `, ${points} ${points === 1 ? 'ponto' : 'pontos'}` : ''}${note ? `, ${note}` : ''}`}
      style={{
        alignSelf: 'stretch',
        marginHorizontal: layout.predictionMargin,
        minHeight: layout.predictionCardHeight,
        paddingVertical: layout.predictionNoteGap,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: layout.predictionGap,
        backgroundColor: colors.surface06,
        borderWidth: layout.separator,
        borderColor: colors.surface10,
        borderRadius: radii.r12,
        paddingLeft: space.s16,
        paddingRight: space.s12,
      }}
    >
      <View style={{ flexShrink: 1, gap: layout.headerScorersGap }}>
        <Text71 variant="eyebrow13" color="textSubtle" numberOfLines={1}>{PREDICTION_SUMMARY_TEXT.title}</Text71>
        <Text71 variant="titleS20" numberOfLines={1} testID="prediction-pick">{pick}</Text71>
        {note ? <Text71 variant="body14" color="textMuted" testID="prediction-note">{note}</Text71> : null}
      </View>
      {points != null ? (
        <View
          testID="prediction-points"
          style={{
            backgroundColor: colors.primary,
            borderRadius: radii.r8,
            paddingHorizontal: layout.predictionPointsPadX,
            paddingVertical: layout.predictionPointsPadY,
          }}
        >
          <Text71 variant="label16" numberOfLines={1}>{`+${points} ${PREDICTION_SUMMARY_TEXT.points}`}</Text71>
        </View>
      ) : null}
    </View>
  );
}
