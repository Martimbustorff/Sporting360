// SEM FIGMA: o Figma não tem frame da equipa (Mapa do Figma do Plano 4). Compõe Header, `Tabs` (500:28814 /
// 500:28976, modo 'scroll'), `SectionBar` (655:31905) e as linhas de `TeamRows` (como os tops da competição, Task 13):
// - Plantel: treinador no topo, "Indisponíveis" (`injuries`, um por jogador) e grupos por posição (guarda-redes,
//   defesas, médios, avançados), por número; cada jogador abre `/equipa/jogador/{id}` (id da API-Football).
// - Estatísticas: competições da época (`Tabs` 'scroll', liga, taças, europeias); forma em quadrados V/E/D como no
//   pré-jogo (Task 9); golos marcados e sofridos em casa e fora e jogos sem sofrer numa grelha Casa/Fora/Total;
//   golos por período de 0-15 a 76-90; tabela de jogadores da época por golos (J, Min, G, A, Nota), com a cabeça
//   em DIN 18 a 60 % como a Classificação (500:29409).
// - Transferências: etiqueta "Entrada" (primary) ou "Saída" (surface20) como o selo pequeno (500:28830), emblema e
//   nome do outro clube, data pt-PT e tipo à direita.
// - Troféus: os do treinador e os jogadores com troféus (com o total), ligados ao detalhe.
// Cada tab lê só os seus documentos; uma leitura falhada mostra o erro, nunca o vazio.
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { EmptyState } from '@/components/EmptyState';
import { TeamCrest } from '@/components/GameHeader';
import { Header } from '@/components/Header';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Screen } from '@/components/Screen';
import { SectionBar } from '@/components/SectionBar';
import { Tabs } from '@/components/Tabs';
import { PersonRow, RowSeparator, TextRow } from '@/components/TeamRows';
import { useNow } from '@/data/clock';
import type { Loadable } from '@/data/hooks';
import type { Transfer } from '@/data/schemas';
import { usePlayerStats, useSeasonFootballCompetitions, useTeamData, useTeamStats } from '@/data/sports';
import { footballSeason } from '@/lib/periods';
import { injuryText, type FormLetter } from '@/lib/prematch';
import {
  calendarDateText,
  groupSquad,
  playersByGoals,
  playersWithTrophies,
  ratingText,
  seasonLabel,
  teamStatsVM,
  transferTypeLabel,
  trophyPlaceText,
  unavailablePlayers,
  type Split,
} from '@/lib/team';
import { Body, Display } from '@/theme/typography';
import { colors, layout, radius, spacing } from '@/theme/tokens';

type TabKey = 'plantel' | 'estatisticas' | 'transferencias' | 'trofeus';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'plantel', label: 'Plantel' },
  { key: 'estatisticas', label: 'Estatísticas' },
  { key: 'transferencias', label: 'Transferências' },
  { key: 'trofeus', label: 'Troféus' },
];

const ERROR_TEXT = 'Não foi possível carregar os dados.';
const NO_SQUAD = 'Plantel ainda não disponível.';
const NO_COMPETITIONS = 'Sem competições nesta época.';
const NO_TEAM_STATS = 'Sem estatísticas para esta competição.';
const NO_PLAYER_STATS = 'Sem estatísticas de jogadores nesta época.';
const NO_TRANSFERS = 'Sem transferências registadas.';
const NO_TROPHIES = 'Sem troféus registados.';

const LETTER_BG: Record<FormLetter, string> = { V: colors.primary, E: colors.surface20, D: colors.cardRed };

type Reads = Loadable<unknown>[];
const anyLoading = (rs: Reads) => rs.some((r) => r.status === 'loading');
const anyError = (rs: Reads) => rs.some((r) => r.status === 'error');
const anyCache = (rs: Reads) => rs.some((r) => r.status === 'ready' && r.fromCache === true);
const dataOf = <T,>(l: Loadable<T>): T | null => (l.status === 'ready' ? l.data : null);
const openPlayer = (id: string) => router.push(`/equipa/jogador/${id}`);

/** SEM FIGMA: enquanto os dados não chegam, um espaço em branco (como na competição). */
const Loading = ({ testID }: { testID: string }) => <View testID={testID} />;

function TabScroll({ children }: { children: ReactNode }) {
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.screenX, paddingBottom: spacing.xl, gap: spacing.md }}>
      {children}
    </ScrollView>
  );
}

function List<T>({ items, keyOf, render }: { items: T[]; keyOf: (t: T, i: number) => string; render: (t: T) => ReactNode }) {
  return (
    <View>
      {items.map((it, i) => (
        <View key={keyOf(it, i)} style={{ gap: layout.tableRowGap, paddingBottom: layout.tableRowGap }}>
          {i > 0 ? <RowSeparator /> : null}
          {render(it)}
        </View>
      ))}
    </View>
  );
}

// --- Plantel ---------------------------------------------------------------------------------

function SquadTab() {
  const squad = useTeamData('squad');
  const coach = useTeamData('coach');
  const injuries = useTeamData('injuries');
  const reads = [squad, coach, injuries];
  if (anyLoading(reads)) return <Loading testID="squad-loading" />;
  if (anyError(reads)) return <EmptyState icon="info" text={ERROR_TEXT} />;
  const players = dataOf(squad)?.players ?? [];
  if (players.length === 0) return <EmptyState icon="info" text={NO_SQUAD} />;
  const c = dataOf(coach);
  const out = injuries.status === 'ready' ? unavailablePlayers(injuries.data) : [];
  return (
    <TabScroll>
      <OfflineBanner visible={anyCache(reads)} />
      {c ? (
        <>
          <SectionBar label="Treinador" />
          <PersonRow label={`Treinador: ${c.name}`} photo={c.photo} name={c.name} detail={c.nationality ?? undefined} />
        </>
      ) : null}
      {out.length > 0 ? (
        <>
          <SectionBar label="Indisponíveis" />
          <List
            items={out}
            keyOf={(i) => i.playerId}
            render={(i) => {
              const why = injuryText(i.type ?? '', i.reason ?? '');
              return (
                <PersonRow
                  label={why ? `${i.name}, ${why}` : i.name}
                  photo={i.photo}
                  name={i.name}
                  detail={why}
                  onPress={() => openPlayer(i.playerId)}
                />
              );
            }}
          />
        </>
      ) : null}
      {groupSquad(players).map((g) => (
        <View key={g.label} style={{ gap: spacing.md }}>
          <SectionBar label={g.label} />
          <List
            items={g.players}
            keyOf={(p) => p.id}
            render={(p) => (
              <PersonRow
                testID={`squad-row-${p.id}`}
                label={p.number === null ? p.name : `${p.number}, ${p.name}`}
                number={p.number}
                photo={p.photo}
                name={p.name}
                detail={p.age === null ? undefined : `${p.age} anos`}
                onPress={() => openPlayer(p.id)}
              />
            )}
          />
        </View>
      ))}
    </TabScroll>
  );
}

// --- Estatísticas ----------------------------------------------------------------------------

const head = { opacity: layout.tableHeadOpacity } as const;

/** Grelha: rótulo à esquerda e colunas de largura fixa (DIN 20). Com `isHead`, a cabeça em DIN 18 a 60 %. */
function GridRow({ label, values, widths, isHead, a11y }: { label: string; values: string[]; widths: number[]; isHead?: boolean; a11y?: string }) {
  return (
    <View
      accessible={!!a11y}
      accessibilityLabel={a11y}
      accessibilityElementsHidden={isHead}
      importantForAccessibility={isHead ? 'no-hide-descendants' : 'auto'}
      style={{ flexDirection: 'row', alignItems: 'center', minHeight: isHead ? undefined : layout.tableRowHeight, gap: layout.tableNameGap }}
    >
      {isHead ? (
        <Display variant="tableHead" numberOfLines={1} style={[head, { flex: 1 }]}>{label}</Display>
      ) : (
        <Body variant="tableTeam" numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1 }}>{label}</Body>
      )}
      {values.map((v, i) => (
        <Display
          key={i}
          variant={isHead ? 'tableHead' : 'tableValue'}
          numberOfLines={1}
          style={[isHead ? head : null, { width: widths[i], flexShrink: 0, textAlign: 'center' }]}
        >
          {v}
        </Display>
      ))}
    </View>
  );
}

function FormChips({ letters }: { letters: FormLetter[] }) {
  return (
    <View
      accessible
      accessibilityLabel={`Forma: ${letters.join(' ')}`}
      style={{ flexDirection: 'row', gap: layout.formChipGap, paddingHorizontal: spacing.md }}
    >
      {letters.map((l, i) => (
        <View
          key={i}
          style={{
            width: layout.formChip,
            height: layout.formChip,
            borderRadius: radius.sm,
            backgroundColor: LETTER_BG[l],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Body variant="badge">{l}</Body>
        </View>
      ))}
    </View>
  );
}

const SPLIT_W = [layout.statValueWidth, layout.statValueWidth, layout.statValueWidth];
const splitRow = (label: string, s: Split) => (
  <GridRow
    key={label}
    label={label}
    values={[String(s.home), String(s.away), String(s.total)]}
    widths={SPLIT_W}
    a11y={`${label}: casa ${s.home}, fora ${s.away}, total ${s.total}`}
  />
);

function TeamStatsBlock({ leagueId, season }: { leagueId: string; season: string }) {
  const stats = useTeamStats(leagueId, season);
  if (stats.status === 'loading') return <Loading testID="team-stats-loading" />;
  if (stats.status === 'error') return <EmptyState icon="info" text={ERROR_TEXT} />;
  const vm = stats.status === 'ready' ? teamStatsVM(stats.data) : null;
  if (!vm || vm.empty) return <EmptyState icon="info" text={NO_TEAM_STATS} />;
  const rows: [string, Split | null][] = [
    ['Marcados', vm.goalsFor],
    ['Sofridos', vm.goalsAgainst],
    ['Jogos sem sofrer', vm.cleanSheet],
  ];
  const shown = rows.filter((r): r is [string, Split] => r[1] !== null);
  return (
    <>
      <OfflineBanner visible={stats.status === 'ready' && stats.fromCache === true} />
      {vm.form.length > 0 ? (
        <>
          <SectionBar label="Forma" />
          <FormChips letters={vm.form} />
        </>
      ) : null}
      {shown.length > 0 ? (
        <>
          <SectionBar label="Golos" />
          <View style={{ paddingHorizontal: spacing.md, gap: layout.tableRowGap }}>
            <GridRow label="" values={['Casa', 'Fora', 'Total']} widths={SPLIT_W} isHead />
            {shown.map(([label, s]) => splitRow(label, s))}
          </View>
        </>
      ) : null}
      {vm.periods.length > 0 ? (
        <>
          <SectionBar label="Golos por período" />
          <View style={{ paddingHorizontal: spacing.md, gap: layout.tableRowGap }}>
            <GridRow label="Minutos" values={['Marcados', 'Sofridos']} widths={SPLIT_W.slice(0, 2)} isHead />
            {vm.periods.map((p) => (
              <GridRow
                key={p.label}
                label={p.label}
                values={[String(p.for), String(p.against)]}
                widths={SPLIT_W.slice(0, 2)}
                a11y={`${p.label}: marcados ${p.for}, sofridos ${p.against}`}
              />
            ))}
          </View>
        </>
      ) : null}
    </>
  );
}

const PLAYER_W = [layout.tableColWidth, layout.tableGoalsWidth, layout.tableColWidth, layout.tableColWidth, layout.tableGoalsWidth];

function PlayerTable({ season }: { season: string }) {
  const stats = usePlayerStats(season);
  if (stats.status === 'loading') return <Loading testID="player-stats-loading" />;
  if (stats.status === 'error') return <EmptyState icon="info" text={ERROR_TEXT} />;
  const players = stats.status === 'ready' ? playersByGoals(stats.data) : [];
  if (players.length === 0) return <EmptyState icon="info" text={NO_PLAYER_STATS} />;
  return (
    <View style={{ paddingHorizontal: spacing.md, gap: layout.tableRowGap }}>
      <GridRow label="Jogador" values={['J', 'Min', 'G', 'A', 'Nota']} widths={PLAYER_W} isHead />
      {players.map((p) => {
        const rating = ratingText(p.rating);
        const values = [String(p.appearances), String(p.minutes), String(p.goals), String(p.assists), rating];
        return (
          <Pressable
            key={p.id}
            testID={`stats-row-${p.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${p.name}: ${p.appearances} jogos, ${p.minutes} minutos, ${p.goals} golos, ${p.assists} assistências, nota ${rating}`}
            onPress={() => openPlayer(p.id)}
            style={({ pressed }) => ({ opacity: pressed ? layout.pressedOpacity : 1 })}
          >
            <GridRow label={p.name} values={values} widths={PLAYER_W} />
          </Pressable>
        );
      })}
    </View>
  );
}

function StatsTab({ season }: { season: string }) {
  const comps = useSeasonFootballCompetitions(season);
  const [picked, setPicked] = useState<string | null>(null);
  if (comps.status === 'loading') return <Loading testID="competitions-loading" />;
  if (comps.status === 'error') return <EmptyState icon="info" text={ERROR_TEXT} />;
  const list = comps.status === 'ready' ? comps.data : [];
  const current = list.find((c) => c.key === picked) ?? list[0];
  if (!current) return <EmptyState icon="info" text={NO_COMPETITIONS} />;
  return (
    <TabScroll>
      <Tabs mode="scroll" items={list.map((c) => ({ key: c.key, label: c.name }))} value={current.key} onChange={setPicked} />
      <TeamStatsBlock key={current.key} leagueId={current.leagueId} season={season} />
      <SectionBar label={`Jogadores, época ${seasonLabel(season)}`} />
      <PlayerTable season={season} />
    </TabScroll>
  );
}

// --- Transferências --------------------------------------------------------------------------

function DirectionChip({ direction }: { direction: Transfer['direction'] }) {
  return (
    <View
      style={{
        flexShrink: 0,
        backgroundColor: direction === 'in' ? colors.primary : colors.surface20,
        borderRadius: radius.sm,
        paddingHorizontal: layout.badgeSmallPadX,
        paddingVertical: layout.badgeSmallPadY,
      }}
    >
      <Body variant="badgeSmall">{direction === 'in' ? 'Entrada' : 'Saída'}</Body>
    </View>
  );
}

function TransferRow({ t, testID }: { t: Transfer; testID: string }) {
  const other = t.direction === 'in' ? t.out : t.in;
  const where = t.direction === 'in' ? `de ${other.name}` : `para ${other.name}`;
  const type = transferTypeLabel(t.type);
  const date = calendarDateText(t.date);
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={[t.direction === 'in' ? 'Entrada' : 'Saída', t.name, where, date, type].filter(Boolean).join(', ')}
      style={{ flexDirection: 'row', alignItems: 'center', gap: layout.tableNameGap, minHeight: layout.rankingRowMinHeight }}
    >
      <DirectionChip direction={t.direction} />
      <TeamCrest team={{ id: null, name: other.name, crestUrl: other.logo }} size="sm" />
      <View style={{ flex: 1 }}>
        <Body variant="tableTeam" numberOfLines={1} ellipsizeMode="tail">{t.name}</Body>
        <Body variant="rowTeam" numberOfLines={1} ellipsizeMode="tail" style={{ opacity: layout.mutedOpacity }}>{where}</Body>
      </View>
      <View style={{ flexShrink: 0, alignItems: 'flex-end' }}>
        <Body variant="rowTeam">{date}</Body>
        {type ? <Body variant="rowTeam" style={{ opacity: layout.mutedOpacity }}>{type}</Body> : null}
      </View>
    </View>
  );
}

function TransfersTab() {
  const transfers = useTeamData('transfers');
  if (transfers.status === 'loading') return <Loading testID="transfers-loading" />;
  if (transfers.status === 'error') return <EmptyState icon="info" text={ERROR_TEXT} />;
  const items = transfers.status === 'ready' ? transfers.data.items : [];
  if (items.length === 0) return <EmptyState icon="info" text={NO_TRANSFERS} />;
  return (
    <TabScroll>
      <OfflineBanner visible={anyCache([transfers])} />
      {/* O servidor já ordena da mais recente para a mais antiga. */}
      <List
        items={items.map((t, i) => ({ t, i }))}
        keyOf={({ t, i }) => `${t.playerId}-${t.date}-${i}`}
        render={({ t, i }) => <TransferRow t={t} testID={`transfer-row-${i}`} />}
      />
    </TabScroll>
  );
}

// --- Troféus ---------------------------------------------------------------------------------

function TrophiesTab() {
  const trophies = useTeamData('trophies');
  const squad = useTeamData('squad');
  const coach = useTeamData('coach');
  const reads = [trophies, squad, coach];
  if (anyLoading(reads)) return <Loading testID="trophies-loading" />;
  if (anyError(reads)) return <EmptyState icon="info" text={ERROR_TEXT} />;
  const t = dataOf(trophies);
  const s = dataOf(squad);
  const coachTrophies = t?.coach ?? [];
  const players = t && s ? playersWithTrophies(s, t) : [];
  if (coachTrophies.length === 0 && players.length === 0) return <EmptyState icon="info" text={NO_TROPHIES} />;
  const coachName = dataOf(coach)?.name;
  return (
    <TabScroll>
      <OfflineBanner visible={anyCache(reads)} />
      {coachTrophies.length > 0 ? (
        <>
          <SectionBar label={coachName ? `Treinador, ${coachName}` : 'Treinador'} />
          <View>
            {coachTrophies.map((x, i) => (
              <TextRow key={`${x.league}-${x.season}-${i}`} left={`${x.league} ${x.season}`} right={trophyPlaceText(x.place)} />
            ))}
          </View>
        </>
      ) : null}
      {players.length > 0 ? (
        <>
          <SectionBar label="Jogadores" />
          <List
            items={players}
            keyOf={(x) => x.player.id}
            render={({ player, count }) => {
              const total = count === 1 ? '1 troféu' : `${count} troféus`;
              return (
                <PersonRow
                  testID={`trophy-player-${player.id}`}
                  label={`${player.name}, ${total}`}
                  photo={player.photo}
                  name={player.name}
                  right={<Display variant="tableValue" style={{ flexShrink: 0 }}>{total}</Display>}
                  onPress={() => openPlayer(player.id)}
                />
              );
            }}
          />
        </>
      ) : null}
    </TabScroll>
  );
}

// --- Ecrã ------------------------------------------------------------------------------------

export default function Equipa() {
  const [tab, setTab] = useState<TabKey>('plantel');
  const now = useNow();
  const season = useMemo(() => footballSeason(now), [now]);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <Screen padded="none">
      <Header title="Equipa" onBack={back} />
      <View style={{ flex: 1, paddingTop: spacing.md, gap: spacing.md }}>
        <View style={{ paddingHorizontal: spacing.screenX }}>
          <Tabs mode="scroll" items={TABS} value={tab} onChange={setTab} />
        </View>
        <View style={{ flex: 1 }}>
          {tab === 'plantel' ? (
            <SquadTab />
          ) : tab === 'estatisticas' ? (
            <StatsTab season={season} />
          ) : tab === 'transferencias' ? (
            <TransfersTab />
          ) : (
            <TrophiesTab />
          )}
        </View>
      </View>
    </Screen>
  );
}
