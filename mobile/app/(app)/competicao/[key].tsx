// Figma: Header com o nome da competição a primary (como "PRIMEIRA LIGA" em 500:30076, 500:30081); tabs com scroll
// 500:28976 (`Tabs mode="scroll"`); Classificação = `CompetitionStandings` (500:29367 com os emblemas de 500:30076);
// linhas das jornadas = `MatchRow` (500:28822 / 489:7038) com o separador 500:28839; posição dos tops no círculo
// 500:29423 (`PositionCircle`).
// SEM FIGMA: as tabs Jornadas, Marcadores, Assistências e Cartões; o seletor de ronda (setas Feather chevron-left/
// chevron-right de 24 px com alvo de 44 px e o rótulo da ronda em DIN 18 ao centro, setas a 40 % nos extremos); as
// linhas dos tops (círculo da posição, foto redonda de 32 px, nome numa linha com reticências e a equipa a muted por
// baixo, valor em DIN 20 à direita, divisória de 1 px a 20 % como na tabela); o seletor Amarelos/Vermelhos
// (`Tabs mode="equal"`); esqueleto em branco, erros, vazios e o aviso de cache.
// Só os jogos do Sporting abrem o detalhe (só esses têm `matches/{id}`, preflight F9). Tops só em ligas e europeias
// (competitionSync escreve-os só aí; taças e supertaça não têm essas tabs).
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { CompetitionStandings } from '@/components/CompetitionStandings';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { MatchRow } from '@/components/MatchRow';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Screen } from '@/components/Screen';
import { PositionCircle } from '@/components/StandingsTable';
import { Tabs } from '@/components/Tabs';
import { Touchable } from '@/components/Touchable';
import type { Loadable } from '@/data/hooks';
import type { Competition, Match, TopListDoc, TopListItem } from '@/data/schemas';
import { useCompetition, useCompetitionData } from '@/data/sports';
import { formatRound } from '@/lib/formatRound';
import { fixtureToMatch } from '@/lib/matchVM';
import { SPORTING_API_ID } from '@/lib/teams';
import { Body, Display } from '@/theme/typography';
import { colors, layout, radius, spacing } from '@/theme/tokens';

type TabKey = 'classificacao' | 'jornadas' | 'marcadores' | 'assistencias' | 'cartoes';
type CardKind = 'yellow' | 'red';
type SeasonCompetition = Competition & { key: string; season: string };

const BASE_TABS: { key: TabKey; label: string }[] = [
  { key: 'classificacao', label: 'Classificação' },
  { key: 'jornadas', label: 'Jornadas' },
];
const TOP_TABS: { key: TabKey; label: string }[] = [
  { key: 'marcadores', label: 'Marcadores' },
  { key: 'assistencias', label: 'Assistências' },
  { key: 'cartoes', label: 'Cartões' },
];
const CARD_TABS: { key: CardKind; label: string }[] = [
  { key: 'yellow', label: 'Amarelos' },
  { key: 'red', label: 'Vermelhos' },
];

const ERROR_TEXT = 'Não foi possível carregar os dados.';
const MISSING_TEXT = 'Competição não encontrada.';
const NO_ROUNDS = 'Sem jornadas para esta competição.';
const NO_GAMES = 'Sem jogos nesta ronda.';
const NO_TOPS = 'Sem dados para esta competição.';
const SPORTING = String(SPORTING_API_ID);

const param = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);
/** `{sport}_{leagueId}_{season}` → a época (ano de início, "2026"). */
const seasonOf = (key: string): string => key.split('_').pop() ?? '';
const fromCache = (l: Loadable<unknown>) => l.status === 'ready' && l.fromCache === true;
/** Só os jogos do Sporting têm `matches/{id}` e abrem o detalhe (F9). */
const isSportingGame = (m: Match) => m.home.id === SPORTING || m.away.id === SPORTING;
/** Tops só existem em ligas e europeias (competitionSync). */
const hasTops = (c: Competition) => c.type === 'league' || c.type === 'europe';

/** SEM FIGMA: enquanto os dados não chegam, um espaço em branco (como na Classificação). */
const Loading = ({ testID }: { testID: string }) => <View testID={testID} />;

function Separator() {
  return <View style={{ height: layout.separator, backgroundColor: colors.surface20, marginHorizontal: spacing.screenX }} />;
}

function Arrow({ dir, disabled, onPress }: { dir: 'left' | 'right'; disabled: boolean; onPress: () => void }) {
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={dir === 'left' ? 'Ronda anterior' : 'Ronda seguinte'}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        width: layout.minTouch,
        height: layout.minTouch,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Feather
        name={dir === 'left' ? 'chevron-left' : 'chevron-right'}
        size={layout.headerIcon}
        color={disabled ? colors.textDisabled : colors.white}
      />
    </Touchable>
  );
}

function RoundsTab({ competition }: { competition: SeasonCompetition }) {
  const rounds = useCompetitionData(competition.key, 'rounds');
  const fixtures = useCompetitionData(competition.key, 'fixtures');
  const [picked, setPicked] = useState<string | null>(null);

  const items = rounds.status === 'ready' ? rounds.data.items : [];
  const fallback = rounds.status === 'ready' ? rounds.data.current : null;
  // Abre na ronda atual; sem ela (ou se não está na lista), na última.
  const defaultRaw = items.some((r) => r.raw === fallback) ? fallback : (items[items.length - 1]?.raw ?? null);
  const raw = picked && items.some((r) => r.raw === picked) ? picked : defaultRaw;
  const index = items.findIndex((r) => r.raw === raw);
  const round = index >= 0 ? items[index] : undefined;

  const games = useMemo(
    () =>
      fixtures.status === 'ready' && raw
        ? fixtures.data.items
            .filter((f) => f.round === raw)
            .sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime())
            .map((f) => fixtureToMatch(f, competition))
        : [],
    [fixtures, raw, competition],
  );

  if (rounds.status === 'loading' || fixtures.status === 'loading') return <Loading testID="rounds-loading" />;
  if (rounds.status === 'error' || fixtures.status === 'error') return <EmptyState icon="info" text={ERROR_TEXT} />;
  if (!round) return <EmptyState icon="info" text={NO_ROUNDS} />;

  const go = (step: -1 | 1) => setPicked(items[index + step]?.raw ?? raw);

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner visible={fromCache(rounds) || fromCache(fixtures)} />
      <View
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.screenX, paddingBottom: spacing.sm }}
      >
        <Arrow dir="left" disabled={index <= 0} onPress={() => go(-1)} />
        <Display
          variant="tableHead"
          testID="round-label"
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{ flex: 1, textAlign: 'center' }}
        >
          {round.label || formatRound(round.raw)}
        </Display>
        <Arrow dir="right" disabled={index >= items.length - 1} onPress={() => go(1)} />
      </View>
      <FlatList
        data={games}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <MatchRow
            match={item}
            onPress={isSportingGame(item) ? (id) => router.push(`/jogo/${id}`) : undefined}
          />
        )}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={<EmptyState text={NO_GAMES} />}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
      />
    </View>
  );
}

function TopRow({ item, rank }: { item: TopListItem; rank: number }) {
  return (
    <View
      testID={`top-row-${item.playerId}`}
      accessible
      accessibilityLabel={`${rank}.º ${item.name}, ${item.teamName}, ${item.value}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: layout.tableNameGap, minHeight: layout.rankingRowMinHeight }}
    >
      <PositionCircle rank={rank} />
      {item.photo ? (
        <Image
          testID={`top-photo-${item.playerId}`}
          source={{ uri: item.photo }}
          contentFit="cover"
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{ width: layout.avatarSize, height: layout.avatarSize, borderRadius: radius.pill }}
        />
      ) : (
        <View style={{ width: layout.avatarSize, height: layout.avatarSize, borderRadius: radius.pill, backgroundColor: colors.surface10 }} />
      )}
      <View style={{ flex: 1 }}>
        <Body variant="tableTeam" numberOfLines={1} ellipsizeMode="tail">
          {item.name}
        </Body>
        <Body variant="rowTeam" numberOfLines={1} ellipsizeMode="tail" style={{ opacity: layout.mutedOpacity }}>
          {item.teamName}
        </Body>
      </View>
      <Display
        variant="tableValue"
        testID={`top-value-${item.playerId}`}
        numberOfLines={1}
        style={{ width: layout.tablePointsWidth, flexShrink: 0 }}
      >
        {String(item.value)}
      </Display>
    </View>
  );
}

function TopList({ data }: { data: Loadable<TopListDoc> }) {
  if (data.status === 'loading') return <Loading testID="tops-loading" />;
  if (data.status === 'error') return <EmptyState icon="info" text={ERROR_TEXT} />;
  const items = data.status === 'ready' ? data.data.items : [];
  if (items.length === 0) return <EmptyState icon="info" text={NO_TOPS} />;
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.screenX, paddingBottom: spacing.xl }}>
      <OfflineBanner visible={fromCache(data)} />
      {items.map((it, i) => (
        <View key={`${it.playerId}-${i}`} style={{ gap: layout.tableRowGap, paddingBottom: layout.tableRowGap }}>
          <View style={{ height: layout.separator, backgroundColor: colors.surface20 }} />
          {/* Posição pela ordem do documento (o servidor já ordena). */}
          <TopRow item={it} rank={i + 1} />
        </View>
      ))}
    </ScrollView>
  );
}

function ScorersTab({ competitionKey }: { competitionKey: string }) {
  return <TopList data={useCompetitionData(competitionKey, 'topscorers')} />;
}

function AssistsTab({ competitionKey }: { competitionKey: string }) {
  return <TopList data={useCompetitionData(competitionKey, 'topassists')} />;
}

function CardsTab({ competitionKey }: { competitionKey: string }) {
  const [kind, setKind] = useState<CardKind>('yellow');
  const yellow = useCompetitionData(competitionKey, 'topyellowcards');
  const red = useCompetitionData(competitionKey, 'topredcards');
  return (
    <View style={{ flex: 1, gap: spacing.md }}>
      <View style={{ paddingHorizontal: spacing.screenX }}>
        <Tabs mode="equal" items={CARD_TABS} value={kind} onChange={setKind} />
      </View>
      <TopList data={kind === 'yellow' ? yellow : red} />
    </View>
  );
}

function CompetitionBody({ competition }: { competition: SeasonCompetition }) {
  const [tab, setTab] = useState<TabKey>('classificacao');
  const tabs = hasTops(competition) ? [...BASE_TABS, ...TOP_TABS] : BASE_TABS;
  const shown = tabs.some((t) => t.key === tab) ? tab : 'classificacao';
  return (
    <View style={{ flex: 1, paddingTop: spacing.md, gap: spacing.md }}>
      <View style={{ paddingHorizontal: spacing.screenX }}>
        <Tabs mode="scroll" items={tabs} value={shown} onChange={setTab} />
      </View>
      <View style={{ flex: 1 }}>
        {shown === 'classificacao' ? (
          <CompetitionStandings competitionKey={competition.key} showCompetitionLink={false} />
        ) : shown === 'jornadas' ? (
          <RoundsTab competition={competition} />
        ) : shown === 'marcadores' ? (
          <ScorersTab competitionKey={competition.key} />
        ) : shown === 'assistencias' ? (
          <AssistsTab competitionKey={competition.key} />
        ) : (
          <CardsTab competitionKey={competition.key} />
        )}
      </View>
    </View>
  );
}

export default function Competicao() {
  const params = useLocalSearchParams<{ key?: string | string[] }>();
  const key = param(params.key) ?? null;
  const loadable = useCompetition(key);
  const competition = useMemo(
    () => (loadable.status === 'ready' && key ? { ...loadable.data, key, season: seasonOf(key) } : null),
    [loadable, key],
  );
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen padded="none">
      <Header title={competition?.name ?? 'Competição'} onBack={back} />
      {loadable.status === 'loading' ? (
        <Loading testID="competition-loading" />
      ) : loadable.status === 'missing' ? (
        <EmptyState icon="info" text={MISSING_TEXT} />
      ) : !competition ? (
        <EmptyState icon="info" text={ERROR_TEXT} />
      ) : (
        <CompetitionBody key={competition.key} competition={competition} />
      )}
    </Screen>
  );
}
