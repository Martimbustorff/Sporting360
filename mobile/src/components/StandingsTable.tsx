// Figma: nós 500:29367 (jogo futuro) e 489:7432 (ao vivo): cabeçalho "# EQUIPA J V E D G P" (500:29409, DIN 18 a
// 60 %), divisória de 1 px a 20 % (500:29415), linha de 34 px (500:29416) com o círculo da posição de 26 px
// (1.º 500:29423 amarelo, 2.º 500:29433 prata, 3.º 500:29443 bronze, restantes sem fundo e número a branco),
// nome em SemiBold 12 (500:29419, `tableTeam`) e valores DIN 20 (500:29420); golos "8:4" (500:29421).
// Variante 500:30076: emblema de cada equipa à esquerda do nome (29x34 no Figma, `TeamCrest` sm de 30x35, 8 px
// de intervalo, 500:30126/500:30127); o Sporting usa sempre o emblema local 2026 (id 228).
// Diferenças deliberadas: colunas em flex (largura fixa por coluna, nome com flex 1) em vez de posições absolutas;
// da 500:30076 só se tira o emblema: as colunas J/V/E/D/G/P, a tipografia e o círculo ficam os de 500:29367 (a
// variante só tem PJ/G/P, noutra fonte), por isso o nome fica mais curto e corta com reticências.
// SEM FIGMA: nome do grupo (SectionBar) quando há mais de um; a linha do Sporting com fundo surface10 e raio sm;
// o rótulo de acessibilidade de cada linha.
import { View } from 'react-native';
import { TeamCrest } from '@/components/GameHeader';
import { SectionBar } from '@/components/SectionBar';
import type { StandingRow, StandingsDoc } from '@/data/schemas';
import { goalsText } from '@/lib/standings';
import { Body, Display } from '@/theme/typography';
import { colors, layout, radius, spacing } from '@/theme/tokens';

const PODIUM: Record<number, string> = { 1: colors.positionCircle, 2: colors.positionSilver, 3: colors.positionBronze };

const COLUMNS = [
  { key: 'J', width: layout.tableColWidth },
  { key: 'V', width: layout.tableColWidth },
  { key: 'E', width: layout.tableColWidth },
  { key: 'D', width: layout.tableColWidth },
  { key: 'G', width: layout.tableGoalsWidth },
  { key: 'P', width: layout.tablePointsWidth },
] as const;

const fixed = (width: number) => ({ width, flexShrink: 0 }) as const;

function Separator() {
  return <View style={{ height: layout.separator, backgroundColor: colors.surface20 }} />;
}

/** Círculo da posição (500:29423): 1.º a 3.º com fundo de pódio, os outros só o número a branco. Também nos tops. */
export function PositionCircle({ rank }: { rank: number }) {
  const bg = PODIUM[rank];
  return (
    <View
      style={{
        ...fixed(layout.positionCircle),
        height: layout.positionCircle,
        borderRadius: layout.positionCircle / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Display variant="tablePosition" style={bg ? undefined : { color: colors.white }}>
        {rank}
      </Display>
    </View>
  );
}

function Row({ row, highlight }: { row: StandingRow; highlight: boolean }) {
  const values = [row.played, row.win, row.draw, row.lose, goalsText(row), row.points];
  return (
    <View
      testID={`standings-row-${row.teamId}`}
      accessible
      accessibilityState={{ selected: highlight }}
      accessibilityLabel={`${row.rank}.º ${row.name}, ${row.points} pontos, ${row.played} jogos`}
      style={{
        height: layout.tableRowHeight,
        flexDirection: 'row',
        alignItems: 'center',
        gap: layout.tableNameGap,
        borderRadius: radius.sm,
        backgroundColor: highlight ? colors.surface10 : undefined,
      }}
    >
      <PositionCircle rank={row.rank} />
      <TeamCrest
        team={{ id: Number(row.teamId) || null, name: row.name, crestUrl: row.logo }}
        size="sm"
        testID={`standings-crest-${row.teamId}`}
      />
      <Body variant="tableTeam" numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1 }}>
        {row.name}
      </Body>
      <View style={{ flexDirection: 'row', flexShrink: 0 }}>
        {COLUMNS.map((c, i) => (
          <Display
            key={c.key}
            variant="tableValue"
            testID={c.key === 'P' ? `standings-points-${row.teamId}` : undefined}
            numberOfLines={1}
            style={fixed(c.width)}
          >
            {values[i]}
          </Display>
        ))}
      </View>
    </View>
  );
}

function HeadRow() {
  const head = { opacity: layout.tableHeadOpacity };
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', alignItems: 'center', gap: layout.tableNameGap, marginBottom: layout.tableHeadGap }}
    >
      <Display variant="tableHead" style={[head, fixed(layout.positionCircle), { textAlign: 'center' }]}>#</Display>
      {/* "Equipa" começa sobre o emblema, como em 500:30119. */}
      <Display variant="tableHead" style={[head, { flex: 1 }]}>Equipa</Display>
      <View style={{ flexDirection: 'row', flexShrink: 0 }}>
        {COLUMNS.map((c) => (
          <Display key={c.key} variant="tableHead" style={[head, fixed(c.width), { textAlign: 'center' }]}>
            {c.key}
          </Display>
        ))}
      </View>
    </View>
  );
}

export function StandingsTable({ groups, highlightTeamId }: { groups: StandingsDoc['groups']; highlightTeamId: string }) {
  const shown = groups.filter((g) => g.rows.length > 0);
  const named = shown.length > 1;
  return (
    <View testID="standings-table" style={{ gap: spacing.lg }}>
      {shown.map((g, gi) => (
        <View key={`${gi}-${g.name}`}>
          {named && g.name ? (
            <View style={{ marginBottom: spacing.md }}>
              <SectionBar label={g.name} />
            </View>
          ) : null}
          <HeadRow />
          {g.rows.map((r, ri) => (
            <View key={`${r.teamId}-${ri}`} style={{ gap: layout.tableRowGap, paddingBottom: layout.tableRowGap }}>
              <Separator />
              <Row row={r} highlight={r.teamId === highlightTeamId} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
