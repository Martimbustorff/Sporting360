// Figma V7.1 27 Notícias (4943:7869): Header, `NewsCard` a 24 dos lados e `OfflineBanner`.
// 20/11 (Martim): só há notícias de futebol; sem separadores de modalidade, a lista lê só `sport == football`.
// - Só título, imagem, fonte e data (o resumo não está no frame); o `content` do artigo nunca é lido (NewsSchema retira-o).
// - O toque abre a página original com `openLink` (browser interno, só https, falha reportada).
// - "há X tempo" em Europe/Lisbon, com o relógio a avançar de minuto a minuto.
// - Leitura falhada mostra erro, nunca a mensagem de vazio.
// - Plano 6: `?id=` (toque numa notificação) abre esse artigo uma vez, quando a lista chega; id desconhecido: só a lista.
import { useCallback, useEffect, useRef } from 'react';
import { FlatList, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { NewsCard } from '@/components/NewsCard';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Screen } from '@/components/Screen';
import { useNow } from '@/data/clock';
import type { News } from '@/data/schemas';
import { useNews } from '@/data/user';
import { openLink } from '@/lib/openLink';
import { space } from '@/theme/tokens';

const MINUTE_MS = 60_000;

export const NOTICIAS_TEXT = {
  error: 'Não foi possível carregar as notícias.',
  empty: 'Sem notícias por agora.',
} as const;

export default function Noticias() {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const now = useNow(MINUTE_MS);
  const news = useNews('football');
  const byId = news.status === 'ready' ? news.data : null;
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const wanted = Array.isArray(params.id) ? params.id[0] : params.id;
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!wanted || !byId || handled.current === wanted) return;
    handled.current = wanted;
    const found = byId.find((n) => n.id === wanted);
    if (found) void openLink(found.url);
  }, [wanted, byId]);
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
        contentContainerStyle={{ paddingHorizontal: space.s24, paddingBottom: space.s16 }}
        ListHeaderComponent={<OfflineBanner visible={news.fromCache === true} />}
        ListEmptyComponent={<EmptyState icon="info" text={NOTICIAS_TEXT.empty} />}
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
      <View style={{ flex: 1, paddingTop: space.s8 }}>{body}</View>
    </Screen>
  );
}
