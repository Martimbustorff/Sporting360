// Figma V7.1: frame 37 "Taça, quadro" (4948:8461): pílulas das rondas (OITAVOS ativa em primary, 4948:8508) e, por baixo,
// os cartões das eliminatórias da ronda escolhida (4948:8517): surface-06, raio 12, 14/10, 8 entre linhas; a eliminatória do
// Sporting em surface-10 com contorno de 1 pt primary-on-dark. Cada linha: emblema 18, nome e golos (Label 16); o
// vencedor em Strong 14 branco, o outro (ou sem vencedor) em Body 14 muted. Por jogar: a data "SÁB 21 DEZ · 18:00" à
// direita da 1.ª linha. Penáltis na linha de baixo: "1 (4-2 g.p.)".
// SEM FIGMA: as eliminatórias a duas mãos (agregado do servidor na coluna e, por baixo, "1.ª mão 2-1" e "Agregado 3-2");
// a ronda aberta por defeito (a do Sporting, senão a primeira por decidir, senão a última); o rótulo curto das pílulas
// (o `label` do servidor sem " de final"); a ronda por baixo nunca se perde ao mudar os dados. Agregado e vencedor vêm do
// servidor (`Tie`), nunca se recalculam (F11).
import { useState } from 'react';
import { View } from 'react-native';
import { Chips } from '@/components/Chips';
import { TeamCrest } from '@/components/GameHeader';
import type { Bracket, Tie, TeamRef } from '@/data/schemas';
import { formatRowDate, formatTime } from '@/lib/ptDate';
import { aggregateText, legScoreText, legSides } from '@/lib/standings';
import { Text71 } from '@/theme/typography';
import { colors, layout, space } from '@/theme/tokens';

type Stage = Bracket['stages'][number];

/** Resultado da mão ou, por jogar, a data e hora em Europe/Lisbon ("SÁB 21 DEZ · 18:00"). */
function legValue(tie: Tie, leg: Tie['legs'][number], i: number): string {
  const score = legScoreText(leg, i, tie.home.id);
  if (score) return score;
  const d = new Date(leg.kickoff);
  if (Number.isNaN(d.getTime())) return '';
  const r = formatRowDate(d);
  return `${r.day} ${r.month} · ${formatTime(d)}`;
}

function TeamLine({
  tie,
  team,
  score,
  trailing,
}: {
  tie: Tie;
  team: TeamRef;
  /** Golos (ou agregado) desta equipa; null = por jogar. */
  score: string | null;
  /** Texto à direita no lugar do golo (data, se por jogar). */
  trailing?: { text: string; testID: string };
}) {
  const winner = tie.winnerTeamId === team.id;
  return (
    <View
      testID={`tie-team-${tie.id}-${team.id}`}
      accessible
      accessibilityState={{ selected: winner }}
      accessibilityLabel={winner ? `${team.name}, apurado` : team.name}
      style={{ flexDirection: 'row', alignItems: 'center', gap: layout.tieTeamGap }}
    >
      <TeamCrest team={{ name: team.name, crestUrl: team.logo, id: Number(team.id) || null }} size="form" />
      <Text71
        variant={winner ? 'strong14' : 'body14'}
        color={winner ? 'white' : 'textMuted'}
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{ flex: 1, minWidth: 0 }}
      >
        {team.name}
      </Text71>
      {trailing ? (
        <Text71 variant="label16" color="textMuted" numberOfLines={1} testID={trailing.testID} style={{ flexShrink: 0 }}>
          {trailing.text}
        </Text71>
      ) : score !== null ? (
        <Text71
          variant="label16"
          color={winner ? 'white' : 'textMuted'}
          numberOfLines={1}
          testID={`tie-score-${tie.id}-${team.id}`}
          style={{ flexShrink: 0 }}
        >
          {score}
        </Text71>
      ) : null}
    </View>
  );
}

function TieCard({ tie, highlight }: { tie: Tie; highlight: boolean }) {
  const agg = aggregateText(tie);
  const single = tie.legs.length <= 1;
  const leg = tie.legs[0];
  const sides = single && leg ? legSides(leg, 0, tie.home.id) : null;
  const unplayed = single && leg && !sides ? legValue(tie, leg, 0) : '';
  const hasPen = sides !== null && sides.penHome !== null && sides.penAway !== null;
  const homeScore = single ? (sides ? String(sides.home) : null) : (tie.aggregate?.home ?? null) !== null ? String(tie.aggregate?.home) : null;
  const awayBase = single ? (sides ? String(sides.away) : null) : (tie.aggregate?.away ?? null) !== null ? String(tie.aggregate?.away) : null;
  // Penáltis do lado de `tie.away`: "1 (4-2 g.p.)" na linha de baixo.
  const awayScore =
    awayBase !== null && hasPen && sides ? `${awayBase} (${sides.penHome}-${sides.penAway} g.p.)` : awayBase;
  return (
    <View
      testID={`tie-${tie.id}`}
      style={{
        backgroundColor: highlight ? colors.surface10 : colors.surface06,
        borderRadius: layout.tieCardRadius,
        borderWidth: layout.tieBorder,
        borderColor: highlight ? colors.primaryOnDark : 'transparent',
        paddingHorizontal: layout.tieCardPadX,
        paddingVertical: layout.tieCardPadY,
        gap: layout.tieCardGap,
      }}
    >
      <TeamLine
        tie={tie}
        team={tie.home}
        score={homeScore}
        trailing={unplayed ? { text: unplayed, testID: `tie-leg-${tie.id}-0` } : undefined}
      />
      <TeamLine tie={tie} team={tie.away} score={awayScore} />
      {!single ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s12 }}>
          {tie.legs.map((l, i) => (
            <View key={`${l.matchId}-${i}`} style={{ flexDirection: 'row', gap: space.s4 }}>
              <Text71 variant="caption12" color="textSubtle">{`${i + 1}.ª mão`}</Text71>
              <Text71 variant="caption12" color="textMuted" testID={`tie-leg-${tie.id}-${i}`}>
                {legValue(tie, l, i)}
              </Text71>
            </View>
          ))}
          {agg ? <Text71 variant="caption12" color="textMuted">{`Agregado ${agg}`}</Text71> : null}
        </View>
      ) : null}
    </View>
  );
}

const shortLabel = (s: Stage): string => (s.label || s.raw).replace(/ de final$/i, '');

/** Ronda aberta por defeito: a do Sporting, senão a primeira por decidir, senão a última. */
function defaultStage(stages: Stage[], highlightTeamId: string): number {
  const own = stages.findIndex((s) => s.ties.some((t) => t.home.id === highlightTeamId || t.away.id === highlightTeamId));
  if (own >= 0) return own;
  const open = stages.findIndex((s) => s.ties.some((t) => t.winnerTeamId === null));
  return open >= 0 ? open : stages.length - 1;
}

export function BracketView({ bracket, highlightTeamId }: { bracket: Bracket; highlightTeamId: string }) {
  const stages = bracket.stages.filter((s) => s.ties.length > 0);
  const [picked, setPicked] = useState<string | null>(null);
  if (stages.length === 0) return <View testID="bracket-view" />;
  const keyOf = (s: Stage, i: number) => `${i}-${s.raw}`;
  const items = stages.map((s, i) => ({ key: keyOf(s, i), label: shortLabel(s) }));
  const current = picked && items.some((it) => it.key === picked) ? picked : items[defaultStage(stages, highlightTeamId)]!.key;
  const stage = stages[items.findIndex((it) => it.key === current)]!;
  return (
    <View testID="bracket-view" style={{ gap: space.s12 }}>
      <Chips items={items} value={current} onChange={setPicked} tone="primary" testIDPrefix="stage" />
      {stage.ties.map((t, ti) => (
        <TieCard
          key={`${t.id}-${ti}`}
          tie={t}
          highlight={t.home.id === highlightTeamId || t.away.id === highlightTeamId}
        />
      ))}
    </View>
  );
}
