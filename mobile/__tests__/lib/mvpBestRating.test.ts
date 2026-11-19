import { bestRatedIds, ratingTone } from '@/lib/mvpBestRating';

describe('bestRatedIds', () => {
  it('devolve o id com a nota mais alta', () => {
    expect(bestRatedIds([{ id: 'a', rating: 7.1 }, { id: 'b', rating: 8.6 }, { id: 'c', rating: 8.1 }])).toEqual(new Set(['b']));
  });

  it('empates ficam todos', () => {
    expect(bestRatedIds([{ id: 'a', rating: 8.6 }, { id: 'b', rating: 8.6 }, { id: 'c', rating: 7 }])).toEqual(new Set(['a', 'b']));
  });

  it('compara a nota como aparece (uma casa decimal): 8,64 e 8,6 empatam', () => {
    expect(bestRatedIds([{ id: 'a', rating: 8.64 }, { id: 'b', rating: 8.6 }])).toEqual(new Set(['a', 'b']));
  });

  it('sem notas: conjunto vazio', () => {
    expect(bestRatedIds([{ id: 'a', rating: null }, { id: 'b', rating: null }]).size).toBe(0);
    expect(bestRatedIds([]).size).toBe(0);
  });

  it('ignora quem não tem nota e notas inválidas', () => {
    expect(bestRatedIds([{ id: 'a', rating: null }, { id: 'b', rating: Number.NaN }, { id: 'c', rating: 6.2 }])).toEqual(new Set(['c']));
  });
});

describe('ratingTone', () => {
  it('limites 8.0 e 7.0', () => {
    expect(ratingTone(8)).toBe('high');
    expect(ratingTone(7.96)).toBe('high'); // aparece como 8,0
    expect(ratingTone(7.94)).toBe('mid');
    expect(ratingTone(7)).toBe('mid');
    expect(ratingTone(6.95)).toBe('mid'); // aparece como 7,0
    expect(ratingTone(6.94)).toBe('low');
    expect(ratingTone(0)).toBe('low');
  });
});
