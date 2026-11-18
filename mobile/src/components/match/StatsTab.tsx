// SEM FIGMA: esqueleto da tab (Task 8). O conteúdo chega na Task 10 (nós 500:29236, jogo futuro, e 498:28453, ao vivo).
import { EmptyState } from '@/components/EmptyState';
import type { Match } from '@/data/schemas';

export function StatsTab({ match }: { match: Match }) {
  return <EmptyState icon="info" text="Estatísticas em breve." />;
}
