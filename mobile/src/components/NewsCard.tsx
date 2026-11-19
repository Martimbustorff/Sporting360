// SEM FIGMA: não existe frame de notícia; construído com tokens no estilo do Figma (a validar pelo Martim na galeria).
// O cartão só expõe onPress; abrir o artigo no browser interno é responsabilidade do ecrã.
import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import { Touchable } from '@/components/Touchable';
import { relativeTime } from '@/lib/relativeTime';
import { colors, layout, radius, spacing, type } from '@/theme/tokens';

export type NewsVM = {
  id: string;
  title: string;
  imageUrl: string | null;
  summary?: string;
  source: string;
  publishedAt: Date;
  sport?: string;
};

export function NewsCard({ news, now, onPress }: { news: NewsVM; now: Date; onPress: (id: string) => void }) {
  const when = relativeTime(news.publishedAt, now);
  return (
    <Touchable
      accessibilityRole="link"
      accessibilityLabel={`${news.title}. ${news.source}, ${when}`}
      onPress={() => onPress(news.id)}
      style={{
        flexDirection: 'row',
        gap: layout.newsGap,
        paddingVertical: spacing.sm,
      }}
    >
      {news.imageUrl ? (
        <Image
          testID="news-image"
          source={{ uri: news.imageUrl }}
          contentFit="cover"
          style={{ ...layout.newsImage, borderRadius: radius.md }}
        />
      ) : (
        <View testID="news-placeholder" style={{ ...layout.newsImage, borderRadius: radius.md, backgroundColor: colors.surface10 }} />
      )}
      <View style={{ flex: 1, justifyContent: 'space-between', gap: spacing.xs }}>
        <Text style={type.newsTitle} numberOfLines={2} ellipsizeMode="tail">{news.title}</Text>
        {news.summary ? <Text style={type.newsSummary} numberOfLines={2} ellipsizeMode="tail">{news.summary}</Text> : null}
        <Text style={type.newsMeta} numberOfLines={1}>{`${news.source} · ${when}`}</Text>
      </View>
    </Touchable>
  );
}
