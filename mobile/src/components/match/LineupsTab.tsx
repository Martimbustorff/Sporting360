// SEM FIGMA: esqueleto da tab (Task 8). O conteúdo chega na Task 11 (nós 500:29521, jogo futuro, e 498:28089, ao vivo).
import { EmptyState } from '@/components/EmptyState';
import type { Match } from '@/data/schemas';

export function LineupsTab({ match }: { match: Match }) {
  return <EmptyState icon="info" text="Formações em breve." />;
}
