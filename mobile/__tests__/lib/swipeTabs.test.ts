import { dragOffset, resolveSwipe, SWIPE } from '@/lib/swipeTabs';

describe('resolveSwipe (20/11: passar de separador com o dedo)', () => {
  const at = (dx: number, vx = 0, index = 1, count = 5) => resolveSwipe({ dx, vx, index, count });
  it('arrastar para a esquerda vai para o seguinte; para a direita, para o anterior', () => {
    expect(at(-SWIPE.distance)).toBe(2);
    expect(at(SWIPE.distance)).toBe(0);
  });
  it('arrasto curto e lento não muda', () => {
    expect(at(-(SWIPE.distance - 1), -100)).toBe(1);
  });
  it('gesto rápido muda mesmo curto, se a velocidade for no mesmo sentido', () => {
    expect(at(-30, -SWIPE.velocity)).toBe(2);
    expect(at(-30, SWIPE.velocity)).toBe(1);
  });
  it('nas pontas não sai do sítio', () => {
    expect(at(SWIPE.distance * 2, 0, 0)).toBe(0);
    expect(at(-SWIPE.distance * 2, 0, 4, 5)).toBe(4);
  });
});

describe('dragOffset', () => {
  it('segue o dedo com resistência, e mais resistência nas pontas', () => {
    expect(dragOffset({ dx: -100, index: 1, count: 3 })).toBeCloseTo(-100 * SWIPE.resistance);
    expect(Math.abs(dragOffset({ dx: 100, index: 0, count: 3 }))).toBeLessThan(100 * SWIPE.resistance);
  });
});
