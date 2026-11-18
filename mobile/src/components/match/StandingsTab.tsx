// SEM FIGMA: esqueleto da tab (Task 8). O conteúdo chega na Task 12 (nós 500:29367, jogo futuro, e 489:7432, ao vivo).
import { EmptyState } from '@/components/EmptyState';
import type { Match } from '@/data/schemas';

export function StandingsTab({ match }: { match: Match }) {
  return <EmptyState icon="info" text="Classificação em breve." />;
}
