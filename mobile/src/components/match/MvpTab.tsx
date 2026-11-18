// SEM FIGMA: esqueleto da tab (Task 8). O conteúdo chega na Task 18 (sem frame; referência 818:21193).
import { EmptyState } from '@/components/EmptyState';
import type { Match } from '@/data/schemas';

export function MvpTab({ match }: { match: Match }) {
  return <EmptyState icon="info" text="MVP em breve." />;
}
