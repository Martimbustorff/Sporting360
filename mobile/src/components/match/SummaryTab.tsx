// SEM FIGMA: esqueleto da tab (Task 8). O conteúdo chega na Task 9 (nós 500:28950, jogo futuro, e 655:31862, ao vivo).
import { EmptyState } from '@/components/EmptyState';
import type { Match } from '@/data/schemas';

export function SummaryTab({ match }: { match: Match }) {
  return <EmptyState icon="info" text="Sumário em breve." />;
}
