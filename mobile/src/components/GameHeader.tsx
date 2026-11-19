// Figma V7.1: 4924:6268 (06, completo ao vivo: pílula "Ao vivo", caixas brancas com charneira, minuto, marcadores por equipa,
// linha 0 a 90, cartão "O teu prognóstico"), 4945:7833 (29, antes do jogo: data, hora Score 72), 4933:7057 (08, compacto:
// emblemas 24, "2 - 1" Title 24, estado), 4935:7111 (10, compacto ao vivo com o minuto) e 4947:9606 (34, outra modalidade).
// Emblemas: quando a equipa é o Sporting (id API 228) usa-se sempre o emblema local 2026.
// Decisões: o `Match` não traz canal de TV, por isso o chip do canal não aparece (regra do controlador, como na Home); o
// degradé branco das caixas do Figma fica a branco liso (sem biblioteca de degradés); o cartão do prognóstico só mostra
// pontos quando existem eventos de pontos do servidor (a app nunca calcula pontuação). O nome da competição e a jornada
// vivem na barra de navegação (`GameNavTitle`), uma só vez (nota 06).
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { MatchTimeline } from '@/components/MatchTimeline';
import { PredictionSummary, type PredictionVM } from '@/components/PredictionSummary';
import { minuteText, penaltiesText, stateLabel, type GoalVM, type UiState } from '@/lib/matchVM';
import { formatRound } from '@/lib/formatRound';
import { formatCardDate, formatTime } from '@/lib/ptDate';
import { SPORTING_API_ID } from '@/lib/teams';
import { Display, Text71 } from '@/theme/typography';
import { colors, layout, radii, radius, space, spacing } from '@/theme/tokens';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SPORTING_CREST = require('../../assets/images/sporting-cp-2026.png') as number;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ICON_BALL = require('../../assets/icons/ball.svg') as number;

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
  /** Canal de TV; o `Match` ainda não o traz, por isso nunca se desenha. */
  tv?: string | null;
  minute?: number | null;
  /** Minuto já formatado ("45+2’"); quando existe, usa-se em vez de `minute`. */
  minuteText?: string | null;
  /** Local do jogo; só preenchido fora do futebol (o futebol tem a secção Informação do Jogo). */
  venue?: string | null;
  score?: { home: number; away: number } | null;
  /** Desempate por penáltis, depois do prolongamento. */
  penalty?: { home: number; away: number } | null;
  /** Golos por ordem do jogo (marcadores e linha do tempo); só futebol. */
  goals?: GoalVM[];
  /** Prognóstico do utilizador neste jogo; null ou ausente esconde o cartão. */
  prediction?: PredictionVM | null;
};

const CREST_BOX = {
  lg: layout.crestSize,
  hd: layout.crestHeader,
  md: layout.crestCard,
  sm: layout.crestSmall,
  xs: layout.crestCompact,
  form: layout.crestForm,
  row: layout.crestRow,
} as const;

/**
 * `size`: 'hd' no cabeçalho do jogo (60x70, V7.1 4924:6375), 'xs' no cabeçalho compacto (24x28, 4933:7267), 'lg' no cabeçalho (75x87, Figma 500:28798), 'sm' nas linhas da Agenda (30x35, Figma 500:28825),
 * 'form' na linha de forma do Sumário (18x21, 4933:7343), 'md' no cartão do próximo jogo da Home (52x60, V7.1 4920:5096), 'row' nas linhas de jogo (22x25,5, V7.1 4948:8283).
 */
export function TeamCrest({ team, testID, size = 'lg' }: { team: TeamVM; testID?: string; size?: 'lg' | 'hd' | 'md' | 'sm' | 'xs' | 'form' | 'row' }) {
  const box = CREST_BOX[size];
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


export const GAME_HEADER_TEXT = {
  next: 'Próximo jogo',
  live: 'Ao vivo',
  firstHalf: '1.ª parte',
  secondHalf: '2.ª parte',
  extraTime: 'Prolongamento',
  endOfGame: 'Fim do jogo',
  finishedChip: 'Fim',
  versus: 'VS',
  predictionTitle: 'O teu prognóstico',
} as const;

const sportingSideOf = (g: GameHeaderVM): 'home' | 'away' =>
  g.away.id === SPORTING_API_ID ? 'away' : 'home';

function minuteOf(g: GameHeaderVM): string {
  return g.minuteText ? g.minuteText : g.minute != null ? minuteText(g.minute, null) : '';
}

/** Texto da pílula do momento do jogo (4924:6372): "Ao vivo · 2.ª parte" a partir do minuto. */
export function momentText(g: GameHeaderVM): string {
  switch (g.state) {
    case 'scheduled':
      return GAME_HEADER_TEXT.next;
    case 'live': {
      const m = g.minute ?? 0;
      const part = m <= 45 ? GAME_HEADER_TEXT.firstHalf : m <= 90 ? GAME_HEADER_TEXT.secondHalf : GAME_HEADER_TEXT.extraTime;
      return g.minute == null ? GAME_HEADER_TEXT.live : `${GAME_HEADER_TEXT.live} · ${part}`;
    }
    default:
      return stateLabel(g.state);
  }
}

/** Ponto que pulsa na pílula ao vivo (sem animação com "reduzir movimento"). */
function LiveDot() {
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
  return (
    <Animated.View
      testID="live-dot"
      style={[
        { width: layout.headerPillDot, height: layout.headerPillDot, borderRadius: layout.headerPillDot / 2, backgroundColor: colors.primaryOnDark },
        animated,
      ]}
    />
  );
}

function MomentPill({ game }: { game: GameHeaderVM }) {
  return (
    <View
      accessible
      accessibilityRole="header"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s8,
        backgroundColor: colors.surface10,
        borderWidth: layout.headerPillBorder,
        borderColor: colors.primaryOnDark,
        borderRadius: layout.headerPillRadius,
        paddingLeft: layout.headerPillPadLeft,
        paddingRight: layout.headerPillPadRight,
        paddingVertical: layout.headerPillPadY,
      }}
    >
      {game.state === 'live' ? <LiveDot /> : null}
      <Text71 variant="badge11" numberOfLines={1}>{momentText(game)}</Text71>
    </View>
  );
}

/** Caixa de resultado do Figma 4924:6384: branca, charneira de placard e, na equipa que marcou por último, contorno e brilho verdes. */
function FlipBox({ value, testID, ringed }: { value: number; testID: string; ringed: boolean }) {
  return (
    <View
      style={{
        width: layout.headerScoreBox.width,
        height: layout.headerScoreBox.height,
        borderRadius: radii.r12,
        backgroundColor: colors.white,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: ringed ? 'visible' : 'hidden',
        ...(ringed
          ? {
              borderWidth: layout.headerScoreRingWidth,
              borderColor: layout.headerScoreRing,
              shadowColor: layout.headerScoreRing,
              shadowOpacity: layout.headerScoreGlowOpacity,
              shadowRadius: layout.headerScoreGlowRadius,
              shadowOffset: { width: 0, height: 0 },
              elevation: layout.headerScoreGlowElevation,
            }
          : layout.headerScoreShadow),
      }}
    >
      <Text71
        variant="score72"
        color="ink"
        testID={testID}
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ textAlign: 'center' }}
      >
        {value}
      </Text71>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: layout.headerScoreBox.height / 2,
          height: layout.separator,
          backgroundColor: colors.ink,
          opacity: layout.headerHingeOpacity,
        }}
      />
    </View>
  );
}

function Team({ team, side }: { team: TeamVM; side: 'home' | 'away' }) {
  return (
    <View style={{ flex: 1, flexBasis: 0, maxWidth: layout.headerTeamColumn, alignItems: 'center', gap: layout.headerTeamGap }}>
      <TeamCrest team={team} testID={`crest-${side}`} size="hd" />
      <Text71 variant="label16" numberOfLines={1} style={{ alignSelf: 'stretch', textAlign: 'center' }}>
        {team.name}
      </Text71>
    </View>
  );
}

function Center({ game }: { game: GameHeaderVM }) {
  const { state } = game;
  const off = state === 'postponed' || state === 'cancelled';
  const score = off || state === 'scheduled' ? null : game.score;
  const lastGoal = game.goals?.length ? game.goals[game.goals.length - 1] : undefined;
  const ringSide = state === 'live' ? lastGoal?.side : undefined;
  return (
    <View style={{ minWidth: layout.headerCenterMin, alignItems: 'center', gap: space.s4 }}>
      {score ? (
        <>
          <View style={{ flexDirection: 'row', gap: layout.headerScoreGap }}>
            <FlipBox value={score.home} testID="score-home" ringed={ringSide === 'home'} />
            <FlipBox value={score.away} testID="score-away" ringed={ringSide === 'away'} />
          </View>
          {state === 'live' && minuteOf(game) ? (
            <Text71 variant="title24" color="primaryOnDark" testID="live-minute" numberOfLines={1}>
              {minuteOf(game)}
            </Text71>
          ) : null}
          {state === 'finished' ? (
            <Text71 variant="eyebrow13" color="textMuted" numberOfLines={1}>
              {game.penalty ? penaltiesText(game.penalty.home, game.penalty.away) : GAME_HEADER_TEXT.endOfGame}
            </Text71>
          ) : null}
        </>
      ) : (
        <>
          <Text71 variant="eyebrow13" color="textMuted" numberOfLines={1} testID="game-date">
            {formatCardDate(game.kickoff)}
          </Text71>
          {off ? null : (
            <Text71 variant="score72" numberOfLines={1} adjustsFontSizeToFit testID="game-time">
              {formatTime(game.kickoff)}
            </Text71>
          )}
        </>
      )}
    </View>
  );
}

function Scorers({ goals }: { goals: GoalVM[] }) {
  const column = (side: 'home' | 'away') => (
    <View style={{ flex: 1, flexBasis: 0, gap: layout.headerScorersGap, alignItems: side === 'home' ? 'flex-end' : 'flex-start' }}>
      {goals
        .filter((g) => g.side === side)
        .map((g, i) => (
          <Text71 key={`${side}-${i}`} variant="caption12" color="textMuted" numberOfLines={1} style={{ maxWidth: '100%' }}>
            {g.text}
          </Text71>
        ))}
    </View>
  );
  return (
    <View testID="game-scorers" style={{ flexDirection: 'row', alignSelf: 'stretch', gap: space.s8, paddingTop: space.s4 }}>
      {column('home')}
      <Image
        source={ICON_BALL}
        accessible={false}
        style={{ width: layout.headerBallIcon, height: layout.headerBallIcon, marginTop: layout.headerBallTop }}
      />
      {column('away')}
    </View>
  );
}

function CompactChip({ game }: { game: GameHeaderVM }) {
  const live = game.state === 'live';
  const label = live ? minuteOf(game) : game.state === 'finished' ? GAME_HEADER_TEXT.finishedChip : game.state === 'scheduled' ? '' : stateLabel(game.state);
  if (!label) return null;
  return (
    <View
      testID="compact-state"
      style={{
        backgroundColor: live ? colors.primary : colors.surface10,
        borderRadius: layout.chipRadius,
        paddingHorizontal: layout.compactStateChipPadX,
        paddingVertical: layout.compactStateChipPadY,
      }}
    >
      <Text71 variant="badge11" color={live ? 'white' : 'textMuted'} numberOfLines={1}>
        {label}
      </Text71>
    </View>
  );
}

/** Rótulo acessível do cabeçalho compacto: "Sporting CP 2, FC Porto 1, terminado". */
export function compactSummary(game: GameHeaderVM): string {
  const { home, away, score, state } = game;
  if (!score || state === 'scheduled' || state === 'postponed' || state === 'cancelled') {
    const tail = state === 'scheduled' ? formatTime(game.kickoff) : stateLabel(state).toLowerCase();
    return `${home.name} contra ${away.name}, ${tail}`;
  }
  const tail = state === 'live' ? `ao vivo${minuteOf(game) ? `, ${minuteOf(game)}` : ''}` : stateLabel(state).toLowerCase();
  return `${home.name} ${score.home}, ${away.name} ${score.away}, ${tail}`;
}

function Compact({ game }: { game: GameHeaderVM }) {
  const off = game.state === 'postponed' || game.state === 'cancelled';
  const score = game.state === 'scheduled' || off ? null : game.score;
  return (
    <View
      testID="game-header-compact"
      accessible
      accessibilityRole="summary"
      accessibilityLabel={compactSummary(game)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: layout.compactCrestGap }}
    >
      <TeamCrest team={game.home} testID="compact-crest-home" size="xs" />
      <Text71 variant="title24" numberOfLines={1} testID="compact-score">
        {score ? `${score.home} - ${score.away}` : off ? GAME_HEADER_TEXT.versus : formatTime(game.kickoff)}
      </Text71>
      <TeamCrest team={game.away} testID="compact-crest-away" size="xs" />
      <CompactChip game={game} />
    </View>
  );
}

/** Competição e jornada na barra de navegação (4924:6365), uma só vez no ecrã. */
export function GameNavTitle({ game }: { game: Pick<GameHeaderVM, 'competitionName' | 'round'> }) {
  const round = formatRound(game.round);
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={game.round ? `${game.competitionName}, ${game.round}` : game.competitionName}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.s8 }}
    >
      {round ? (
        <View
          testID="competition-badge"
          style={{ backgroundColor: colors.primary, borderRadius: layout.chipRadius, paddingHorizontal: layout.compactStateChipPadX, paddingVertical: layout.compactStateChipPadY }}
        >
          <Text71 variant="badge11" numberOfLines={1}>{round}</Text71>
        </View>
      ) : null}
      <Text71 variant="eyebrow13" color="textMuted" numberOfLines={1} style={{ flexShrink: 1 }}>
        {game.competitionName}
      </Text71>
    </View>
  );
}

export type GameHeaderProps = {
  game: GameHeaderVM;
  /** 'full' (por omissão): antes, ao vivo ou terminado; 'compact': uma linha com emblemas, resultado e estado. */
  size?: 'full' | 'compact';
};

export function GameHeader({ game, size = 'full' }: GameHeaderProps) {
  if (size === 'compact') return <Compact game={game} />;
  const hasScore = game.state === 'live' || game.state === 'halftime' || game.state === 'finished';
  const goals = game.goals ?? [];
  const sporting = sportingSideOf(game);
  const showTimeline = hasScore && game.goals !== undefined;
  const lastMinute = game.state === 'finished' ? 90 : Math.min(game.minute ?? 0, 90);
  return (
    <View testID="game-header" accessible={false} style={{ alignItems: 'center', gap: space.s16, paddingHorizontal: space.s16, paddingTop: layout.headerPadTop, paddingBottom: space.s16 }}>
      <MomentPill game={game} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', alignSelf: 'stretch', justifyContent: 'center' }}>
        <Team team={game.home} side="home" />
        <Center game={game} />
        <Team team={game.away} side="away" />
      </View>
      {goals.length > 0 && hasScore ? <Scorers goals={goals} /> : null}
      {showTimeline ? (
        <MatchTimeline goals={goals} minute={lastMinute} live={game.state === 'live'} sportingSide={sporting} />
      ) : null}
      {game.prediction && hasScore ? <PredictionSummary prediction={game.prediction} /> : null}
      {game.venue ? (
        <Text71 variant="body14" color="textMuted" testID="game-venue" numberOfLines={1} style={{ textAlign: 'center', alignSelf: 'stretch' }}>
          {game.venue}
        </Text71>
      ) : null}
    </View>
  );
}
