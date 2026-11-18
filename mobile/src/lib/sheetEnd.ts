// Decisão de fim de arrasto do Sheet, pura para ser testável (corre também como worklet).
// position: 0 = aberta, range = fechada (px, já com resistência aplicada); velocity: px/s, negativo = para cima.
export function resolveSheetEnd(args: {
  position: number;
  velocity: number;
  open: boolean;
  range: number;
  flickVelocity: number;
}): { wantOpen: boolean; changed: boolean } {
  'worklet';
  const { position, velocity, open, range, flickVelocity } = args;
  const wantOpen = Math.abs(velocity) > flickVelocity ? velocity < 0 : position < range / 2;
  return { wantOpen, changed: wantOpen !== open };
}
