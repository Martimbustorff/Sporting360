// Figma V7.1: conjunto "V7.1 / Next match card" 4920:5140 (Próximo 4920:5090, Sem jogo 4920:5112, A carregar 4920:5125,
// Dia de jogo 4932:6358, Ao vivo 4932:6379, Terminado 4932:6400) e frames 01, 01b, 01c, 07a, 07b, 07c da Home.
// Altura fixa de 192 pt em todos os estados (o menu não salta). Estados vêm de lib/homeMatchMoment.
// Canal de TV: chip 4920:5103 por baixo da hora (`match.tv`; sem canal não aparece).
// SEM FIGMA: o estado de erro (nota 01b: "o mesmo cartão com Tentar outra vez"; textos escritos aqui) e a hora de um jogo adiado ou cancelado (mostra o
// estado no lugar da hora, como o GameHeader). O brilho do esqueleto é um pulsar de opacidade (sem gradiente).
import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { TeamCrest, type TeamVM } from '@/components/GameHeader';
import { Touchable } from '@/components/Touchable';
import { TvChip } from '@/components/TvChip';
import type { Match } from '@/data/schemas';
import { useSecondNow } from '@/data/clock';
import { countdownClock, type HomeMoment } from '@/lib/homeMatchMoment';
import { competitionText, minuteText, stateLabel, toGameHeaderVM, uiState } from '@/lib/matchVM';
import { formatCardDate, formatTime } from '@/lib/ptDate';
import { Text71 } from '@/theme/typography';
import { colors, layout, radii, space } from '@/theme/tokens';

/* eslint-disable @typescript-eslint/no-require-imports */
const ICON_CALENDAR = require('../../assets/icons/calendar.svg') as number;
/* eslint-enable @typescript-eslint/no-require-imports */

export const NEXT_MATCH_TEXT = {
  none: 'SEM JOGOS AGENDADOS',
  noneHint: 'A próxima data aparece aqui assim que for marcada.',
  agenda: 'VER AGENDA',
  stripNone: 'PRÓXIMO JOGO',
  errorTitle: 'JOGO INDISPONÍVEL',
  errorHint: 'Não foi possível carregar o jogo.',
  retry: 'TENTAR OUTRA VEZ',
  loading: 'A carregar o próximo jogo',
  live: 'AO VIVO',
  finished: 'TERMINADO',
  endOfGame: 'FIM DO JOGO',
  today: 'HOJE',
} as const;

const ACCESS_LABEL = { next: 'Próximo jogo', matchday: 'Próximo jogo', live: 'Jogo ao vivo', finished: 'Jogo terminado' } as const;

export type NextMatchCardProps = {
  moment: HomeMoment;
  match: Match | null;
  /** Relógio de base (ao minuto). A contagem do "Dia de jogo" anda ao segundo sozinha, em `ticking`. */
  now: Date;
  /** Ecrã visível: só então a contagem tica ao segundo (fora disto fica no relógio de base). */
  ticking?: boolean;
  /** Falha de leitura: o estado "sem jogo" com "Tentar outra vez". */
  error?: boolean;
  onOpenMatch: (id: string) => void;
  onAction: (href: string) => void;
  onOpenAgenda: () => void;
  onRetry?: () => void;
};

function Shimmer({ style }: { style: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const v = useSharedValue(1);
  useEffect(() => {
    if (reduced) {
      v.set(1);
      return;
    }
    v.set(withRepeat(withTiming(layout.shimmerMin, { duration: layout.shimmerMs }), -1, true));
  }, [reduced, v]);
  const animated = useAnimatedStyle(() => ({ opacity: v.get() }));
  return <Animated.View style={[{ backgroundColor: colors.surface20 }, style, animated]} />;
}

const bar = (w: number, h: number, r: number): ViewStyle => ({ width: w, height: h, borderRadius: r });

function Loading() {
  const team = (
    <View style={styles.team}>
      <Shimmer style={bar(layout.crestCard.width, layout.crestCard.width, layout.crestCard.width / 2)} />
      <Shimmer style={bar(64, 10, 5)} />
    </View>
  );
  return (
    <View testID="next-match-loading" accessible accessibilityLabel={NEXT_MATCH_TEXT.loading} accessibilityState={{ busy: true }} style={styles.fill}>
      <View style={styles.strip}>
        <Shimmer style={bar(112, 10, 5)} />
        <Shimmer style={bar(72, 16, 8)} />
      </View>
      <View style={styles.body}>
        {team}
        <View style={[styles.center, { gap: space.s8 }]}>
          <Shimmer style={bar(56, 8, 4)} />
          <Shimmer style={bar(layout.matchCardCenterMin, 32, 6)} />
          <Shimmer style={bar(72, 20, 10)} />
        </View>
        {team}
      </View>
    </View>
  );
}

function Message({
  title,
  hint,
  actionLabel,
  withArrow,
  onAction,
}: {
  title: string;
  hint: string;
  actionLabel: string;
  withArrow: boolean;
  onAction: () => void;
}) {
  return (
    <View style={styles.fill}>
      <View style={styles.strip}>
        <Text71 variant="label16" numberOfLines={1}>{NEXT_MATCH_TEXT.stripNone}</Text71>
      </View>
      <View style={[styles.body, { justifyContent: 'center' }]}>
        <View style={{ alignItems: 'center', gap: space.s8, flexShrink: 1 }}>
          <Image source={ICON_CALENDAR} accessible={false} style={{ width: layout.matchCardIcon, height: layout.matchCardIcon, opacity: layout.matchCardIconOpacity }} />
          <Text71 variant="titleS20" numberOfLines={2} style={{ textAlign: 'center' }}>{title}</Text71>
          <Text71 variant="caption12" color="textMuted" numberOfLines={2} style={{ textAlign: 'center' }}>{hint}</Text71>
          <Touchable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} style={styles.link}>
            <Text71 variant="eyebrow13" color="primaryOnDark">{actionLabel}</Text71>
            {withArrow ? <Feather name="arrow-right" size={16} color={colors.primaryOnDark} /> : null}
          </Touchable>
        </View>
      </View>
    </View>
  );
}

function Chip({ label, tone, onPress }: { label: string; tone: 'primary' | 'subtle'; onPress: () => void }) {
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: tone === 'primary' ? colors.primary : colors.surface10 }]}
    >
      <Text71 variant="badge11" numberOfLines={1}>{label}</Text71>
    </Touchable>
  );
}

/** Contagem ao segundo isolada: só esta folha volta a desenhar-se a cada segundo, não a Home. */
function Countdown({ to, base, ticking }: { to: Date; base: Date; ticking: boolean }) {
  // O trinco de "a correr" é por alvo: ao mudar `to` (adiado, outro jogo) a contagem volta a correr sem mais um render.
  const target = to.getTime();
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);
  const running = stoppedAt !== target;
  const now = useSecondNow(ticking && running, base);
  const left = target - now.getTime();
  useEffect(() => {
    if (left <= 0) setStoppedAt(target);
  }, [left, target]);
  return (
    <Text71
      variant="countdown32"
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={layout.matchCardCountdownMinScale}
      testID="next-countdown"
    >
      {countdownClock(running ? left : 0)}
    </Text71>
  );
}

function scoreLine(m: Match): string {
  return `${m.score.home ?? 0} - ${m.score.away ?? 0}`;
}

function Teams({ vm, wide, children }: { vm: ReturnType<typeof toGameHeaderVM>; wide?: boolean; children: ReactNode }) {
  const team = (t: TeamVM, side: 'home' | 'away') => (
    <View style={styles.team}>
      <TeamCrest team={t} size="md" testID={`next-crest-${side}`} />
      <Text71 variant="strong14" numberOfLines={1} style={{ textAlign: 'center', alignSelf: 'stretch' }}>{t.name}</Text71>
    </View>
  );
  return (
    <>
      {team(vm.home, 'home')}
      <View style={[styles.center, wide ? { flexGrow: layout.matchCardCenterWideGrow } : null]}>{children}</View>
      {team(vm.away, 'away')}
    </>
  );
}

export function NextMatchCard({ moment, match, now, ticking = false, error = false, onOpenMatch, onAction, onOpenAgenda, onRetry }: NextMatchCardProps) {
  const { state, action } = moment;
  let content: ReactNode;
  let summary = '';

  if (state === 'loading') {
    content = <Loading />;
  } else if (!match || state === 'none') {
    content = error ? (
      <Message title={NEXT_MATCH_TEXT.errorTitle} hint={NEXT_MATCH_TEXT.errorHint} actionLabel={NEXT_MATCH_TEXT.retry} withArrow={false} onAction={onRetry ?? (() => {})} />
    ) : (
      <Message title={NEXT_MATCH_TEXT.none} hint={NEXT_MATCH_TEXT.noneHint} actionLabel={NEXT_MATCH_TEXT.agenda} withArrow onAction={onOpenAgenda} />
    );
  } else {
    const vm = toGameHeaderVM(match);
    const comp = competitionText(match.competition);
    const ui = uiState(match.status);
    const off = ui === 'postponed' || ui === 'cancelled';
    const badge =
      state === 'live' ? NEXT_MATCH_TEXT.live : state === 'finished' ? NEXT_MATCH_TEXT.finished : comp.round;
    const kick = formatTime(match.kickoff);
    const names = `${vm.home.name} contra ${vm.away.name}`;
    summary =
      state === 'live'
        ? `${names}, ao vivo, ${scoreLine(match)}`
        : state === 'finished'
          ? `${names}, terminado, ${scoreLine(match)}`
          : state === 'matchday'
            ? `${names}, hoje às ${kick}`
            : off
              ? `${names}, ${stateLabel(ui).toLowerCase()}`
              : `${names}, ${formatCardDate(match.kickoff)} às ${kick}`;
    let eyebrow: string;
    let eyebrowColor: 'textMuted' | 'primaryOnDark' = 'textMuted';
    let main: ReactNode;
    if (state === 'live') {
      eyebrow = ui === 'halftime' ? stateLabel('halftime') : minuteText(match.elapsed, match.elapsedExtra);
      eyebrowColor = 'primaryOnDark';
      main = <Text71 variant="display40" numberOfLines={1} testID="next-score">{scoreLine(match)}</Text71>;
    } else if (state === 'finished') {
      eyebrow = NEXT_MATCH_TEXT.endOfGame;
      main = <Text71 variant="display40" numberOfLines={1} testID="next-score">{scoreLine(match)}</Text71>;
    } else if (state === 'matchday') {
      eyebrow = `${NEXT_MATCH_TEXT.today} · ${kick}`;
      main = <Countdown to={moment.countdownTo ?? match.kickoff} base={now} ticking={ticking} />;
    } else {
      eyebrow = formatCardDate(match.kickoff);
      main = off ? (
        <Text71 variant="titleS20" numberOfLines={1} testID="next-time">{stateLabel(ui).toUpperCase()}</Text71>
      ) : (
        <Text71 variant="display40" numberOfLines={1} testID="next-time">{kick}</Text71>
      );
    }
    content = (
      <View style={styles.fill} pointerEvents="box-none">
        <View style={styles.strip} pointerEvents="none">
          <Text71 variant="label16" numberOfLines={1} style={{ flexShrink: 1 }}>{comp.name}</Text71>
          {badge ? (
            <View style={styles.badge}>
              <Text71 variant="badge11" numberOfLines={1}>{badge}</Text71>
            </View>
          ) : null}
        </View>
        <View style={styles.body} pointerEvents="box-none">
          <Teams vm={vm} wide={state === 'matchday'}>
            <Text71 variant="eyebrow13" color={eyebrowColor} numberOfLines={1}>{eyebrow}</Text71>
            {main}
            {state === 'next' && !action ? <TvChip tv={match.tv} testID="next-tv" /> : null}
            {action ? (
              <Chip
                label={action.label}
                tone={action.label === 'VER JOGO' ? 'subtle' : 'primary'}
                onPress={() => onAction(action.href)}
              />
            ) : null}
          </Teams>
        </View>
      </View>
    );
  }

  const tappable = match && state !== 'loading' && state !== 'none';
  return (
    <View testID="next-match-card" style={styles.shadow}>
      <View style={styles.card}>
        {tappable ? (
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={`${ACCESS_LABEL[state as keyof typeof ACCESS_LABEL]}: ${summary}`}
            onPress={() => onOpenMatch(match.id)}
            feedback="none"
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        {content}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { height: layout.matchCardHeight, borderRadius: radii.r12, backgroundColor: colors.bg, ...layout.matchCardShadow },
  card: {
    flex: 1,
    borderRadius: radii.r12,
    borderWidth: layout.matchCardBorder,
    borderColor: colors.white,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  fill: { flex: 1 },
  strip: {
    height: layout.matchCardStrip,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s8,
    paddingLeft: space.s16,
    paddingRight: space.s12,
    backgroundColor: colors.surface10,
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: radii.r12,
    paddingHorizontal: space.s8,
    paddingVertical: layout.matchCardBadgePadY,
    flexShrink: 0,
  },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.s8 },
  team: { flexGrow: 1, flexBasis: 0, maxWidth: layout.matchCardTeamMax, alignItems: 'center', gap: space.s8 },
  center: { flexGrow: 1, flexBasis: 0, minWidth: layout.matchCardCenterMin, alignItems: 'center', gap: space.s4 },
  chip: { borderRadius: radii.r28, paddingHorizontal: space.s12, paddingVertical: space.s4, alignItems: 'center' },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.s4, paddingTop: space.s4 },
});
