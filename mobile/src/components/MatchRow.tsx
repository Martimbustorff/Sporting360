// Figma V7.1: linha de jogo do Calendário e das jornadas (4948:8278, resultado 4948:8397): data em duas linhas (dia da semana
// e número em Badge 11 a text-subtle, mês em Caption Strong a muted), nome + emblema da casa alinhados à direita, caixa
// central surface-10 de 58 pt com a hora ou o resultado (Label 16) e emblema + nome de fora; separador de 1 pt por baixo
// (`separator`, no fim da linha).
// SEM FIGMA: "Adiado"/"Cancelado" na caixa central no lugar da hora (palavras de `stateLabel`, as mesmas do GameHeader); o
// desempate por penáltis por baixo da caixa (`penaltiesText`); o rótulo de acessibilidade que resume a linha, com a
// competição e a jornada (o frame já não as mostra). Os nomes levam reticências numa linha: a 320 pt a caixa e a data
// ficam fixas e os nomes cedem.
// A linha só é botão quando recebe `onPress`: as jornadas têm jogos sem Sporting, que não têm documento em
// `matches/{id}` e portanto não abrem o detalhe.
import { View } from 'react-native';
import { TeamCrest, type TeamVM } from '@/components/GameHeader';
import { Touchable } from '@/components/Touchable';
import type { Match } from '@/data/schemas';
import { penaltiesText, scoreText, stateLabel, toGameHeaderVM } from '@/lib/matchVM';
import { formatRowDate, formatTime } from '@/lib/ptDate';
import { Text71 } from '@/theme/typography';
import { colors, layout, space } from '@/theme/tokens';

function TeamSide({ team, side }: { team: TeamVM; side: 'home' | 'away' }) {
  const crest = <TeamCrest team={team} size="row" testID={`row-crest-${side}`} />;
  const name = (
    <Text71
      variant="body14"
      numberOfLines={1}
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
        gap: layout.matchRowSideGap,
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

export function MatchRow({ match, onPress }: { match: Match; onPress?: (id: string) => void }) {
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

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s8,
        paddingVertical: layout.matchRowPadY,
        borderBottomWidth: layout.separator,
        borderBottomColor: colors.separator,
      }}
    >
      <View testID="row-date" style={{ width: layout.matchRowDate, flexShrink: 0, gap: layout.matchRowDateGap }}>
        <Text71 variant="badge11" color="textSubtle" numberOfLines={1}>{date.day}</Text71>
        <Text71 variant="captionStrong12" color="textMuted" numberOfLines={1}>{date.month}</Text71>
      </View>
      <TeamSide team={vm.home} side="home" />
      <View testID="row-center" style={{ width: layout.matchRowCenter, flexShrink: 0, alignItems: 'center', gap: space.s4 }}>
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
      <TeamSide team={vm.away} side="away" />
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
      onPress={() => onPress(match.id)}
    >
      {content}
    </Touchable>
  );
}
