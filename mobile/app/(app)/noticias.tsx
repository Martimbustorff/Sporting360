// SEM FIGMA: o Figma não tem frame das Notícias (Mapa do Figma do Plano 4: "Notícias, Ranking, Perfil"; referência
// raster: nenhuma específica, só o `NewsCard` aprovado na galeria, Plano 3). Compõe `Header`, `Tabs` 'scroll'
// (500:28976, "Todas" + modalidades), `NewsCard` e `OfflineBanner`; o resto com tokens.
// - Só título, imagem, resumo, fonte e data; o `content` do artigo nunca é lido (NewsSchema retira-o).
// - O toque abre a página original com `openLink` (browser interno, só https, falha reportada).
// - "há X tempo" em Europe/Lisbon, com o relógio a avançar de minuto a minuto.
// - Leitura falhada mostra erro, nunca a mensagem de vazio.
import { useCallback, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { NewsCard } from '@/components/NewsCard';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Screen } from '@/components/Screen';
import { Tabs } from '@/components/Tabs';
import { useNow } from '@/data/clock';
import type { News, Sport } from '@/data/schemas';
import { useNews } from '@/data/user';
import { openLink } from '@/lib/openLink';
import { SPORTS, sportLabel } from '@/lib/sports';
import { spacing } from '@/theme/tokens';

type Filter = 'all' | Sport;

const FILTERS: { key: Filter; label: string }[] = [{ key: 'all', label: 'Todas' }, ...SPORTS];
const MINUTE_MS = 60_000;

export const NOTICIAS_TEXT = {
  error: 'Não foi possível carregar as notícias.',
  empty: (filter: Filter) =>
    filter === 'all' ? 'Sem notícias por agora.' : `Sem notícias de ${sportLabel(filter).toLowerCase()} por agora.`,
} as const;

export default function Noticias() {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const now = useNow(MINUTE_MS);
  const [filter, setFilter] = useState<Filter>('all');
  const news = useNews(filter === 'all' ? null : filter);
  const byId = news.status === 'ready' ? news.data : null;
  const onPress = useCallback(
    (id: string) => {
      const found = byId?.find((n) => n.id === id);
      if (found) void openLink(found.url);
    },
    [byId],
  );

  let body: React.JSX.Element;
  if (news.status === 'loading') {
    body = <View testID="noticias-loading" style={{ flex: 1 }} />;
  } else if (news.status !== 'ready') {
    // 'error' (e 'missing', que uma coleção não produz): nunca a mensagem de vazio.
    body = <EmptyState icon="info" text={NOTICIAS_TEXT.error} />;
  } else {
    body = (
      <FlatList<News & { id: string }>
        style={{ flex: 1 }}
        data={news.data}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ paddingHorizontal: spacing.screenX, paddingBottom: spacing.md }}
        ListHeaderComponent={<OfflineBanner visible={news.fromCache === true} />}
        ListEmptyComponent={<EmptyState icon="info" text={NOTICIAS_TEXT.empty(filter)} />}
        renderItem={({ item }) => (
          <NewsCard
            news={{
              id: item.id,
              title: item.title,
              imageUrl: item.image,
              summary: item.summary,
              source: item.source,
              publishedAt: item.publishedAt,
              sport: item.sport,
            }}
            now={now}
            onPress={onPress}
          />
        )}
      />
    );
  }

  return (
    <Screen padded="none">
      <Header title="Notícias" onBack={back} />
      <View style={{ flex: 1, paddingTop: spacing.md, gap: spacing.md }}>
        <Tabs mode="scroll" items={FILTERS} value={filter} onChange={setFilter} />
        {body}
      </View>
    </Screen>
  );
}
