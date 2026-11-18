// SEM FIGMA: esqueleto da tab (Task 8). O conteúdo chega na Task 15 (sem frame; referência 818:20891).
import { EmptyState } from '@/components/EmptyState';
import type { Match } from '@/data/schemas';

export function VideosTab({ match }: { match: Match }) {
  return <EmptyState icon="info" text="Vídeos em breve." />;
}
