// Figma V7.1: frame 35 "Calendário" (4948:8199, revisto 20/11); linha de jogo 4948:8278 (MatchRow), pílulas 4948:8261.
// 20/11 (Martim): pílulas fixas por baixo do cabeçalho; por baixo, a rolar, o cartão do próximo jogo (sempre, também em
// Resultados; "Sem jogos agendados" com a mesma altura quando não há), Próximos/Resultados e a lista, "Fonte" no fim.
// 35c (4994:12606): a carregar é o cartão a carregar e o esqueleto do 47 por baixo das tabs.
// SEM FIGMA: o aviso de cache (OfflineBanner, com tolerância), o estado vazio e de erro, e a atribuição
// "Fonte: ..." (o futebol é sempre "Fonte: API-Football", frame 35; as outras modalidades, só as fontes gratuitas).
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { router, useIsFocused, type Href } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Chips } from '@/components/Chips';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { MatchRow } from '@/components/MatchRow';
import { NextMatchCard } from '@/components/NextMatchCard';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Screen } from '@/components/Screen';
import { ScreenSkeleton } from '@/components/Skeleton';
import { Tabs } from '@/components/Tabs';
import { Touchable } from '@/components/Touchable';
import { useNow } from '@/data/clock';
import type { Loadable } from '@/data/hooks';
import type { Match, Sport } from '@/data/schemas';
import { useResultMatches, useUpcomingMatches } from '@/data/sports';
import { agendaLists } from '@/lib/agenda';
import { predictionOpen } from '@/lib/gameWindows';
import { homeMatchMoment } from '@/lib/homeMatchMoment';
import { AGENDA_SPORTS, sportLabel } from '@/lib/sports';
import { Text71 } from '@/theme/typography';
import { colors, layout, space } from '@/theme/tokens';

type Tab = 'upcoming' | 'results';

const TABS: { key: Tab; label: string }[] = [
  { key: 'upcoming', label: 'Próximos' },
  { key: 'results', label: 'Resultados' },
];
const SPORT_TABS = AGENDA_SPORTS.map((s) => ({ key: s.key, label: s.label }));

const ERROR_TEXT = 'Não foi possível carregar a agenda.';

const isLoading = (l: Loadable<unknown>) => l.status === 'loading';
const isError = (l: Loadable<unknown>) => l.status === 'error';
const fromCache = (l: Loadable<unknown>) => l.status === 'ready' && l.fromCache === true;
const listOf = (l: Loadable<Match[]>) => (l.status === 'ready' ? l.data : []);

/** Atribuições das fontes gratuitas (modalidades), uma vez cada, pela ordem em que aparecem. */
const attributions = (ms: Match[]): string[] => [
  ...new Set(ms.map((m) => m.source.attribution).filter((a): a is string => typeof a === 'string' && a !== '')),
];
const FOOTBALL_SOURCE = 'API-Football';

export default function Agenda() {
  const [sport, setSport] = useState<Sport>('football');
  const [tab, setTab] = useState<Tab>('upcoming');
  // A Agenda fica montada: o relógio anda em blocos de 10 min e as queries acompanham.
  const now = useNow();
  const focused = useIsFocused();
  const upcoming = useUpcomingMatches(sport, now);
  const results = useResultMatches(sport, now);

  // Só se recalcula quando chega um snapshot novo (a identidade do Loadable muda), não a cada render.
  const lists = useMemo(() => agendaLists(listOf(upcoming), listOf(results)), [upcoming, results]);
  const list = tab === 'upcoming' ? lists.upcoming : lists.results;
  const next = lists.upcoming[0] ?? null;
  const modalidade = sportLabel(sport).toLowerCase();
  const empty =
    tab === 'upcoming' ? `Sem jogos de ${modalidade} agendados.` : `Sem resultados de ${modalidade}.`;

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const loading = isLoading(upcoming) || isLoading(results);
  const failed = isError(upcoming) || isError(results);
  const moment = homeMatchMoment({
    match: next,
    now,
    predictionOpen: next ? predictionOpen(next, now) : false,
    mvpOpen: false,
    votedMvp: false,
    loading,
  });

  // 20/11 (Martim): só as pílulas ficam fixas. O cartão do próximo jogo fica sempre por cima (em Próximos e em
  // Resultados) e a escolha Próximos/Resultados por baixo dele. Sem próximo jogo, o cartão "Sem jogos agendados" com a
  // mesma altura: mudar de modalidade ou de separador não faz saltar nada.
  const bar = (
    <View testID="agenda-bar" style={{ paddingHorizontal: space.s24, paddingTop: space.s12, paddingBottom: space.s12 }}>
      <Chips items={SPORT_TABS} value={sport} onChange={setSport} testIDPrefix="sport" />
    </View>
  );

  const header = (
    <View testID="agenda-header" style={{ gap: space.s12, paddingBottom: space.s8 }}>
      <OfflineBanner visible={fromCache(upcoming) || fromCache(results)} />
      {failed ? null : (
        <NextMatchCard
          moment={moment}
          match={next}
          now={now}
          ticking={focused}
          hideAgendaLink
          onOpenMatch={(id) => router.push(`/jogo/${id}`)}
          onAction={(href) => router.push(href as Href)}
          onOpenAgenda={() => undefined}
        />
      )}
      <Tabs mode="equal" items={TABS} value={tab} onChange={setTab} />
    </View>
  );

  const sources = sport === 'football' ? [...new Set([FOOTBALL_SOURCE, ...attributions(list)])] : attributions(list);
  // Rodapé só quando há fontes a atribuir: sem ele não fica um bloco vazio no fim.
  const footer =
    sources.length > 0 ? (
      <View style={{ paddingVertical: space.s12, gap: space.s4 }}>
        {sources.map((a) => (
          <Text71 key={a} variant="caption12" color="textSubtle">
            {`Fonte: ${a}`}
          </Text71>
        ))}
      </View>
    ) : undefined;

  return (
    <Screen padded="none">
      <Header
        title="CALENDÁRIO"
        onBack={back}
        right={
          <Touchable
            accessibilityRole="button"
            accessibilityLabel="Plantel"
            onPress={() => router.push('/equipa')}
          >
            <Feather name="users" size={layout.headerIcon} color={colors.white} />
          </Touchable>
        }
      />
      {bar}
      <FlatList
        testID="agenda-list"
        data={loading || failed ? [] : list}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MatchRow match={item} showCompetition onPress={(id) => router.push(`/jogo/${id}`)} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          failed ? (
            <EmptyState icon="info" text={ERROR_TEXT} />
          ) : loading ? (
            <ScreenSkeleton testID="agenda-skeleton" />
          ) : (
            <EmptyState text={empty} />
          )
        }
        ListFooterComponent={loading || failed ? undefined : footer}
        contentContainerStyle={{ paddingHorizontal: space.s24, paddingBottom: space.s24 }}
      />
    </Screen>
  );
}
