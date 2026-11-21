// 21/11 (Martim, Figma 35c 5059:18714): no Calendário a competição numa linha, "jornada · data" por baixo, emblemas 40 e
// nomes 18 a partir de 375 pt (abaixo, como antes); nas jornadas da Competição nada muda.
// Figma V7.1: linha de jogo do Calendário e das jornadas (4948:8278, revista 20/11): por cima, centrada, a data em Badge 11
// text-subtle e (com `showCompetition`, no Calendário) a competição e a jornada/fase a primary-on-dark; por baixo nome +
// emblema da casa alinhados à direita, caixa central surface-10 de 58 pt com a hora ou o resultado (Label 16) e emblema +
// nome de fora, emblemas de 32 pt e nomes em Body 16; separador de 1 pt por baixo.
// SEM FIGMA: "Adiado"/"Cancelado" na caixa central no lugar da hora (palavras de `stateLabel`, as mesmas do GameHeader); o
// desempate por penáltis por baixo da caixa (`penaltiesText`); o rótulo de acessibilidade que resume a linha, com a
// competição e a jornada (o frame já não as mostra). Os nomes levam reticências numa linha: a 320 pt a caixa e a data
// ficam fixas e os nomes cedem.
// A linha só é botão quando recebe `onPress`: as jornadas têm jogos sem Sporting, que não têm documento em
// `matches/{id}` e portanto não abrem o detalhe.
import { useWindowDimensions, View } from 'react-native';
import { TeamCrest, type TeamVM } from '@/components/GameHeader';
import { Touchable } from '@/components/Touchable';
import type { Match } from '@/data/schemas';
import { penaltiesText, scoreText, stateLabel, toGameHeaderVM } from '@/lib/matchVM';
import { formatRowDate, formatTime } from '@/lib/ptDate';
import { Text71 } from '@/theme/typography';
import { colors, layout, space } from '@/theme/tokens';

function TeamSide({ team, side, large }: { team: TeamVM; side: 'home' | 'away'; large: boolean }) {
  const crest = <TeamCrest team={team} size={large ? 'rowL' : 'row'} testID={`row-crest-${side}`} />;
  const name = (
    <Text71
      variant={large ? 'body18' : 'body16'}
      numberOfLines={1}
      adjustsFontSizeToFit={large}
      minimumFontScale={large ? layout.matchRowNameMinScale : undefined}
      ellipsizeMode="tail"
      style={{ flexShrink: 1, minWidth: 0, textAlign: side === 'home' ? 'right' : 'left' }}
    >
      {team.name}
    </Text71>
  );
  return (
    <View
      style={{
        flex: 1,
        flexBasis: 0,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: side === 'home' ? 'flex-end' : 'flex-start',
        gap: large ? layout.matchRowSideGapL : layout.matchRowSideGap,
      }}
    >
      {side === 'home' ? name : crest}
      {side === 'home' ? crest : name}
    </View>
  );
}

/**
 * A linha lê-se de uma vez: equipas (com o resultado, quando há), competição com jornada e estado.
 * Ex.: "Sporting CP 3-0 SC Braga. Liga Portugal, J16. Terminado".
 */
function rowLabel(match: Match, vm: ReturnType<typeof toGameHeaderVM>): string {
  const score = scoreText(match);
  const teams = score
    ? `${vm.home.name} ${score} ${vm.away.name}`
    : `${vm.home.name} contra ${vm.away.name}`;
  const competition = vm.round ? `${vm.competitionName}, ${vm.round}` : vm.competitionName;
  return [teams, competition, stateLabel(vm.state)].join('. ');
}

/** 21/11: a linha do Calendário cresce (emblemas 40, nomes 18) só a partir de 375 pt de largura. */
export function rowIsLarge(width: number): boolean {
  return width >= layout.matchRowLargeFrom;
}

export function MatchRow({ match, onPress, showCompetition = false }: { match: Match; onPress?: (id: string) => void; showCompetition?: boolean }) {
  // O view-model da Task 4 dá a competição em pt-PT, os emblemas (Sporting sempre com o local) e o
  // resultado já filtrado (null antes do jogo, adiado ou cancelado).
  const vm = toGameHeaderVM(match);
  const offText =
    vm.state === 'postponed' || vm.state === 'cancelled' ? stateLabel(vm.state) : null;
  const label = rowLabel(match, vm);
  const score = vm.score ?? null;
  const pen = score && match.score.penalty;
  const date = formatRowDate(match.kickoff);
  const time = formatTime(match.kickoff);

  // 21/11 (Martim, Figma 35c): no Calendário, emblemas 40 e nomes 18 a partir de 375 pt; abaixo ficam 32 e 16.
  const { width } = useWindowDimensions();
  const large = showCompetition && rowIsLarge(width);
  const dateText = `${date.day} ${date.month}`.toUpperCase();

  const content = (
    <View
      style={{
        alignItems: 'center',
        gap: space.s8,
        paddingVertical: layout.matchRowPadY,
        borderBottomWidth: layout.separator,
        borderBottomColor: colors.separator,
      }}
    >
      {/* 21/11 (Martim, Figma 35c): no Calendário a competição numa linha e "jornada · data" por baixo (jornada a verde);
          fora do Calendário só a data. */}
      <View testID="row-date" style={{ alignItems: 'center', gap: space.s4, maxWidth: '100%' }}>
        {showCompetition ? (
          <Text71 testID="row-competition" variant="badge11" color="white" numberOfLines={1}>{vm.competitionName.toUpperCase()}</Text71>
        ) : null}
        <Text71 testID="row-round-date" variant="badge11" color="textSubtle" numberOfLines={1}>
          {showCompetition && vm.round ? (
            <>
              <Text71 variant="badge11" color="primaryOnDark">{vm.round.toUpperCase()}</Text71>
              {` · ${dateText}`}
            </>
          ) : (
            dateText
          )}
        </Text71>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: large ? layout.matchRowGapL : space.s8, alignSelf: 'stretch' }}>
      <TeamSide team={vm.home} side="home" large={large} />
      <View testID="row-center" style={{ width: large ? layout.matchRowCenterL : layout.matchRowCenter, flexShrink: 0, alignItems: 'center', gap: space.s4 }}>
        <View
          style={{
            alignSelf: 'stretch',
            alignItems: 'center',
            paddingHorizontal: layout.matchRowCenterPadX,
            paddingVertical: layout.matchRowCenterPadY,
            borderRadius: layout.matchRowCenterRadius,
            backgroundColor: colors.surface10,
          }}
        >
          {offText ? (
            <Text71 variant="badge11" testID="row-state" numberOfLines={1}>{offText}</Text71>
          ) : score ? (
            <Text71 variant="label16" testID="row-score" numberOfLines={1}>{`${score.home}-${score.away}`}</Text71>
          ) : (
            <Text71 variant="label16" testID="row-time" numberOfLines={1}>{time}</Text71>
          )}
        </View>
        {pen && pen.home != null && pen.away != null ? (
          <Text71 variant="badge11" color="textMuted" numberOfLines={1}>{penaltiesText(pen.home, pen.away)}</Text71>
        ) : null}
      </View>
      <TeamSide team={vm.away} side="away" large={large} />
      </View>
    </View>
  );

  if (!onPress) {
    return (
      <View testID={`match-row-${match.id}`} accessible accessibilityLabel={label}>
        {content}
      </View>
    );
  }
  return (
    <Touchable
      testID={`match-row-${match.id}`}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      feedback="scale"
      onPress={() => onPress(match.id)}
    >
      {content}
    </Touchable>
  );
}
