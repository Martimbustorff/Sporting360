// Figma V7.1: notícia 4943:7925 (imagem 96x72 raio 10 ou surface-10, texto a 12, título Strong 14, fonte e hora Caption 12
// text-subtle a 6, padding 12 e separador de 1 pt). O resumo da notícia não aparece no frame. O cartão só expõe
// onPress; abrir o artigo no browser interno é responsabilidade do ecrã.
import { Image } from 'expo-image';
import { View } from 'react-native';
import { Touchable } from '@/components/Touchable';
import { relativeTime } from '@/lib/relativeTime';
import { Text71 } from '@/theme/typography';
import { colors, layout } from '@/theme/tokens';

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
        alignItems: 'flex-start',
        gap: layout.newsGap,
        paddingVertical: layout.newsRowPadY,
        borderBottomWidth: layout.separator,
        borderBottomColor: colors.separator,
      }}
    >
      {news.imageUrl ? (
        <Image
          testID="news-image"
          source={{ uri: news.imageUrl }}
          contentFit="cover"
          style={{ ...layout.newsImage, borderRadius: layout.newsImageRadius }}
        />
      ) : (
        <View testID="news-placeholder" style={{ ...layout.newsImage, borderRadius: layout.newsImageRadius, backgroundColor: colors.surface10 }} />
      )}
      <View style={{ flex: 1, minWidth: 0, gap: layout.newsTextGap }}>
        <Text71 variant="strong14" numberOfLines={2} ellipsizeMode="tail">{news.title}</Text71>
        <Text71 variant="caption12" color="textSubtle" numberOfLines={1}>{`${news.source} · ${when}`}</Text71>
      </View>
    </Touchable>
  );
}
