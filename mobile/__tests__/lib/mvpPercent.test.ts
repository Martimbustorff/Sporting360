import { mvpPercentages } from '@/lib/mvpPercent';

const tally = (counts: Record<string, number>, total: number) => ({ gameId: '1001', counts, total });

describe('mvpPercentages', () => {
  it('maior resto: empate no resto vai pela ordem de playerIds', () => {
    expect(mvpPercentages(tally({ a: 1, b: 1, c: 1 }, 3), ['a', 'b', 'c'])).toEqual({ a: 34, b: 33, c: 33 });
    expect(mvpPercentages(tally({ a: 1, b: 1, c: 1 }, 3), ['c', 'b', 'a'])).toEqual({ c: 34, b: 33, a: 33 });
  });

  it('2 de 3 e 1 de 3: 67 e 33', () => {
    expect(mvpPercentages(tally({ a: 2, b: 1 }, 3), ['a', 'b'])).toEqual({ a: 67, b: 33 });
  });

  it('total 0 devolve vazio', () => {
    expect(mvpPercentages(tally({}, 0), ['a', 'b'])).toEqual({});
  });

  it('candidato sem votos tem 0 e a soma é 100', () => {
    const r = mvpPercentages(tally({ a: 3, b: 1 }, 4), ['a', 'b', 'c']);
    expect(r).toEqual({ a: 75, b: 25, c: 0 });
    expect(Object.values(r).reduce((s, n) => s + n, 0)).toBe(100);
  });

  it('a soma é sempre 100 quando os votos são todos de candidatos', () => {
    const r = mvpPercentages(tally({ a: 7, b: 11, c: 13, d: 1 }, 32), ['a', 'b', 'c', 'd']);
    expect(Object.values(r).reduce((s, n) => s + n, 0)).toBe(100);
  });
});
