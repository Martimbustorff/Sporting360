// Figma: nós 498:28129 (campo "Union", 347x533.14, linhas brancas a 20 %) e 498:28140 (jogador: camisola "Subtract"
// 30x28 com o número em DIN 14 a 7 px do topo e, por baixo, o apelido em `pitchName` (corpo SemiBold 10, preto) numa caixa branca
// de raio 4). Camisolas: Sporting verde 498:28142 e guarda-redes amarelo 498:28347 (número preto); adversário azul
// 498:28183 e guarda-redes laranja 498:28357. Casa na metade de cima a partir do guarda-redes (498:28345 sobe 7 px
// sobre a linha), fora na de baixo, espelhada, com o guarda-redes junto à baliza de baixo (498:28355).
// SEM FIGMA: a etiqueta da nota ao lado da camisola, as reticências do apelido longo e "Onze ainda não disponível."
// na metade de uma equipa sem onze.
import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';
import type { LineupPlayer } from '@/data/schemas';
import { pitchName } from '@/lib/pitch';
import { Body, Display } from '@/theme/typography';
import { colors, layout, radius, spacing } from '@/theme/tokens';

/* eslint-disable @typescript-eslint/no-require-imports */
const PITCH = require('../../assets/images/pitch.svg');
const SHIRTS = {
  sporting: require('../../assets/icons/shirt-sporting.svg'),
  sportingGk: require('../../assets/icons/shirt-sporting-gk.svg'),
  opponent: require('../../assets/icons/shirt-opponent.svg'),
  opponentGk: require('../../assets/icons/shirt-opponent-gk.svg'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

export const NO_XI = 'Onze ainda não disponível.';

type Side = 'home' | 'away';

export type PitchProps = {
  home: LineupPlayer[][];
  away: LineupPlayer[][];
  ratings: Record<string, string>;
  /** Lado do Sporting: camisola verde e jogadores tocáveis. */
  sportingSide: Side;
  /** Toque num jogador do Sporting (os do adversário não são botões). */
  onPlayer?: (id: string) => void;
};

function Player({ p, gk, sporting, rating, onPress }: {
  p: LineupPlayer;
  gk: boolean;
  sporting: boolean;
  rating?: string;
  onPress?: () => void;
}) {
  const shirt = sporting ? (gk ? SHIRTS.sportingGk : SHIRTS.sporting) : gk ? SHIRTS.opponentGk : SHIRTS.opponent;
  const label = [p.number != null ? `${p.number} ${p.name}` : p.name, rating ? `nota ${rating}` : null]
    .filter(Boolean)
    .join(', ');
  const body = (
    <>
      <View style={{ width: layout.shirt.width, height: layout.shirt.height, alignItems: 'center' }}>
        <Image source={shirt} accessible={false} style={{ width: layout.shirt.width, height: layout.shirt.height }} />
        {p.number != null ? (
          <Display
            variant="pitchNumber"
            style={{ position: 'absolute', top: layout.shirtNumberTop, color: sporting && gk ? colors.black : colors.white }}
          >
            {String(p.number)}
          </Display>
        ) : null}
        {rating ? (
          <View
            testID="pitch-rating"
            style={{
              position: 'absolute',
              top: 0,
              left: '100%',
              backgroundColor: colors.primary,
              borderRadius: radius.sm,
              paddingHorizontal: layout.pitchRatingPadX,
            }}
          >
            <Body variant="pitchRating">{rating}</Body>
          </View>
        ) : null}
      </View>
      <View
        style={{
          backgroundColor: colors.white,
          borderRadius: radius.sm,
          paddingHorizontal: layout.pitchNamePadX,
          paddingVertical: layout.pitchNamePadY,
          maxWidth: layout.pitchNameMaxWidth,
        }}
      >
        <Body variant="pitchName" testID="pitch-name" numberOfLines={1} ellipsizeMode="tail">
          {pitchName(p.name)}
        </Body>
      </View>
    </>
  );
  const style = { alignItems: 'center' as const };
  return onPress ? (
    <Pressable testID="pitch-player" accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={style}>
      {body}
    </Pressable>
  ) : (
    <View testID="pitch-player" accessible accessibilityLabel={label} style={style}>
      {body}
    </View>
  );
}

function Half({ side, rows, ratings, sporting, onPlayer, showMissing }: {
  side: Side;
  rows: LineupPlayer[][];
  ratings: Record<string, string>;
  sporting: boolean;
  onPlayer?: (id: string) => void;
  showMissing: boolean;
}) {
  // A de fora vê o campo ao contrário: guarda-redes em baixo e colunas espelhadas.
  const shown = side === 'home' ? rows : [...rows].reverse().map((r) => [...r].reverse());
  const gkRow = side === 'home' ? 0 : shown.length - 1;
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        height: '50%',
        ...(side === 'home'
          ? { top: -layout.pitchGkOverlap, paddingBottom: layout.pitchMidGap }
          : { bottom: -layout.pitchGkOverlap, paddingTop: layout.pitchMidGap }),
        justifyContent: showMissing ? 'center' : 'space-between',
      }}
    >
      {showMissing ? (
        <Body variant="body" style={{ textAlign: 'center', opacity: layout.mutedOpacity }}>{NO_XI}</Body>
      ) : (
        shown.map((row, i) => (
          <View
            key={`${side}-${i}`}
            testID={`pitch-row-${side}`}
            style={{ flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-start', gap: spacing.xs }}
          >
            {row.map((p, j) => (
              <Player
                key={`${p.playerId}-${j}`}
                p={p}
                gk={i === gkRow}
                sporting={sporting}
                rating={ratings[p.playerId]}
                onPress={sporting && onPlayer ? () => onPlayer(p.playerId) : undefined}
              />
            ))}
          </View>
        ))
      )}
    </View>
  );
}

export function Pitch({ home, away, ratings, sportingSide, onPlayer }: PitchProps) {
  const any = home.length > 0 || away.length > 0;
  return (
    <View
      testID="pitch"
      style={{ width: '100%', aspectRatio: layout.pitch.width / layout.pitch.height, marginVertical: layout.pitchGkOverlap }}
    >
      <Image source={PITCH} accessible={false} contentFit="contain" style={{ width: '100%', height: '100%' }} />
      {(['home', 'away'] as const).map((side) => (
        <Half
          key={side}
          side={side}
          rows={side === 'home' ? home : away}
          ratings={ratings}
          sporting={side === sportingSide}
          onPlayer={onPlayer}
          showMissing={any && (side === 'home' ? home : away).length === 0}
        />
      ))}
    </View>
  );
}
