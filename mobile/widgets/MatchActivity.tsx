// Jogo no ecrã de bloqueio e na Dynamic Island (Plano 10, ponto 2; Figma 53 · 5049:18573 e 53b · 5049:18671).
// Martim 20/11: automático em todos os jogos de futebol do Sporting, só iPhone. Fundo verde da marca 30 % transparente,
// S360 na linha da competição e da jornada, emblemas, resultado em caixas brancas com números grandes, pílula do minuto
// (relógio a contar no telemóvel) com a fase e o último golo. Sem legendas.
// A função com a diretiva 'widget' é serializada para a extensão: não pode usar nada de fora dela (por isso as cores
// estão aqui em texto, iguais a src/theme/tokens.ts; o teste matchActivityWidget.test.ts confirma). O conteúdo vem do
// servidor (functions/src/liveActivity/props.ts) ou da app (src/lib/matchActivity.ts), no mesmo formato.
import { HStack, Image, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  activityBackgroundTint,
  background,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  padding,
  resizable,
  shapes,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';
import type { MatchActivityProps } from '@/lib/matchActivity';

export const MATCH_ACTIVITY = 'MatchActivity';

const MatchActivity = (p: MatchActivityProps) => {
  'widget';
  const C = {
    primary: '#00835B',
    primaryOnDark: '#19B37E',
    white: '#FFFFFF',
    white70: '#FFFFFFB3',
    white10: '#FFFFFF1A',
    ink: '#001B13',
    cardTop: '#00543BB3',
    cardBottom: '#001B13B3',
  };
  const brand = (size: number) => (
    <HStack spacing={0}>
      <Text modifiers={[font({ size, weight: 'heavy' }), foregroundStyle(C.primary)]}>S</Text>
      <Text modifiers={[font({ size, weight: 'heavy' }), foregroundStyle(C.white)]}>360</Text>
    </HStack>
  );
  const crest = (uri: string | null, size: number, name: string) =>
    uri ? (
      <Image uiImage={uri} modifiers={[resizable(), frame({ width: size, height: size * 1.17 })]} />
    ) : (
      <Text modifiers={[font({ size: size * 0.32, weight: 'bold' }), foregroundStyle(C.white), lineLimit(1)]}>{name}</Text>
    );
  const box = (value: number, w: number, h: number, size: number) => (
    <ZStack modifiers={[frame({ width: w, height: h }), background(C.white, shapes.roundedRectangle({ cornerRadius: 8 }))]}>
      <Text modifiers={[font({ size, weight: 'heavy' }), foregroundStyle(C.ink), monospacedDigit()]}>{String(value)}</Text>
    </ZStack>
  );
  const clock = (size: number) =>
    p.clockFrom !== null ? (
      <Text
        timerInterval={{ lower: new Date(p.clockFrom), upper: new Date(p.clockFrom + 4 * 3600 * 1000) }}
        countsDown={false}
        modifiers={[font({ size, weight: 'bold' }), foregroundStyle(C.white), monospacedDigit()]}
      />
    ) : (
      <Text modifiers={[font({ size, weight: 'bold' }), foregroundStyle(C.white)]}>{p.phase === 'FINAL' ? '' : p.minute}</Text>
    );
  const moment = (
    <HStack spacing={6} modifiers={[padding({ horizontal: 10, vertical: 5 }), background(C.white10, shapes.capsule())]}>
      {p.phase !== 'FINAL' ? <Text modifiers={[font({ size: 8 }), foregroundStyle(C.primaryOnDark)]}>●</Text> : null}
      {p.phase !== 'FINAL' ? clock(12) : null}
      <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(C.white)]}>{p.phase}</Text>
    </HStack>
  );
  const goal = p.lastGoal ? (
    <Text modifiers={[font({ size: 12 }), foregroundStyle(C.white), lineLimit(1)]}>{`⚽ ${p.lastGoal}`}</Text>
  ) : null;
  const url = `s360://jogo/${p.matchId}`;

  return {
    banner: (
      <VStack
        spacing={8}
        modifiers={[
          padding({ all: 16 }),
          frame({ maxWidth: 10000 }),
          background({ type: 'linearGradient', colors: [C.cardTop, C.cardBottom], startPoint: { x: 0.5, y: 0 }, endPoint: { x: 0.5, y: 1 } }),
          activityBackgroundTint('clear'),
          widgetURL(url),
        ]}
      >
        <HStack spacing={8} alignment="center">
          {brand(20)}
          <Spacer />
          <Text modifiers={[font({ size: 12, weight: 'bold' }), foregroundStyle(C.white70), lineLimit(1)]}>{p.competition}</Text>
          {p.round ? (
            <Text
              modifiers={[
                font({ size: 10, weight: 'bold' }),
                foregroundStyle(C.white),
                padding({ horizontal: 6, vertical: 2 }),
                background(C.primary, shapes.roundedRectangle({ cornerRadius: 4 })),
              ]}
            >
              {p.round}
            </Text>
          ) : null}
        </HStack>
        <HStack alignment="center">
          {crest(p.homeCrest, 44, p.homeName)}
          <Spacer />
          <HStack spacing={8}>
            {box(p.homeScore, 52, 62, 40)}
            {box(p.awayScore, 52, 62, 40)}
          </HStack>
          <Spacer />
          {crest(p.awayCrest, 44, p.awayName)}
        </HStack>
        {moment}
        {goal}
      </VStack>
    ),
    compactLeading: (
      <HStack spacing={4}>
        {crest(p.homeCrest, 16, p.homeName)}
        <Text modifiers={[font({ size: 14, weight: 'heavy' }), foregroundStyle(C.white), monospacedDigit()]}>{String(p.homeScore)}</Text>
      </HStack>
    ),
    compactTrailing: (
      <HStack spacing={4}>
        <Text modifiers={[font({ size: 14, weight: 'heavy' }), foregroundStyle(C.white), monospacedDigit()]}>{String(p.awayScore)}</Text>
        {crest(p.awayCrest, 16, p.awayName)}
      </HStack>
    ),
    minimal: (
      <Text modifiers={[font({ size: 12, weight: 'heavy' }), foregroundStyle(C.white), monospacedDigit()]}>{`${p.homeScore}-${p.awayScore}`}</Text>
    ),
    expandedLeading: <VStack modifiers={[padding({ leading: 8 })]}>{crest(p.homeCrest, 36, p.homeName)}</VStack>,
    expandedTrailing: <VStack modifiers={[padding({ trailing: 8 })]}>{crest(p.awayCrest, 36, p.awayName)}</VStack>,
    expandedCenter: (
      <VStack spacing={6}>
        <HStack spacing={6}>
          {brand(14)}
          <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(C.white70), lineLimit(1)]}>{p.competition}</Text>
        </HStack>
        <HStack spacing={6}>
          {box(p.homeScore, 40, 48, 30)}
          {box(p.awayScore, 40, 48, 30)}
        </HStack>
      </VStack>
    ),
    expandedBottom: (
      <VStack spacing={6} modifiers={[padding({ bottom: 8 })]}>
        {moment}
        {goal}
      </VStack>
    ),
  };
};

export default createLiveActivity<MatchActivityProps>(MATCH_ACTIVITY, MatchActivity);
