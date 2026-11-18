import { rankPositions } from '@/lib/ranking';

const e = (uid: string, points: number, displayName = `Nome ${uid}`) => ({ uid, displayName, points });

describe('rankPositions', () => {
  it('empates partilham a posição e a seguinte salta (1, 2, 2, 4)', () => {
    const out = rankPositions([e('a', 10), e('b', 8), e('c', 8), e('d', 5)]);
    expect(out.map((r) => r.position)).toEqual([1, 2, 2, 4]);
  });

  it('mantém a ordem do servidor e copia uid, nome e pontos', () => {
    const out = rankPositions([e('a', 10, 'Ana'), e('b', 3, 'Rui')]);
    expect(out).toEqual([
      { position: 1, uid: 'a', displayName: 'Ana', points: 10 },
      { position: 2, uid: 'b', displayName: 'Rui', points: 3 },
    ]);
  });

  it('todos empatados são 1.º; lista vazia dá lista vazia', () => {
    expect(rankPositions([e('a', 4), e('b', 4), e('c', 4)]).map((r) => r.position)).toEqual([1, 1, 1]);
    expect(rankPositions([])).toEqual([]);
  });

  it('não muta a lista recebida', () => {
    const input = [e('a', 2), e('b', 1)];
    const copy = JSON.parse(JSON.stringify(input));
    rankPositions(input);
    expect(input).toEqual(copy);
  });
});
