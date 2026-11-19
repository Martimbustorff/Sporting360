// SEM FIGMA: tab Vídeos sem frame vetorial; referência na imagem "Appstore S360" 818:20891 (get_design_context):
// lista vertical de vídeos a toda a largura (margens de 14 px), miniatura e título. Composto com tokens: o rótulo do
// tipo ("Golo", "Resumo", ...) a primary por cima de cada vídeo, o esqueleto em branco, os vazios e o aviso de cache.
import { ScrollView, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { isAllowedEmbed, VideoPlayer } from '@/components/VideoPlayer';
import type { Match, Video } from '@/data/schemas';
import { useMatchVideos } from '@/data/sports';
import { Body } from '@/theme/typography';
import { colors, layout, spacing } from '@/theme/tokens';
import { useMatchScroll } from '@/components/match/MatchScroll';

export const VIDEOS_ERROR = 'Não foi possível carregar os dados.';
const EMPTY = 'Os vídeos aparecem depois dos lances.';
const EMPTY_EUROPE = 'Sem vídeos para esta competição.';
const TYPE_LABEL: Record<Video['type'], string> = {
  golo: 'Golo',
  resumo: 'Resumo',
  flash_interview: 'Flash interview',
  outro: 'Vídeo',
};

/** Ordem de um minuto VSports ("12", "45+3"); sem minuto ou ilegível vai para o fim. */
export function minuteOrder(minute: string | null): number {
  const m = /^\s*(\d+)\s*(?:\+\s*(\d+))?\s*'?\s*$/.exec(minute ?? '');
  if (!m) return Infinity;
  return Number(m[1]) * 100 + Number(m[2] ?? 0);
}

/** Por minuto; empates e vídeos sem minuto mantêm a ordem do hook (`publishedAt`, nulos no fim). */
function byMinute(vs: Video[]): Video[] {
  return vs
    .map((v, i) => ({ v, i, k: minuteOrder(v.minute) }))
    .sort((a, b) => (a.k === b.k ? a.i - b.i : a.k < b.k ? -1 : 1))
    .map((x) => x.v);
}

export function VideosTab({ match }: { match: Match }) {
  const scrollProps = useMatchScroll();
  const videos = useMatchVideos(match.id);
  if (videos.status === 'loading') return <View testID="videos-loading" />;
  if (videos.status === 'error') return <EmptyState icon="info" text={VIDEOS_ERROR} />;

  const list = videos.status === 'ready' ? byMinute(videos.data.filter((v) => isAllowedEmbed(v.embedSrc))) : [];
  const offline = videos.status === 'ready' && videos.fromCache === true;
  if (list.length === 0) {
    return (
      <View>
        <OfflineBanner visible={offline} />
        <EmptyState icon="info" text={match.competition.type === 'europe' ? EMPTY_EUROPE : EMPTY} />
      </View>
    );
  }

  return (
    <ScrollView
      {...scrollProps}
      testID="videos-tab"
      contentContainerStyle={{ paddingHorizontal: spacing.screenX, paddingBottom: spacing.xl, gap: layout.videoListGap }}
    >
      <OfflineBanner visible={offline} />
      {list.map((v) => (
        <View key={v.id} testID={`video-row-${v.id}`} style={{ gap: layout.videoGap }}>
          <Body testID="video-type" variant="badgeSmall" style={{ color: colors.primary }}>
            {TYPE_LABEL[v.type]}
          </Body>
          <VideoPlayer video={v} />
        </View>
      ))}
    </ScrollView>
  );
}
