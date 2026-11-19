// Figma: nós 500:28787 (Agenda, separador Próximos), 489:7003 (separador Resultados), 500:28814
// (tabs iguais), 500:28822 (linha de jogo), 500:28839 (separador entre linhas) e 348:26437 (variante
// antiga, com os meses); o cartão do topo é o 500:28796 (GameHeader da Task 4).
// SEM FIGMA: o filtro de modalidade (`Tabs mode="scroll"` com as modalidades do `SPORTS`), o botão
// "Plantel" no Header (Feather "users", o Figma só tem o título "Calendário" e a seta de voltar), o
// esqueleto de carregamento, o aviso de cache (OfflineBanner) e a linha "Fonte: ..." no fim da lista.
// Diferença deliberada: o Figma mostra no cartão o próximo jogo e começa a lista no jogo seguinte;
// aqui a lista traz todos os jogos, para o primeiro não desaparecer da lista que o utilizador percorre.
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { EmptyState } from '@/components/EmptyState';
import { GameHeader } from '@/components/GameHeader';
import { Header } from '@/components/Header';
import { MatchRow } from '@/components/MatchRow';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Screen } from '@/components/Screen';
import { Tabs } from '@/components/Tabs';
import { Touchable } from '@/components/Touchable';
import { useNow } from '@/data/clock';
import type { Loadable } from '@/data/hooks';
import type { Match, Sport } from '@/data/schemas';
import { useResultMatches, useUpcomingMatches } from '@/data/sports';
import { agendaLists } from '@/lib/agenda';
import { toGameHeaderVM } from '@/lib/matchVM';
import { SPORTS, sportLabel } from '@/lib/sports';
import { Body } from '@/theme/typography';
import { colors, layout, radius, spacing } from '@/theme/tokens';

type Tab = 'upcoming' | 'results';

const TABS: { key: Tab; label: string }[] = [
  { key: 'upcoming', label: 'Próximos' },
  { key: 'results', label: 'Resultados' },
];
const SPORT_TABS = SPORTS.map((s) => ({ key: s.key, label: s.label }));

const ERROR_TEXT = 'Não foi possível carregar a agenda.';

function Separator() {
  return (
    <View
      style={{
        height: layout.separator,
        backgroundColor: colors.surface20,
        marginHorizontal: spacing.screenX,
      }}
    />
  );
}

/** SEM FIGMA: enquanto os dados não chegam, três blocos com a altura da linha de jogo. */
function Skeleton() {
  return (
    <View testID="agenda-skeleton" style={{ paddingHorizontal: spacing.screenX, gap: spacing.md, paddingTop: spacing.md }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            height: layout.skeletonRowHeight,
            borderRadius: radius.md,
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

  const header = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
      {next ? (
        <Touchable
          accessibilityRole="button"
          accessibilityLabel="Próximo jogo"
          onPress={() => router.push(`/jogo/${next.id}`)}
        >
          <GameHeader game={toGameHeaderVM(next)} />
        </Touchable>
      ) : null}
      <View style={{ paddingHorizontal: spacing.screenX }}>
        <Tabs mode="equal" items={TABS} value={tab} onChange={setTab} />
      </View>
    </View>
  );

  const sources = attributions(list);
  // Rodapé só quando há fontes a atribuir (o futebol não tem): sem ele não fica um bloco vazio no fim.
  const footer =
    sources.length > 0 ? (
      <View style={{ paddingVertical: spacing.md, gap: spacing.xs }}>
        {sources.map((a) => (
          <Body key={a} variant="body" style={{ textAlign: 'center', opacity: layout.mutedOpacity }}>
            {`Fonte: ${a}`}
          </Body>
        ))}
      </View>
    ) : undefined;

  return (
    <Screen padded="none">
      <Header
        title="AGENDA"
        onBack={back}
        right={
          <Touchable
            accessibilityRole="button"
            accessibilityLabel="Plantel"
            hitSlop={(layout.minTouch - layout.headerIcon) / 2}
            onPress={() => router.push('/equipa')}
          >
            <Feather name="users" size={layout.headerIcon} color={colors.white} />
          </Touchable>
        }
      />
      <OfflineBanner visible={fromCache(upcoming) || fromCache(results)} />
      <View style={{ paddingHorizontal: spacing.screenX, paddingTop: spacing.md }}>
        <Tabs mode="scroll" items={SPORT_TABS} value={sport} onChange={setSport} />
      </View>
      {isError(upcoming) || isError(results) ? (
        <EmptyState icon="info" text={ERROR_TEXT} />
      ) : isLoading(upcoming) || isLoading(results) ? (
        <Skeleton />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MatchRow match={item} onPress={(id) => router.push(`/jogo/${id}`)} />}
          ItemSeparatorComponent={Separator}
          ListHeaderComponent={header}
          ListEmptyComponent={<EmptyState text={empty} />}
          ListFooterComponent={footer}
          contentContainerStyle={{ paddingTop: spacing.md }}
        />
      )}
    </Screen>
  );
}
