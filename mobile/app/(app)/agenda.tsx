// Figma V7.1: frame 35 "Calendário" (4948:8199); linha de jogo 4948:8278 (MatchRow), pílulas de modalidade 4948:8261.
// Ordem do frame: cartão do próximo jogo (o mesmo da Home), pílulas de modalidade, Próximos/Resultados e a lista com
// todos os jogos (também o do cartão), "Fonte" no fim.
// SEM FIGMA: o esqueleto de carregamento, o aviso de cache (OfflineBanner), o estado vazio e de erro, e a atribuição
// "Fonte: ..." só quando há fontes gratuitas. O cartão só aparece quando há próximo jogo (os estados "sem jogo" são da Home).
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
import { Tabs } from '@/components/Tabs';
import { Touchable } from '@/components/Touchable';
import { useNow } from '@/data/clock';
import type { Loadable } from '@/data/hooks';
import type { Match, Sport } from '@/data/schemas';
import { useResultMatches, useUpcomingMatches } from '@/data/sports';
import { agendaLists } from '@/lib/agenda';
import { predictionOpen } from '@/lib/gameWindows';
import { homeMatchMoment } from '@/lib/homeMatchMoment';
import { SPORTS, sportLabel } from '@/lib/sports';
import { Text71 } from '@/theme/typography';
import { colors, layout, space } from '@/theme/tokens';

type Tab = 'upcoming' | 'results';

const TABS: { key: Tab; label: string }[] = [
  { key: 'upcoming', label: 'Próximos' },
  { key: 'results', label: 'Resultados' },
];
const SPORT_TABS = SPORTS.map((s) => ({ key: s.key, label: s.label }));

const ERROR_TEXT = 'Não foi possível carregar a agenda.';

/** SEM FIGMA: enquanto os dados não chegam, três blocos com a altura da linha de jogo. */
function Skeleton() {
  return (
    <View testID="agenda-skeleton" style={{ paddingHorizontal: space.s24, gap: space.s12, paddingTop: space.s12 }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            height: layout.skeletonRowHeight,
            borderRadius: layout.tieCardRadius,
            backgroundColor: colors.surface10,
          }}
        />
      ))}
    </View>
  );
}

const isLoading = (l: Loadable<unknown>) => l.status === 'loading';
const isError = (l: Loadable<unknown>) => l.status === 'error';
const fromCache = (l: Loadable<unknown>) => l.status === 'ready' && l.fromCache === true;
const listOf = (l: Loadable<Match[]>) => (l.status === 'ready' ? l.data : []);

/** Atribuições das fontes gratuitas (modalidades), uma vez cada, pela ordem em que aparecem. */
const attributions = (ms: Match[]): string[] => [
  ...new Set(ms.map((m) => m.source.attribution).filter((a): a is string => typeof a === 'string' && a !== '')),
];

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

  const moment = homeMatchMoment({
    match: next,
    now,
    predictionOpen: next ? predictionOpen(next, now) : false,
    mvpOpen: false,
    votedMvp: false,
    loading: false,
  });

  // As pílulas de modalidade também ficam em carregamento e erro (a lista, com o cartão, ainda não existe): quem vê um erro
  // numa modalidade tem de poder mudar de modalidade.
  const sportChips = <Chips items={SPORT_TABS} value={sport} onChange={setSport} testIDPrefix="sport" />;

  const header = (
    <View style={{ gap: space.s12, paddingBottom: space.s12 }}>
      {next ? (
        <NextMatchCard
          moment={moment}
          match={next}
          now={now}
          ticking={focused}
          onOpenMatch={(id) => router.push(`/jogo/${id}`)}
          onAction={(href) => router.push(href as Href)}
          onOpenAgenda={() => undefined}
        />
      ) : null}
      {sportChips}
      <Tabs mode="equal" items={TABS} value={tab} onChange={setTab} />
    </View>
  );

  const sources = attributions(list);
  // Rodapé só quando há fontes a atribuir (o futebol não tem): sem ele não fica um bloco vazio no fim.
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
      <OfflineBanner visible={fromCache(upcoming) || fromCache(results)} />
      {isError(upcoming) || isError(results) ? (
        <>
          <View style={{ paddingHorizontal: space.s24, paddingTop: space.s12 }}>{sportChips}</View>
          <EmptyState icon="info" text={ERROR_TEXT} />
        </>
      ) : isLoading(upcoming) || isLoading(results) ? (
        <>
          <View style={{ paddingHorizontal: space.s24, paddingTop: space.s12 }}>{sportChips}</View>
          <Skeleton />
        </>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MatchRow match={item} onPress={(id) => router.push(`/jogo/${id}`)} />}
          ListHeaderComponent={header}
          ListEmptyComponent={<EmptyState text={empty} />}
          ListFooterComponent={footer}
          contentContainerStyle={{ paddingTop: space.s12, paddingHorizontal: space.s24 }}
        />
      )}
    </Screen>
  );
}
