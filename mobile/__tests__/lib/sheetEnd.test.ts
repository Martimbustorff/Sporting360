import { resolveSheetEnd } from '@/lib/sheetEnd';

const base = { range: 400, flickVelocity: 500 };

describe('resolveSheetEnd', () => {
  it('sem velocidade: abaixo de metade abre, acima fecha', () => {
    expect(resolveSheetEnd({ ...base, position: 150, velocity: 0, open: false }).wantOpen).toBe(true);
    expect(resolveSheetEnd({ ...base, position: 250, velocity: 0, open: true }).wantOpen).toBe(false);
  });
  it('flick para cima abre mesmo perto do fundo', () => {
    expect(resolveSheetEnd({ ...base, position: 390, velocity: -800, open: false }).wantOpen).toBe(true);
  });
  it('flick para baixo fecha mesmo perto do topo', () => {
    expect(resolveSheetEnd({ ...base, position: 10, velocity: 800, open: true }).wantOpen).toBe(false);
  });
  it('velocidade abaixo do limiar não conta como flick', () => {
    expect(resolveSheetEnd({ ...base, position: 300, velocity: -400, open: false }).wantOpen).toBe(false);
  });
  it('sem mudança de estado: changed é false (não chama onOpenChange)', () => {
    expect(resolveSheetEnd({ ...base, position: 10, velocity: 0, open: true }).changed).toBe(false);
    expect(resolveSheetEnd({ ...base, position: 390, velocity: 0, open: false }).changed).toBe(false);
  });
  it('mudança de estado: changed é true', () => {
    expect(resolveSheetEnd({ ...base, position: 10, velocity: 0, open: false }).changed).toBe(true);
  });
});
