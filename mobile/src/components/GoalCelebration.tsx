// Celebração do golo (Plano 10, Figma 55 · 5048:18762). Martim 20/11: futebol, só golos do Sporting, só com a app
// aberta (não é notificação), com som. Ecrã verde a 94 % com os anéis da marca, "GOLO!" a 120, marcador e minuto e o
// resultado; 2 s, vibração tripla; um toque fecha antes. Montado uma vez no layout com sessão, por cima de todos os
// ecrãs. Ao ir para segundo plano esquece o resultado visto: ao voltar, golos que já passaram não celebram.
// O rugido (Freesound 437980, CC0) entra quando o ficheiro estiver no projeto.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { BrandRings } from '@/components/BrandRings';
import { useNow } from '@/data/clock';
import type { Match } from '@/data/schemas';
import { useHomeMatches, useMatchDetail } from '@/data/sports';
import { CELEBRATION_MS, celebrationScorer, nextGoalWatch, type GoalWatch } from '@/lib/goalCelebration';
import { haptic } from '@/lib/haptics';
import { pickHomeMatch } from '@/lib/homeMatchMoment';
import { MOTION } from '@/lib/motion';
import { Text71 } from '@/theme/typography';
import { colors, layout, space } from '@/theme/tokens';

const GOAL = 'Golo!';

function resultLine(m: Match): string {
  return `${m.home.name} ${m.score.home ?? 0} - ${m.score.away ?? 0} ${m.away.name}`;
}

function Overlay({ match, onClose }: { match: Match; onClose: () => void }) {
  const events = useMatchDetail(match.id, 'events');
  const scorer = events.status === 'ready' ? celebrationScorer(match, events.data.items) : null;
  return (
    <Animated.View
      testID="goal-celebration"
      entering={FadeIn.duration(MOTION.fast)}
      exiting={FadeOut.duration(MOTION.fast)}
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.goalOverlay, zIndex: 100 }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fechar"
        onPress={onClose}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
      >
        <BrandRings opacity={layout.goalRingsOpacity} />
        <View style={{ alignItems: 'center', gap: space.s4 }}>
          <Text71 variant="goal120" accessibilityRole="header">
            {GOAL}
          </Text71>
          {scorer ? <Text71 variant="label16">{scorer}</Text71> : null}
          <Text71 variant="caption12">{resultLine(match)}</Text71>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function GoalCelebration() {
  const minute = useNow(60_000);
  const matches = useHomeMatches(minute);
  const match = useMemo(() => (matches.status === 'ready' ? pickHomeMatch(matches.data, minute) : null), [matches, minute]);
  const watch = useRef<GoalWatch>(null);
  const [showing, setShowing] = useState<Match | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') watch.current = null;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (matches.status !== 'ready') return;
    const { watch: next, goal } = nextGoalWatch(watch.current, match);
    watch.current = next;
    if (!goal || !match) return;
    setShowing(match);
    haptic.goal();
    AccessibilityInfo.announceForAccessibility(`Golo do Sporting. ${resultLine(match)}`);
  }, [match, matches.status]);

  useEffect(() => {
    if (!showing) return;
    const t = setTimeout(() => setShowing(null), CELEBRATION_MS);
    return () => clearTimeout(t);
  }, [showing]);

  return showing ? <Overlay match={showing} onClose={() => setShowing(null)} /> : null;
}
