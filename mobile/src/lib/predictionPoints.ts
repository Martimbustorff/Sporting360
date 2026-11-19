// Pontos do prognóstico de um jogo: só os eventos `prediction_*` escritos pelo servidor (participação, exato,
// vencedor); o MVP do mesmo jogo fica de fora. A app só soma, nunca calcula pontuação (ver `myGame.ts`).
import type { PointEvent } from '@/data/schemas';

export function predictionPoints(events: PointEvent[]): number {
  return events.filter((e) => e.type.startsWith('prediction_')).reduce((sum, e) => sum + e.points, 0);
}
