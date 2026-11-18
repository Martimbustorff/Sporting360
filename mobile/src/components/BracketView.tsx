// SEM FIGMA: quadro das eliminatórias, composto com tokens e com as peças da tabela (500:29367) e da Agenda (500:28822).
// Cada fase tem o título numa SectionBar ("Oitavos de final", `stage.label` do servidor, ou o texto original se a
// ronda não se reconhece). Cada eliminatória é um cartão surface10 (raio md) com as duas equipas (emblema pequeno,
// nome numa linha com reticências, golos do agregado à direita), por baixo as mãos ("1.ª mão 2-1", penáltis
// "(4-3 g.p.)" via `penaltiesText`, ou a data e hora em Europe/Lisbon se ainda não se jogou) e o "Agregado 3-2"
// nas eliminatórias a duas mãos. O resultado de cada mão lê-se do lado de `tie.home`, orientado por `leg.homeId`
// quando o doc o tem (`legScoreText`). Vencedor a destaque: nome em SemiBold e o outro a 70 %. A eliminatória da
// equipa destacada (Sporting) leva contorno primary. Agregado e vencedor vêm do servidor (`Tie`), nunca se
// recalculam (F11).
import { View } from 'react-native';
import { TeamCrest } from '@/components/GameHeader';
import { SectionBar } from '@/components/SectionBar';
import type { Bracket, Tie, TeamRef } from '@/data/schemas';
import { aggregateText, legScoreText } from '@/lib/standings';
import { formatKickoffDate, formatTime } from '@/lib/ptDate';
import { Body, Display } from '@/theme/typography';
import { colors, fonts, layout, radius, spacing } from '@/theme/tokens';

function TeamLine({ tie, team, goals }: { tie: Tie; team: TeamRef; goals: number | null }) {
  const decided = tie.winnerTeamId !== null;
  const winner = tie.winnerTeamId === team.id;
  return (
    <View
      testID={`tie-team-${tie.id}-${team.id}`}
      accessible
      accessibilityState={{ selected: winner }}
      accessibilityLabel={winner ? `${team.name}, apurado` : team.name}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: layout.tieTeamGap,
        opacity: decided && !winner ? layout.mutedOpacity : 1,
      }}
    >
      <TeamCrest team={{ name: team.name, crestUrl: team.logo, id: Number(team.id) || null }} size="sm" />
      <Body
        variant="body"
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[{ flex: 1 }, winner ? { fontFamily: fonts.bodySemiBold } : null]}
      >
        {team.name}
      </Body>
      <Display variant="tableValue" style={{ width: layout.tieScoreWidth, flexShrink: 0 }}>
        {goals ?? ''}
      </Display>
    </View>
  );
}

/** Resultado da mão ou, por jogar, a data e hora em Europe/Lisbon ("7 Abr 20:00"). */
function legValue(tie: Tie, leg: Tie['legs'][number], i: number): string {
  const score = legScoreText(leg, i, tie.home.id);
  if (score) return score;
  const d = new Date(leg.kickoff);
  return Number.isNaN(d.getTime()) ? '' : `${formatKickoffDate(d)} ${formatTime(d)}`;
}

function TieCard({ tie, highlight }: { tie: Tie; highlight: boolean }) {
  const agg = aggregateText(tie);
  return (
    <View
      testID={`tie-${tie.id}`}
      style={{
        backgroundColor: colors.surface10,
        borderRadius: radius.md,
        borderWidth: layout.tieBorder,
        borderColor: highlight ? colors.primary : colors.surface10,
        padding: spacing.md,
        gap: spacing.sm,
      }}
    >
      <TeamLine tie={tie} team={tie.home} goals={tie.aggregate?.home ?? null} />
      <TeamLine tie={tie} team={tie.away} goals={tie.aggregate?.away ?? null} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md }}>
        {tie.legs.map((leg, i) => (
          <View key={`${leg.matchId}-${i}`} style={{ flexDirection: 'row', gap: spacing.xs }}>
            {tie.legs.length > 1 ? (
              <Body variant="badgeSmall" style={{ color: colors.textMuted }}>{`${i + 1}.ª mão`}</Body>
            ) : null}
            <Body testID={`tie-leg-${tie.id}-${i}`} variant="badgeSmall">
              {legValue(tie, leg, i)}
            </Body>
          </View>
        ))}
        {agg && tie.legs.length > 1 ? (
          <Body variant="badgeSmall">{`Agregado ${agg}`}</Body>
        ) : null}
      </View>
    </View>
  );
}

export function BracketView({ bracket, highlightTeamId }: { bracket: Bracket; highlightTeamId: string }) {
  return (
    <View testID="bracket-view" style={{ gap: spacing.lg }}>
      {bracket.stages
        .filter((s) => s.ties.length > 0)
        .map((s, si) => (
          <View key={`${si}-${s.raw}`} style={{ gap: spacing.md }}>
            <SectionBar label={s.label || s.raw} />
            {s.ties.map((t, ti) => (
              <TieCard
                key={`${t.id}-${ti}`}
                tie={t}
                highlight={t.home.id === highlightTeamId || t.away.id === highlightTeamId}
              />
            ))}
          </View>
        ))}
    </View>
  );
}
