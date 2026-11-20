// 20/11 (Martim): passar de separador com o dedo (jogo, Calendário, Ranking, Equipa, Competição, Perfil).
// Puro para se poder testar: decide, no fim do gesto, para que separador se vai.

/** Distância (pt) ou velocidade (pt/s) a partir das quais o gesto muda de separador. */
export const SWIPE = { distance: 64, velocity: 600, activeX: 24, failY: 14, resistance: 0.35 } as const;

/**
 * Índice do separador depois do gesto. Arrastar para a esquerda (dx < 0) vai para o seguinte; para a direita, para o
 * anterior. Nas pontas não sai do sítio.
 */
export function resolveSwipe(o: { dx: number; vx: number; index: number; count: number }): number {
  'worklet';
  const far = Math.abs(o.dx) >= SWIPE.distance;
  const fast = Math.abs(o.vx) >= SWIPE.velocity && Math.sign(o.vx) === Math.sign(o.dx);
  if (!far && !fast) return o.index;
  const next = o.dx < 0 ? o.index + 1 : o.index - 1;
  return next < 0 || next >= o.count ? o.index : next;
}

/** Arrasto visível: segue o dedo, com resistência nas pontas (não há separador para onde ir). */
export function dragOffset(o: { dx: number; index: number; count: number }): number {
  'worklet';
  const edge = (o.dx > 0 && o.index === 0) || (o.dx < 0 && o.index === o.count - 1);
  return edge ? o.dx * SWIPE.resistance * 0.4 : o.dx * SWIPE.resistance;
}
