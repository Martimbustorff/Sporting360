// Figma V7.1: 4947:8624 (33 Jogo · Vídeos, revisto 20/11): todos os vídeos a toda a largura (16:9) com o título por
// baixo; o rótulo do tipo em Eyebrow 13 primary-on-dark só quando diz alguma coisa (Resumo, Lance, Flash interview),
// nunca "Vídeo" (Martim: "escusamos de escrever vídeo em todos"). A duração do frame fica
// pendente de uma decisão futura sobre o servidor (hoje não grava `duration`). O leitor (`VideoPlayer`) mantém o comportamento.
// Decisão: o destaque é o vídeo do tipo `resumo`; sem resumo, o primeiro da lista. Os restantes seguem por minuto.
// SEM FIGMA: o estado de erro, os vazios e o aviso de cache.
import { View } from 'react-native';
import { SkeletonRows } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { isAllowedEmbed, VideoPlayer } from '@/components/VideoPlayer';
import type { Match, Video } from '@/data/schemas';
import { useMatchVideos } from '@/data/sports';
import { spacing } from '@/theme/tokens';
import { MatchScrollView } from '@/components/match/MatchScroll';

export const VIDEOS_ERROR = 'Não foi possível carregar os dados.';
const EMPTY = 'Os vídeos aparecem depois dos lances.';
const EMPTY_EUROPE = 'Sem vídeos para esta competição.';
const TYPE_LABEL: Record<Video['type'], string | undefined> = {
  golo: 'Lance', // Figma 33 (4947:8624): o vídeo de golo traz o rótulo "LANCE"
  resumo: 'Resumo',
  flash_interview: 'Flash interview',
  outro: undefined,
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

/** Destaque primeiro (o resumo, ou o primeiro da lista); os restantes mantêm a ordem recebida. */
export function featuredFirst(vs: Video[]): Video[] {
  const i = vs.findIndex((v) => v.type === 'resumo');
  const at = i < 0 ? 0 : i;
  const first = vs[at];
  return first ? [first, ...vs.slice(0, at), ...vs.slice(at + 1)] : vs;
}

export function VideosTab({ match }: { match: Match }) {
  const videos = useMatchVideos(match.id);
  if (videos.status === 'loading') return <SkeletonRows padded testID="videos-loading" />;
  if (videos.status === 'error') return <EmptyState icon="info" text={VIDEOS_ERROR} />;

  const list = videos.status === 'ready' ? featuredFirst(byMinute(videos.data.filter((v) => isAllowedEmbed(v.embedSrc)))) : [];
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
    <MatchScrollView
      testID="videos-tab"
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg }}
    >
      <OfflineBanner visible={offline} />
      {list.map((v) => (
        <View key={v.id} testID={`video-row-${v.id}`}>
          <VideoPlayer video={v} variant="featured" kind={TYPE_LABEL[v.type]} />
        </View>
      ))}
    </MatchScrollView>
  );
}
