// Figma V7.1 4924:6399 "Linha do tempo (0 a 90)": pista de 4 pt (surface-20), progresso até ao minuto, marca do intervalo
// aos 45, golos do Sporting em cima e do adversário em baixo (pontos de 8), "agora" de 12 e rótulos 0', INT., 90'.
// O progresso do Figma é um degradé primary a primary-on-dark; aqui é primary liso (sem biblioteca de degradés).
import { View, type DimensionValue } from 'react-native';
import type { GoalVM } from '@/lib/matchVM';
import { Text71 } from '@/theme/typography';
import { colors, layout } from '@/theme/tokens';

const LABEL_W = layout.timelineLabelWidth;
const pct = (minute: number): DimensionValue => `${Math.min(Math.max(minute, 0), 90) / 0.9}%`;

export function MatchTimeline({
  goals,
  minute,
  live,
  sportingSide,
}: {
  goals: GoalVM[];
  minute: number;
  live: boolean;
  sportingSide: 'home' | 'away';
}) {
  const track = layout.timelineTrack;
  const trackTop = layout.timelineTrackTop;
  return (
    <View testID="match-timeline" style={{ alignSelf: 'stretch', height: layout.timelineHeight, marginHorizontal: layout.timelineMargin }}>
      <View
        style={{ position: 'absolute', left: 0, right: 0, top: trackTop, height: track, borderRadius: track / 2, backgroundColor: colors.surface20 }}
      />
      <View
        testID="timeline-progress"
        style={{ position: 'absolute', left: 0, width: pct(minute), top: trackTop, height: track, borderRadius: track / 2, backgroundColor: colors.primary }}
      />
      <View
        style={{
          position: 'absolute',
          left: '50%',
          marginLeft: -layout.timelineHalfMarkWidth / 2,
          top: trackTop + track / 2 - layout.timelineHalfMarkHeight / 2,
          width: layout.timelineHalfMarkWidth,
          height: layout.timelineHalfMarkHeight,
          backgroundColor: colors.white,
          opacity: layout.timelineHalfMarkOpacity,
        }}
      />
      {goals.map((g, i) => {
        const mine = g.side === sportingSide;
        return (
          <View
            key={`${g.side}-${g.minute}-${i}`}
            testID={mine ? 'timeline-goal-top' : 'timeline-goal-bottom'}
            style={{
              position: 'absolute',
              left: pct(g.minute),
              marginLeft: -layout.timelineGoalDot / 2,
              top: mine ? trackTop - layout.timelineGoalDot - layout.timelineDotGap : trackTop + track + layout.timelineDotGap,
              width: layout.timelineGoalDot,
              height: layout.timelineGoalDot,
              borderRadius: layout.timelineGoalDot / 2,
              backgroundColor: mine ? colors.primaryOnDark : colors.white,
            }}
          />
        );
      })}
      {live ? (
        <View
          testID="timeline-now"
          style={{
            position: 'absolute',
            left: pct(minute),
            marginLeft: -layout.timelineNowDot / 2,
            top: trackTop + track / 2 - layout.timelineNowDot / 2,
            width: layout.timelineNowDot,
            height: layout.timelineNowDot,
            borderRadius: layout.timelineNowDot / 2,
            backgroundColor: colors.white,
            shadowColor: colors.primaryOnDark,
            shadowOpacity: 1,
            shadowRadius: layout.timelineNowGlow,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
      ) : null}
      <View style={{ position: 'absolute', left: 0, right: 0, top: layout.timelineLabelTop, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text71 variant="caption12" color="textSubtle">0’</Text71>
        <Text71 variant="caption12" color="textSubtle" style={{ position: 'absolute', left: '50%', marginLeft: -LABEL_W / 2, width: LABEL_W, textAlign: 'center' }}>
          INT.
        </Text71>
        <Text71 variant="caption12" color="textSubtle">90’</Text71>
      </View>
    </View>
  );
}
