// Figma V7.1: conjunto "V7.1 / Next match card" 4920:5140 (Próximo 4920:5090, Sem jogo 4920:5112, A carregar 4920:5125,
// Dia de jogo 4932:6358, Ao vivo 4932:6379, Terminado 4932:6400) e frames 01, 01b, 01c, 07a, 07b, 07c da Home.
// Revisto a 20/11 (2.ª volta, Martim): o cartão segue o cabeçalho do jogo, com o círculo de luz e os anéis atrás, os
// títulos pela regra de toda a app (competição, jornada/fase, pílula do momento, data: `MatchTitles`), emblemas 60x70
// com nomes em maiúsculas, a hora em destaque e uma linha de baixo com altura fixa (TV ou ação).
// Altura fixa (`matchCardHeight`) em todos os estados (o menu e o Calendário não saltam). Estados vêm de lib/homeMatchMoment.
// Canal de TV: chip 4920:5103 por baixo da hora (`match.tv`; sem canal não aparece).
// SEM FIGMA: o estado de erro (nota 01b: "o mesmo cartão com Tentar outra vez"; textos escritos aqui) e a hora de um jogo adiado ou cancelado (mostra o
// estado no lugar da hora, como o GameHeader). O brilho do esqueleto é um pulsar de opacidade (sem gradiente).
import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Appear } from '@/components/Appear';
import { MatchTitles, MomentChip, TeamCrest } from '@/components/GameHeader';
import { Touchable } from '@/components/Touchable';
import { TvChip } from '@/components/TvChip';
import type { Match } from '@/data/schemas';
import { useSecondNow } from '@/data/clock';
import { countdownClock, type HomeMoment } from '@/lib/homeMatchMoment';
import { competitionText, minuteText, stateLabel, toGameHeaderVM, uiState } from '@/lib/matchVM';
import { formatCardDate, formatTime } from '@/lib/ptDate';
import { Text71 } from '@/theme/typography';
import { colors, layout, radii, space } from '@/theme/tokens';

const ICON_CALENDAR = require('../../assets/icons/calendar.svg') as number;

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
  next: 'PRÓXIMO JOGO',
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
  /** No próprio Calendário o "Ver agenda" não leva a lado nenhum: fica só o aviso. */
  hideAgendaLink?: boolean;
  /**
   * 20/11 (Martim): na Home o cartão encolhe (200 em vez de 300) para os Sites do Clube caberem acima da GameBox.
   * Mesma ordem de títulos (mais juntos), emblemas 52x60, hora a 56; o canal de TV ou a ação passam para baixo da hora;
   * ao vivo o minuto fica a 20 e não há "Ver jogo" (o cartão inteiro já abre o jogo).
   */
  compact?: boolean;
  /** 21/11 (Martim): no Calendário o cartão não tem ações (nem "Prognóstico"): o cartão inteiro abre o jogo. */
  plain?: boolean;
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
      <Shimmer style={bar(layout.crestNext.width, layout.crestNext.width, layout.crestNext.width / 2)} />
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
  actionLabel: string | null;
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
          {actionLabel ? (
            <Touchable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} style={styles.link}>
              <Text71 variant="eyebrow13" color="primaryOnDark">{actionLabel}</Text71>
              {withArrow ? <Feather name="arrow-right" size={16} color={colors.primaryOnDark} /> : null}
            </Touchable>
          ) : null}
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
      variant="countdown40"
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={layout.matchCardCountdownMinScale}
      style={styles.big}
      testID="next-countdown"
    >
      {countdownClock(running ? left : 0)}
    </Text71>
  );
}

function scoreLine(m: Match): string {
  return `${m.score.home ?? 0} - ${m.score.away ?? 0}`;
}

/**
 * Degradê do cartão (MatchCard): verde em cima, fundo da app em baixo, com transparência (20/11, Martim: ver o leão e a
 * forma geométrica da Home por trás do cartão; o cartão não tem círculo próprio).
 */
function CardGradient() {
  const id = `nextGrad${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View testID="next-match-bg" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.shareCardTop} stopOpacity={layout.matchCardGradientOpacity} />
            <Stop offset="1" stopColor={colors.bg} stopOpacity={layout.matchCardGradientOpacity} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

export function NextMatchCard({ moment, match, now, ticking = false, error = false, onOpenMatch, onAction, onOpenAgenda, onRetry, hideAgendaLink = false, compact = false, plain = false }: NextMatchCardProps) {
  const { state, action } = moment;
  let content: ReactNode;
  let summary = '';

  if (state === 'loading') {
    content = <Loading />;
  } else if (!match || state === 'none') {
    content = error ? (
      <Message title={NEXT_MATCH_TEXT.errorTitle} hint={NEXT_MATCH_TEXT.errorHint} actionLabel={NEXT_MATCH_TEXT.retry} withArrow={false} onAction={onRetry ?? (() => {})} />
    ) : (
      <Message title={NEXT_MATCH_TEXT.none} hint={NEXT_MATCH_TEXT.noneHint} actionLabel={hideAgendaLink ? null : NEXT_MATCH_TEXT.agenda} withArrow onAction={onOpenAgenda} />
    );
  } else {
    const vm = toGameHeaderVM(match);
    const comp = competitionText(match.competition);
    const ui = uiState(match.status);
    const off = ui === 'postponed' || ui === 'cancelled';
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
    // 21/11 (Martim): simétrico. Títulos (competição, jornada, data; no dia de jogo "HOJE · 18:00" no lugar da data),
    // uma linha de emblemas com a hora, a contagem ou o resultado ao centro, e uma linha de nomes com o canal de TV, o
    // minuto ou a ação ao centro. Sem a pílula "Próximo jogo" (o cartão em destaque já é o próximo jogo); "Ao vivo" e
    // "Terminado" ficam. No Calendário (`plain`) não há ações: o cartão inteiro abre o jogo.
    let main: ReactNode;
    let minute: ReactNode = null;
    if (state === 'live') {
      main = <Text71 variant={compact ? 'score56' : 'score72'} numberOfLines={1} adjustsFontSizeToFit style={styles.big} testID="next-score">{scoreLine(match)}</Text71>;
      minute = (
        <Text71 variant={compact ? 'titleS20' : 'title24'} color="primaryOnDark" numberOfLines={1}>
          {ui === 'halftime' ? stateLabel('halftime') : minuteText(match.elapsed, match.elapsedExtra)}
        </Text71>
      );
    } else if (state === 'finished') {
      main = <Text71 variant={compact ? 'score56' : 'score72'} numberOfLines={1} adjustsFontSizeToFit style={styles.big} testID="next-score">{scoreLine(match)}</Text71>;
    } else if (state === 'matchday') {
      main = <Countdown to={moment.countdownTo ?? match.kickoff} base={now} ticking={ticking} />;
    } else {
      main = off ? (
        <Text71 variant="titleS20" numberOfLines={1} testID="next-time">{stateLabel(ui).toUpperCase()}</Text71>
      ) : (
        <Text71 variant={compact ? 'score56' : 'score72'} numberOfLines={1} adjustsFontSizeToFit style={styles.big} testID="next-time">{kick}</Text71>
      );
    }
    const showAction = !plain && action && state !== 'live';
    const slot = minute ?? (showAction ? (
      <Chip label={action.label} tone={action.label === 'VER JOGO' ? 'subtle' : 'primary'} onPress={() => onAction(action.href)} />
    ) : state === 'next' || state === 'matchday' ? (
      <TvChip tv={match.tv} testID="next-tv" />
    ) : null);
    const pill = state === 'live' ? <MomentChip text={NEXT_MATCH_TEXT.live} live /> : state === 'finished' ? <MomentChip text={NEXT_MATCH_TEXT.finished} /> : null;
    const crest = compact ? 'md' : 'hd';
    const crestBox = compact ? layout.crestCard : layout.crestHeader;
    const centerW = compact ? layout.matchCardCenterCompact : layout.matchCardCenter;
    content = (
      <View style={[styles.fill, compact && styles.fillCompact]} pointerEvents="box-none">
        <View pointerEvents="none">
          <MatchTitles
            competitionName={comp.name}
            round={comp.round}
            pill={pill}
            date={state === 'matchday' ? `${NEXT_MATCH_TEXT.today} · ${kick}` : formatCardDate(match.kickoff)}
            tight={compact}
          />
        </View>
        <View style={[styles.row, { marginTop: compact ? space.s12 : space.s16 }]} pointerEvents="box-none">
          <View style={styles.side} pointerEvents="none">
            <TeamCrest team={vm.home} testID="crest-home" size={crest} />
          </View>
          <View style={[styles.mid, { width: centerW, height: crestBox.height }]} pointerEvents="none">
            {main}
          </View>
          <View style={styles.side} pointerEvents="none">
            <TeamCrest team={vm.away} testID="crest-away" size={crest} />
          </View>
        </View>
        <View style={[styles.row, styles.names]} pointerEvents="box-none">
          <Text71 variant={compact ? 'strong14' : 'label16'} numberOfLines={1} style={styles.name}>{vm.home.name}</Text71>
          <View style={[styles.mid, { width: centerW, minHeight: layout.matchCardSlot }]} pointerEvents="box-none">
            {slot}
          </View>
          <Text71 variant={compact ? 'strong14' : 'label16'} numberOfLines={1} style={styles.name}>{vm.away.name}</Text71>
        </View>
      </View>
    );
  }

  const tappable = match && state !== 'loading' && state !== 'none';
  return (
    <View testID="next-match-card" style={[styles.shadow, compact && styles.shadowCompact, tappable ? null : styles.fixed, tappable || !compact ? null : styles.fixedCompact]}>
      <View style={styles.card}>
        <CardGradient />
        {tappable ? (
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={`${ACCESS_LABEL[state as keyof typeof ACCESS_LABEL]}: ${summary}`}
            onPress={() => onOpenMatch(match.id)}
            feedback="none"
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        {/* 20/11: ao mudar de estado (a carregar para o jogo, próximo para ao vivo) o conteúdo entra com um fade curto. */}
        <Appear key={state} style={tappable ? undefined : styles.grow} pointerEvents="box-none">
          {content}
        </Appear>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Sem sombra: num cartão transparente a sombra via-se por trás e escurecia o leão.
  // 21/11: a altura segue o conteúdo (nada fica cortado); só os estados sem jogo (a carregar, sem jogo, erro) têm altura fixa.
  shadow: { borderRadius: radii.r12 },
  shadowCompact: {},
  fixed: { height: layout.matchCardHeight },
  fixedCompact: { height: layout.matchCardHeightCompact },
  grow: { flex: 1 },
  fillCompact: { paddingTop: space.s12, paddingBottom: space.s12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  side: { flex: 1, flexBasis: 0, alignItems: 'center' },
  mid: { alignItems: 'center', justifyContent: 'center' },
  names: { marginTop: space.s8 },
  // 21/11 (captura do Hóquei): o iOS só encolhe o texto até caber se ele tiver largura; sem ela a hora ficava minúscula e
  // encostada. Ocupa a coluna central inteira e centra.
  big: { alignSelf: 'stretch', textAlign: 'center' },
  name: { flex: 1, flexBasis: 0, textAlign: 'center' },
  card: {
    borderRadius: radii.r12,
    borderWidth: layout.matchCardBorder,
    borderColor: colors.white,
    overflow: 'hidden',
  },
  fill: { paddingTop: space.s16, paddingBottom: space.s16, paddingHorizontal: space.s12 },
  strip: {
    alignItems: 'center',
    gap: space.s4,
    paddingTop: layout.matchCardStripPadTop,
    paddingHorizontal: space.s16,
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: radii.r12,
    paddingHorizontal: space.s8,
    paddingVertical: layout.matchCardBadgePadY,
    flexShrink: 0,
  },
  body: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: space.s8, paddingTop: space.s16 },
  team: { flexGrow: 1, flexBasis: 0, maxWidth: layout.matchCardTeamMax, alignItems: 'center', gap: space.s8 },
  // Hora (ou resultado) ao centro da altura do emblema, como no cabeçalho do jogo.
  center: { minWidth: layout.headerCenterMin, minHeight: layout.crestHeader.height, alignItems: 'center', justifyContent: 'center', gap: space.s4 },
  slot: { height: layout.matchCardSlot, alignItems: 'center', justifyContent: 'center', marginTop: space.s8 },
  chip: { borderRadius: radii.r28, paddingHorizontal: space.s12, paddingVertical: space.s4, alignItems: 'center' },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.s4, paddingTop: space.s4 },
});
