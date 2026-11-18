// SEM FIGMA: esqueleto da tab (Task 8). O conteúdo chega na Task 16 (sem frame; referência da página Appstore S360).
import { EmptyState } from '@/components/EmptyState';
import type { Match } from '@/data/schemas';

export function PredictionTab({ match }: { match: Match }) {
  return <EmptyState icon="info" text="Prognóstico em breve." />;
}
