// Figma V7.1: frame 4935:7111 (tabela 4935:7287). Cabeçalho "# EQUIPA J DG PTS" (Eyebrow 13 text-subtle), linhas com faixa
// de zona de 3 pt à esquerda (Liga dos Campeões, Liga Europa, Conference, lida de `description`), emblema 18x21, nome Body 14
// (Strong 14 no Sporting), J e DG Body 14 text-muted, PTS Label 16; a linha do Sporting com fundo surface-10 e raio 8, e a
// legenda das zonas por baixo. Ao vivo: seta de subida/descida ao lado da posição e "AO VIVO 2-1" (Badge 11) sob o nome.
// Diferenças deliberadas: o Figma mostra o emblema da API como círculo cinzento; aqui é o emblema real (TeamCrest) e, sem
// emblema, o espaço fica vazio. Linhas sem zona levam a divisória text-separator por baixo (como no Figma).
// SEM FIGMA: nome do grupo (SectionBar) quando há mais de um; o rótulo de acessibilidade de cada linha; a legenda só mostra
// as zonas que existem na tabela.
import { View } from 'react-native';
import { TeamCrest } from '@/components/GameHeader';
import { SectionBar } from '@/components/SectionBar';
import type { Sport, StandingRow, StandingsDoc } from '@/data/schemas';
import { zoneOf, type Zone } from '@/lib/liveStandings';
import { Display, Text71 } from '@/theme/typography';
import { colors, layout, radii, space } from '@/theme/tokens';

const PODIUM: Record<number, string> = { 1: colors.positionCircle, 2: colors.positionSilver, 3: colors.positionBronze };

const ZONE_COLOR: Record<Zone, string> = { champions: colors.zoneChampions, europa: colors.zoneEurope, conference: colors.zoneConference };
const ZONE_LABEL: Record<Zone, string> = { champions: 'Liga dos Campeões', europa: 'Liga Europa', conference: 'Conference' };
const ZONE_ORDER: Zone[] = ['champions', 'europa', 'conference'];

/** Linha da tabela; `delta` e `liveScore` só vêm da classificação ao vivo (`projectStandings`). */
export type TableRow = StandingRow & { delta?: number; liveScore?: string | null };
export type TableGroup = { name: string; rows: TableRow[] };

const fixed = (width: number) => ({ width, flexShrink: 0 }) as const;

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

/** Seta de subida (primary-on-dark) ou descida (danger) de 8x6 (4935:7302). */
function Arrow({ up, testID }: { up: boolean; testID: string }) {
  const half = layout.stArrow.width / 2;
  return (
    <View
      testID={testID}
      style={{
        width: 0,
        height: 0,
        borderLeftWidth: half,
        borderRightWidth: half,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        ...(up
          ? { borderBottomWidth: layout.stArrow.height, borderBottomColor: colors.primaryOnDark }
          : { borderTopWidth: layout.stArrow.height, borderTopColor: colors.danger }),
      }}
    />
  );
}

const diffText = (n: number) => (n > 0 ? `+${n}` : String(n));

function Row({ row, highlight, sport }: { row: TableRow; highlight: boolean; sport: Sport | null }) {
  const zone = zoneOf(row.description);
  const live = row.liveScore ? `AO VIVO ${row.liveScore}` : null;
  const delta = row.delta ?? 0;
  return (
    <View
      testID={`standings-row-${row.teamId}`}
      accessible
      accessibilityState={{ selected: highlight }}
      accessibilityLabel={`${row.rank}.º ${row.name}, ${row.points} pontos, ${row.played} jogos${row.liveScore ? `, ao vivo ${row.liveScore}` : ''}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: layout.stRowPadY,
        paddingLeft: layout.stRowPadLeft - layout.stBand,
        paddingRight: layout.stRowPadRight,
        borderLeftWidth: layout.stBand,
        borderLeftColor: zone ? ZONE_COLOR[zone] : 'transparent',
        borderBottomWidth: zone || highlight ? 0 : layout.separator,
        borderBottomColor: colors.separator,
        borderRadius: highlight ? radii.r8 : 0,
        backgroundColor: highlight ? colors.surface10 : undefined,
      }}
    >
      <View style={[fixed(layout.stColPos), { flexDirection: 'row', alignItems: 'center', gap: layout.stArrowGap }]}>
        <Text71 variant="label16" testID={`standings-rank-${row.teamId}`}>{row.rank}</Text71>
        {delta !== 0 ? <Arrow up={delta > 0} testID={`standings-arrow-${row.teamId}-${delta > 0 ? 'up' : 'down'}`} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: layout.stCrestGap }}>
        <TeamCrest
          // Só no futebol o id é da API-Football (228 = Sporting, emblema local); nas outras modalidades é da
          // api-sports e um 228 seria outra equipa: fica o emblema do documento.
          team={{ id: sport === 'football' ? Number(row.teamId) || null : null, name: row.name, crestUrl: row.logo }}
          size="form"
          testID={`standings-crest-${row.teamId}`}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text71 variant={highlight ? 'strong14' : 'body14'} numberOfLines={1} ellipsizeMode="tail">
            {row.name}
          </Text71>
          {live ? (
            <Text71 variant="badge11" color="primaryOnDark" testID={`standings-live-${row.teamId}`} numberOfLines={1}>
              {live}
            </Text71>
          ) : null}
        </View>
      </View>
      <Text71 variant="body14" color="textMuted" numberOfLines={1} style={[fixed(layout.stColPlayed), { textAlign: 'right' }]}>
        {row.played}
      </Text71>
      <Text71 variant="body14" color="textMuted" numberOfLines={1} style={[fixed(layout.stColDiff), { textAlign: 'right' }]}>
        {diffText(row.goalsDiff)}
      </Text71>
      <Text71
        variant="label16"
        testID={`standings-points-${row.teamId}`}
        numberOfLines={1}
        style={[fixed(layout.stColPts), { textAlign: 'right' }]}
      >
        {row.points}
      </Text71>
    </View>
  );
}

function HeadRow() {
  const col = (width: number, label: string, right = true) => (
    <Text71 variant="eyebrow13" color="textSubtle" numberOfLines={1} style={[fixed(width), right ? { textAlign: 'right' } : undefined]}>
      {label}
    </Text71>
  );
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: layout.stHeadPadY, paddingLeft: layout.stRowPadLeft, paddingRight: layout.stRowPadRight }}
    >
      {col(layout.stColPos, '#', false)}
      <Text71 variant="eyebrow13" color="textSubtle" numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>Equipa</Text71>
      {col(layout.stColPlayed, 'J')}
      {col(layout.stColDiff, 'DG')}
      {col(layout.stColPts, 'PTS')}
    </View>
  );
}

/** Legenda das zonas (4935:7413), só as que existem na tabela. */
function Legend({ zones }: { zones: Zone[] }) {
  if (zones.length === 0) return null;
  return (
    <View testID="standings-legend" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: layout.stLegendGap }}>
      {zones.map((z) => (
        <View key={z} style={{ flexDirection: 'row', alignItems: 'center', gap: layout.stLegendItemGap }}>
          <View style={{ width: layout.stLegendBar.width, height: layout.stLegendBar.height, backgroundColor: ZONE_COLOR[z] }} />
          <Text71 variant="caption12" color="textMuted">{ZONE_LABEL[z]}</Text71>
        </View>
      ))}
    </View>
  );
}

export function StandingsTable({
  groups,
  highlightTeamId,
  sport,
}: {
  groups: TableGroup[] | StandingsDoc['groups'];
  highlightTeamId: string;
  /** Modalidade da competição; null quando não se sabe (nunca o emblema local do Sporting). */
  sport: Sport | null;
}) {
  const shown = (groups as TableGroup[]).filter((g) => g.rows.length > 0);
  const named = shown.length > 1;
  const present = new Set(shown.flatMap((g) => g.rows.map((r) => zoneOf(r.description))));
  const zones = ZONE_ORDER.filter((z) => present.has(z));
  return (
    <View testID="standings-table" style={{ gap: layout.stContentGap }}>
      {shown.map((g, gi) => (
        <View key={`${gi}-${g.name}`}>
          {named && g.name ? (
            <View style={{ marginBottom: space.s12 }}>
              <SectionBar label={g.name} />
            </View>
          ) : null}
          <HeadRow />
          {g.rows.map((r, ri) => (
            <Row key={`${r.teamId}-${ri}`} row={r} highlight={r.teamId === highlightTeamId} sport={sport} />
          ))}
        </View>
      ))}
      <Legend zones={zones} />
    </View>
  );
}
