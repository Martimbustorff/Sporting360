// Figma V7.1: 4924:6268 (06 Jogo · Ao vivo), "Conteúdo · Ao vivo" 4924:6440. "Números do jogo" (Eyebrow 13 text-subtle, 16 até
// ao primeiro bloco) com Posse de bola, Remates e Golos esperados (xG) no mesmo bloco de estatística da tab Estatísticas
// (valores nos cantos, rótulo ao centro, barra de 4), blocos a 16; depois os lances, o mais recente primeiro, cada um com a
// caixa do minuto 44x28, o título Label 16 (primary-on-dark num golo do Sporting) e uma segunda linha Caption 12 só quando
// os dados do lance a dão; separador entre lances. Só o jogo ao vivo (e ao intervalo): o terminado é o frame 08.
// Sem dados de estatísticas dos dois lados, o bloco não aparece (nunca zeros inventados); a leitura falhada também o esconde.
import type { ReactNode } from 'react';
import Animated, { FadeInDown, LayoutAnimationConfig, LinearTransition } from 'react-native-reanimated';
import { canAnimate, MOTION } from '@/lib/motion';
import { View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { StatRow } from '@/components/StatRow';
import type { Match } from '@/data/schemas';
import { useMatchDetail } from '@/data/sports';
import { liveFeed, type LiveEventVM } from '@/lib/matchVM';
import { liveNumbers } from '@/lib/stats';
import { shortClubName } from '@/lib/teams';
import { Text71 } from '@/theme/typography';
import { colors, layout, space } from '@/theme/tokens';

export const LIVE_TEXT = {
  numbers: 'Números do jogo',
  noEvents: 'Os lances aparecem aqui durante o jogo.',
  error: 'Não foi possível carregar os dados.',
} as const;

const KIND_TITLE: Record<LiveEventVM['kind'], string> = {
  goal: 'Golo do',
  missedPenalty: 'Penálti falhado do',
  yellow: 'Cartão amarelo do',
  red: 'Cartão vermelho do',
  sub: 'Substituição do',
  var: 'VAR',
};

export function LiveNumbers({ match }: { match: Match }) {
  const stats = useMatchDetail(match.id, 'statistics');
  if (stats.status !== 'ready') return null;
  const rows = liveNumbers(stats.data, match.home.id, match.away.id);
  if (rows.length === 0) return null;
  return (
    <View testID="live-numbers" style={{ gap: space.s16 }}>
      <Text71 variant="eyebrow13" color="textSubtle" accessibilityRole="header">{LIVE_TEXT.numbers}</Text71>
      {rows.map((r) => (
        <StatRow key={r.label} label={r.label} home={r.home} away={r.away} />
      ))}
    </View>
  );
}

function LiveEventRow({ event, match }: { event: LiveEventVM; match: Match }) {
  const opponentSide = match.sportingSide === 'home' ? 'away' : 'home';
  const team = shortClubName(match[event.side === 'sporting' ? match.sportingSide : opponentSide].name);
  const title = event.kind === 'var' ? KIND_TITLE.var : `${KIND_TITLE[event.kind]} ${team}`;
  const sportingGoal = event.kind === 'goal' && event.side === 'sporting';
  return (
    <View
      testID="live-event"
      accessible
      accessibilityLabel={`${event.minute} ${title}${event.line ? `. ${event.line}` : ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.s12 }}
    >
      <View
        style={{
          width: layout.tlMinuteW,
          height: layout.tlMinuteH,
          borderRadius: layout.tlMinuteRadius,
          backgroundColor: colors.surface10,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text71 variant="label16" numberOfLines={1}>{event.minute}</Text71>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text71 variant="label16" color={sportingGoal ? 'primaryOnDark' : 'white'} numberOfLines={2}>{title}</Text71>
        {event.line ? (
          <Text71 variant="caption12" color="textMuted" testID="live-event-line" numberOfLines={2}>{event.line}</Text71>
        ) : null}
      </View>
    </View>
  );
}

export function LiveEvents({ match }: { match: Match }) {
  const events = useMatchDetail(match.id, 'events');
  if (events.status === 'loading') return null;
  if (events.status === 'error') return <EmptyState icon="info" text={LIVE_TEXT.error} />;
  const feed = events.status === 'ready' ? liveFeed(events.data.items, match.home.id, match.sportingSide) : [];
  if (feed.length === 0) return <EmptyState icon="info" text={LIVE_TEXT.noEvents} />;
  return (
    // 20/11: um lance novo entra a subir com fade no fim da lista; ao abrir o jogo os lances já lá estão (skipEntering).
    <LiveList>
      {feed.map((e, i) => (
        <LiveItem key={e.key}>
          {i > 0 ? <View style={{ height: layout.separator, backgroundColor: colors.separator }} /> : null}
          <LiveEventRow event={e} match={match} />
        </LiveItem>
      ))}
    </LiveList>
  );
}

function LiveList({ children }: { children: ReactNode }) {
  const list = (
    <View testID="live-events" style={{ gap: space.s16 }}>
      {children}
    </View>
  );
  return canAnimate() ? <LayoutAnimationConfig skipEntering>{list}</LayoutAnimationConfig> : list;
}

function LiveItem({ children }: { children: ReactNode }) {
  if (!canAnimate()) return <View style={{ gap: space.s16 }}>{children}</View>;
  return (
    <Animated.View entering={FadeInDown.duration(MOTION.base)} layout={LinearTransition.duration(MOTION.base)} style={{ gap: space.s16 }}>
      {children}
    </Animated.View>
  );
}
