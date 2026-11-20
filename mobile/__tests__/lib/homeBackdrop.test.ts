import { homeBackdropLayout } from '@/lib/homeBackdrop';

// Telemóveis pequenos, médios, altos e largos, e tablets (retrato).
const SIZES: Array<[number, number]> = [
  [320, 568],
  [360, 640],
  [375, 667],
  [360, 800],
  [393, 852],
  [402, 874],
  [412, 915],
  [440, 956],
  [768, 1024],
  [1024, 1366],
];

describe('homeBackdropLayout', () => {
  it.each(SIZES)('em %i x %i o leão cobre a largura e o fundo do ecrã, sem arestas à vista', (w, h) => {
    const l = homeBackdropLayout(w, h);
    expect(l.lion.left).toBeLessThanOrEqual(0);
    expect(l.lion.left + l.lion.width).toBeGreaterThanOrEqual(w);
    expect(l.lion.top + l.lion.height).toBeGreaterThanOrEqual(h);
  });

  it.each(SIZES)('em %i x %i o topo é verde limpo: o véu tapa a aresta de cima do leão', (w, h) => {
    const l = homeBackdropLayout(w, h);
    expect(l.veil.solidTo * h).toBeGreaterThanOrEqual(Math.max(l.lion.top, 0));
    expect(l.veil.solidTo).toBeLessThan(l.veil.fadeTo);
    expect(l.veil.solidTo).toBeGreaterThanOrEqual(0);
    expect(l.veil.fadeTo).toBeLessThanOrEqual(1);
  });

  it.each(SIZES.filter(([w, h]) => h / w >= 1.7))('em %i x %i (telemóvel) o leão começa abaixo de um quinto do ecrã', (w, h) => {
    expect(homeBackdropLayout(w, h).lion.top).toBeGreaterThanOrEqual(h * 0.2);
  });

  it.each(SIZES)('em %i x %i os anéis escalam com a largura e ficam centrados no olho do leão, abaixo do meio do cartão', (w, h) => {
    const l = homeBackdropLayout(w, h);
    expect(l.rings.size).toBeCloseTo(w * 1.5, 5);
    const cy = l.rings.top + l.rings.size / 2;
    expect(cy).toBeGreaterThan(l.lion.top);
    expect(cy).toBeLessThan(h);
    expect(l.rings.left + l.rings.size / 2).toBeCloseTo(w * 0.8, 5);
  });

  it('mantém as proporções da imagem do leão (679 x 527)', () => {
    const l = homeBackdropLayout(402, 874);
    expect(l.lion.width / l.lion.height).toBeCloseTo(679 / 527, 5);
  });

  it('em ecrãs largos (paisagem) continua a cobrir a largura', () => {
    const l = homeBackdropLayout(956, 440);
    expect(l.lion.left).toBeLessThanOrEqual(0);
    expect(l.lion.left + l.lion.width).toBeGreaterThanOrEqual(956);
    expect(l.lion.top + l.lion.height).toBeGreaterThanOrEqual(440);
  });

  it('o esbatido de baixo escala com a altura', () => {
    expect(homeBackdropLayout(402, 874).fadeHeight).toBeCloseTo(220, 5);
    expect(homeBackdropLayout(440, 956).fadeHeight).toBeCloseTo((220 / 874) * 956, 5);
  });

  it('sem medidas (0 x 0) devolve números finitos', () => {
    const l = homeBackdropLayout(0, 0);
    for (const v of [l.lion.left, l.lion.top, l.lion.width, l.lion.height, l.rings.left, l.rings.top, l.rings.size, l.veil.solidTo, l.veil.fadeTo, l.fadeHeight]) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});
