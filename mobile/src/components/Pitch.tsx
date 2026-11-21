// Figma V7.1: 4947:8531 (Campo: 354x430, raio 16, relva `pitchField`, linhas surface-20) e os jogadores 4947:8538 (foto
// `PlayerPhoto` 34 com o número, selo da nota no canto de cima à direita a 20 pt da esquerda do bloco de 36, apelido em
// Caption Strong 12 por baixo). Mostra uma equipa de cada vez, com o guarda-redes em baixo e o ataque para cima
// (o alternador de equipa está em `LineupsTab`). Posições: `pitchRows` (grelha ou posição), colunas espelhadas como no
// campo antigo da equipa de fora, que passa a ser a vista única.
// Decisões: o selo da nota fica sobre a foto, como no frame (a nota "por cima" do nome); primary a partir de 8,0 e
// `bg` nas outras; sem nota não há selo. SEM FIGMA: as linhas do campo são Views (sem imagem) e "Onze ainda não
// disponível." quando a equipa não tem onze.
import { Fragment } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { PlayerPhoto } from '@/components/PlayerPhoto';
import { Touchable } from '@/components/Touchable';
import type { LineupPlayer } from '@/data/schemas';
import { pitchName, pitchRowPositions, TOP_RATING } from '@/lib/pitch';
import { Text71 } from '@/theme/typography';
import { colors, layout, radii, space } from '@/theme/tokens';

export const NO_XI = 'Onze ainda não disponível.';

const ICON_BALL = require('../../assets/icons/ball.svg') as number;

/** 21/11 (Martim): bola de quem marcou; com mais de um golo, "2" ao lado. Também nos suplentes (LineupsTab). */
export function GoalBall({ goals, testID = 'pitch-goals' }: { goals: number; testID?: string }) {
  if (goals <= 0) return null;
  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
        paddingHorizontal: 1,
        borderRadius: layout.lineupChipRadius,
        backgroundColor: colors.bg,
      }}
    >
      <Image source={ICON_BALL} accessible={false} style={{ width: layout.lineupBall - 2, height: layout.lineupBall - 2 }} />
      {goals > 1 ? <Text71 variant="badge11">{String(goals)}</Text71> : null}
    </View>
  );
}

export type PitchProps = {
  /** Linhas do onze, do guarda-redes para a frente (`pitchRows`). Vazio: campo sem jogadores. */
  rows: LineupPlayer[][];
  /** Notas formatadas por `playerId` ("7,3"). */
  ratings: Record<string, string>;
  /** Notas numéricas por `playerId` (decidem a cor do selo). */
  ratingValues: Record<string, number>;
  photos: Record<string, string>;
  /** Mostra "Onze ainda não disponível." (equipa sem onze no documento). */
  missing?: boolean;
  /** Toque num jogador (só passado para o Sporting). */
  onPlayer?: (id: string) => void;
  /** Golos por `playerId` (goalsMap). */
  goals?: Record<string, number>;
};

function Player({ p, rating, value, photo, onPress, goals = 0 }: {
  p: LineupPlayer;
  rating?: string;
  value?: number;
  photo?: string;
  onPress?: () => void;
  goals?: number;
}) {
  const goalText = goals === 1 ? '1 golo' : goals > 1 ? `${goals} golos` : null;
  const label = [p.number != null ? `${p.number} ${p.name}` : p.name, rating ? `nota ${rating}` : null, goalText]
    .filter(Boolean)
    .join(', ');
  const body = (
    <>
      <View style={{ width: layout.lineupPhotoBox, height: layout.lineupPhotoBox }}>
        <View style={{ position: 'absolute', left: 0, top: space.s4 / 2 }}>
          <PlayerPhoto photo={photo ?? null} size={layout.lineupPhoto} number={p.number} />
        </View>
        {rating ? (
          <View
            testID="pitch-rating"
            style={{
              position: 'absolute',
              top: 0,
              left: layout.lineupChipLeft,
              paddingHorizontal: space.s4,
              paddingVertical: 1,
              borderRadius: layout.lineupChipRadius,
              backgroundColor: value != null && value >= TOP_RATING ? colors.primary : colors.bg,
            }}
          >
            <Text71 variant="badge11">{rating}</Text71>
          </View>
        ) : null}
        {goals > 0 ? (
          <View style={{ position: 'absolute', bottom: 0, left: layout.lineupBallLeft }}>
            <GoalBall goals={goals} />
          </View>
        ) : null}
      </View>
      <Text71 variant="captionStrong12" testID="pitch-name" numberOfLines={1} ellipsizeMode="tail" style={{ maxWidth: '100%', textAlign: 'center' }}>
        {pitchName(p.name)}
      </Text71>
    </>
  );
  const style = { alignItems: 'center' as const, gap: layout.lineupNameGap, maxWidth: '100%' as const };
  return onPress ? (
    <Touchable testID="pitch-player" accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={style}>
      {body}
    </Touchable>
  ) : (
    <View testID="pitch-player" accessible accessibilityLabel={label} style={style}>
      {body}
    </View>
  );
}

function Lines() {
  const line = { borderWidth: 1, borderColor: colors.surface20 } as const;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <View style={{ position: 'absolute', top: layout.pitchLinePad, left: layout.pitchLinePad, right: layout.pitchLinePad, bottom: layout.pitchLinePad, ...line }} />
      <View style={{ position: 'absolute', left: layout.pitchLinePad, right: layout.pitchLinePad, top: '50%', height: 1, backgroundColor: colors.surface20 }} />
      <View
        style={{
          position: 'absolute',
          alignSelf: 'center',
          top: '50%',
          marginTop: -layout.pitchCircle / 2,
          width: layout.pitchCircle,
          height: layout.pitchCircle,
          borderRadius: layout.pitchCircle / 2,
          ...line,
        }}
      />
      <View style={{ position: 'absolute', alignSelf: 'center', top: layout.pitchLinePad, width: layout.pitchBox.width, height: layout.pitchBox.height, ...line }} />
      <View style={{ position: 'absolute', alignSelf: 'center', bottom: layout.pitchLinePad, width: layout.pitchBox.width, height: layout.pitchBox.height, ...line }} />
    </View>
  );
}

const gapBefore = (positions: number[], i: number) => (positions[i] ?? 0) - (i === 0 ? 0 : (positions[i - 1] ?? 0));

export function Pitch({ rows, ratings, ratingValues, photos, missing, onPlayer, goals = {} }: PitchProps) {
  // Guarda-redes em baixo: as linhas ao contrário e as colunas espelhadas.
  const shown = [...rows].reverse().map((r) => [...r].reverse());
  // Cada linha no seu sítio do relvado (médios no meio-campo); os espaços entre linhas são a diferença de posições.
  const positions = pitchRowPositions(shown.length);
  return (
    <View
      testID="pitch"
      style={{
        width: '100%',
        aspectRatio: layout.pitchField.width / layout.pitchField.height,
        borderRadius: radii.r16,
        overflow: 'hidden',
        backgroundColor: colors.pitchField,
      }}
    >
      <Lines />
      {missing ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.s16 }}>
          <Text71 variant="body14" color="textMuted" style={{ textAlign: 'center' }}>{NO_XI}</Text71>
        </View>
      ) : (
        <View style={{ flex: 1, padding: layout.pitchFieldPad }}>
          {shown.map((row, i) => (
            <Fragment key={i}>
              <View style={{ flex: gapBefore(positions, i) }} />
              <View
                testID="pitch-row"
                style={{ flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-start' }}
              >
                {row.map((p, j) => (
                  <View key={`${p.playerId}-${j}`} style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
                    <Player
                      p={p}
                      rating={ratings[p.playerId]}
                      value={ratingValues[p.playerId]}
                      photo={photos[p.playerId]}
                      goals={goals[p.playerId] ?? 0}
                      onPress={onPlayer ? () => onPlayer(p.playerId) : undefined}
                    />
                  </View>
                ))}
              </View>
            </Fragment>
          ))}
          <View style={{ flex: 1 - (positions[positions.length - 1] ?? 1) }} />
        </View>
      )}
    </View>
  );
}
