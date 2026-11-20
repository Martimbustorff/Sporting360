import { FANS_MIN, fansView, splitPercents } from '@/lib/fansPrediction';

describe('splitPercents (soma sempre 100)', () => {
  it('68/21/11', () => expect(splitPercents({ win: 68, draw: 21, loss: 11 })).toEqual([68, 21, 11]));
  it('arredonda pelo maior resto', () => expect(splitPercents({ win: 1, draw: 1, loss: 1 })).toEqual([34, 33, 33]));
  it('zeros -> zeros', () => expect(splitPercents({ win: 0, draw: 0, loss: 0 })).toEqual([0, 0, 0]));
});

describe('fansView', () => {
  const doc = (total: number, split?: { win: number; draw: number; loss: number }) => ({ gameId: 'g', total, ...split });

  it(`abaixo de ${FANS_MIN} palpites não mostra nada, antes ou depois do apito`, () => {
    expect(fansView(doc(49), 'scheduled')).toBeNull();
    expect(fansView(doc(49, { win: 40, draw: 5, loss: 4 }), 'live')).toBeNull();
  });
  it('antes do apito: só a contagem', () => {
    expect(fansView(doc(1234), 'scheduled')).toEqual({ kind: 'count', total: 1234 });
  });
  it('antes do apito nunca mostra percentagens, mesmo que existam', () => {
    expect(fansView(doc(60, { win: 50, draw: 5, loss: 5 }), 'scheduled')).toEqual({ kind: 'count', total: 60 });
  });
  it('ao vivo e terminado: percentagens com o maior destacado', () => {
    const v = { kind: 'split', percents: [68, 21, 11], top: 0 };
    expect(fansView(doc(100, { win: 68, draw: 21, loss: 11 }), 'live')).toEqual(v);
    expect(fansView(doc(100, { win: 68, draw: 21, loss: 11 }), 'finished')).toEqual(v);
  });
  it('ao vivo sem percentagens publicadas (primeiro minuto): nada', () => {
    expect(fansView(doc(100), 'live')).toBeNull();
  });
  it('adiado ou cancelado: nada', () => {
    expect(fansView(doc(100), 'postponed')).toBeNull();
    expect(fansView(doc(100, { win: 1, draw: 1, loss: 98 }), 'cancelled')).toBeNull();
  });
  it('sem documento: nada', () => expect(fansView(null, 'scheduled')).toBeNull());
});
