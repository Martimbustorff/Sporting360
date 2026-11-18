// Figma: nós 655:31908 (cartão, lado direito: nome, ícone, minuto; alinhado à direita) e 655:31916
// (substituição, lado esquerdo: minuto, ícone, nome). Ícone: círculo branco 32 (raio 16). Cartão: retângulo
// 13x19 raio 2 rodado 9.07º; substituição: setas (assets/icons/event-sub.png, exportado do Figma).
// SEM FIGMA: ícones de golo, penálti falhado e VAR (não existem nos nós fornecidos): Ionicons tingidos com
// tokens. O penálti falhado usa a bola em contorno a vermelho (cardRed), para não se confundir com um golo.
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';
import { Body, Display } from '@/theme/typography';
import { colors, layout, radius, spacing } from '@/theme/tokens';

export type EventVM = {
  minute: string;
  side: 'home' | 'away';
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

function Glyph({ kind }: { kind: EventVM['kind'] }) {
  if (kind === 'yellow' || kind === 'red') {
    return (
      <View
        testID="event-glyph"
        style={{
          width: layout.cardWidth,
          height: layout.cardHeight,
          borderRadius: layout.cardRadius,
          backgroundColor: kind === 'red' ? colors.cardRed : colors.cardYellowAlt,
          transform: [{ rotate: layout.cardRotation }],
        }}
      />
    );
  }
  if (kind === 'sub') {
    return <Image testID="event-glyph" source={SUB_ICON} contentFit="contain" style={layout.subIcon} />;
  }
  if (kind === 'missedPenalty') {
    return <Ionicons testID="event-glyph" name="football-outline" size={layout.eventGlyph} color={colors.cardRed} />;
  }
  return (
    <Ionicons
      testID="event-glyph"
      name={kind === 'goal' ? 'football' : 'videocam'}
      size={layout.eventGlyph}
      color={colors.bg}
    />
  );
}

export function EventRow({ event }: { event: EventVM }) {
  const home = event.side === 'home';
  const minute = (
    <Display key="m" variant="minute" testID="event-minute" style={{ textAlign: 'center' }}>
      {event.minute}
    </Display>
  );
  const icon = (
    <View
      key="i"
      accessible
      accessibilityLabel={LABEL[event.kind]}
      style={{
        width: layout.eventIcon,
        height: layout.eventIcon,
        borderRadius: radius.pill,
        backgroundColor: colors.white,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <Glyph kind={event.kind} />
    </View>
  );
  const name = (
    <View key="n" testID="event-name" style={{ flexShrink: 1, alignItems: home ? 'flex-start' : 'flex-end' }}>
      <Body variant="body">{event.primary}</Body>
      {event.secondary ? (
        <Body variant="body" style={{ color: colors.textMuted }}>{event.secondary}</Body>
      ) : null}
    </View>
  );
  return (
    <View
      testID="event-row"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: home ? 'flex-start' : 'flex-end',
        gap: layout.eventRowGap,
        paddingHorizontal: spacing.md,
        minHeight: layout.eventRowMinHeight,
      }}
    >
      {home ? [minute, icon, name] : [name, icon, minute]}
    </View>
  );
}
