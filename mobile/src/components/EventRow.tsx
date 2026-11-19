// Figma V7.1: 4933:7057 (08 Sumário), linhas "Lance ..." 4933:7279 a 4933:7330. Duas colunas: Sporting à esquerda (alinhado
// à direita), adversário à direita, minuto ao centro numa caixa surface-10 44x28 raio 6. Cada coluna: linha (nome + ícone
// 14 pt, ordem espelhada) e, por baixo, o detalhe em Caption 12 text-muted. Golo: Label 16 (primary-on-dark no Sporting,
// branco no adversário) com a bola; os outros lances: Strong 14. Cartão amarelo 10x14 raio 2; substituição com as setas
// (assets/icons/event-sub.png); VAR é o selo surface-20 (sem bola: um golo anulado nunca tem ícone de golo).
// SEM FIGMA: vermelho (mesmo cartão em `danger`) e penálti falhado (bola em contorno a `danger`).
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';
import { Text71 } from '@/theme/typography';
import { colors, layout } from '@/theme/tokens';

export type EventVM = {
  minute: string;
  /** Coluna: o Sporting à esquerda, o adversário à direita. */
  side: 'sporting' | 'opponent';
  kind: 'goal' | 'missedPenalty' | 'yellow' | 'red' | 'sub' | 'var';
  primary: string;
  secondary?: string;
};

const LABEL: Record<EventVM['kind'], string> = {
  goal: 'Golo',
  missedPenalty: 'Penálti falhado',
  yellow: 'Cartão amarelo',
  red: 'Cartão vermelho',
  sub: 'Substituição',
  var: 'VAR',
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SUB_ICON = require('../../assets/icons/event-sub.png') as number;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BALL_ICON = require('../../assets/icons/ball.svg') as number;

function Glyph({ kind }: { kind: EventVM['kind'] }) {
  if (kind === 'var') {
    return (
      <View
        style={{
          backgroundColor: colors.surface20,
          borderRadius: layout.tlTagRadius,
          paddingHorizontal: layout.tlVarPadX,
          paddingVertical: layout.tlVarPadY,
        }}
      >
        <Text71 variant="badge11" testID="event-glyph">VAR</Text71>
      </View>
    );
  }
  if (kind === 'yellow' || kind === 'red') {
    return (
      <View
        testID="event-glyph"
        style={{
          width: layout.tlCardW,
          height: layout.tlCardH,
          borderRadius: layout.tlCardRadius,
          backgroundColor: kind === 'red' ? colors.danger : colors.yellow71,
        }}
      />
    );
  }
  if (kind === 'sub') {
    return <Image testID="event-glyph" source={SUB_ICON} contentFit="contain" style={{ width: layout.tlIcon, height: layout.tlIcon }} />;
  }
  if (kind === 'missedPenalty') {
    return <Ionicons testID="event-glyph" name="football-outline" size={layout.tlIcon} color={colors.danger} />;
  }
  return <Image testID="event-glyph" source={BALL_ICON} contentFit="contain" style={{ width: layout.tlIcon, height: layout.tlIcon }} />;
}

export function EventRow({ event }: { event: EventVM }) {
  const mine = event.side === 'sporting';
  const isGoal = event.kind === 'goal';
  const icon = (
    <View key="i" accessible accessibilityLabel={LABEL[event.kind]}>
      <Glyph kind={event.kind} />
    </View>
  );
  const name = (
    <Text71
      key="n"
      testID="event-name"
      variant={isGoal ? 'label16' : 'strong14'}
      color={isGoal && mine ? 'primaryOnDark' : 'white'}
      numberOfLines={1}
      style={{ flexShrink: 1 }}
    >
      {event.primary}
    </Text71>
  );
  const column = (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', maxWidth: '100%' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: layout.tlLineGap, maxWidth: '100%' }}>
        {mine ? [name, icon] : [icon, name]}
      </View>
      {event.secondary ? (
        <Text71 variant="caption12" color="textMuted" numberOfLines={1} style={{ maxWidth: '100%' }}>
          {event.secondary}
        </Text71>
      ) : null}
    </View>
  );
  const side = (key: 'left' | 'right', show: boolean) => (
    <View
      testID={`event-${key}`}
      style={{ flex: 1, minWidth: 0, alignItems: key === 'left' ? 'flex-end' : 'flex-start', justifyContent: 'center' }}
    >
      {show ? column : null}
    </View>
  );
  return (
    <View
      testID="event-row"
      style={{ flexDirection: 'row', alignItems: 'center', gap: layout.tlColGap, paddingVertical: layout.tlRowPadY }}
    >
      {side('left', mine)}
      <View
        testID="event-minute-box"
        style={{
          width: layout.tlMinuteW,
          height: layout.tlMinuteH,
          borderRadius: layout.tlMinuteRadius,
          backgroundColor: colors.surface10,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text71 variant="label16" testID="event-minute" numberOfLines={1}>
          {event.minute}
        </Text71>
      </View>
      {side('right', !mine)}
    </View>
  );
}

