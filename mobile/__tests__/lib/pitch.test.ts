// Task 11: funções puras do campo (Formações).
import type { LineupPlayer, PlayersDoc } from '@/data/schemas';
import { enteredText, goalsMap, photosMap, pitchName, pitchRows, ratingNumbers, ratingOf } from '@/lib/pitch';

const p = (playerId: string, grid: string | null, pos: string | null = null): LineupPlayer => ({
  playerId,
  name: `Jogador ${playerId}`,
  number: Number(playerId),
  pos,
  grid,
});

describe('pitchRows', () => {
  it('agrupa por linha da grelha (asc) e ordena por coluna', () => {
    const xi = [
      p('9', '4:2'), p('2', '2:1'), p('1', '1:1'), p('5', '2:4'), p('3', '2:2'), p('4', '2:3'),
      p('6', '3:1'), p('8', '3:3'), p('7', '3:2'), p('11', '4:3'), p('10', '4:1'),
    ];
    const rows = pitchRows(xi);
    expect(rows.map((r) => r.length)).toEqual([1, 4, 3, 3]);
    expect(rows.map((r) => r.map((x) => x.playerId))).toEqual([
      ['1'], ['2', '3', '4', '5'], ['6', '7', '8'], ['10', '9', '11'],
    ]);
  });

  it('linha 10 fica depois da linha 2 (ordem numérica, não de texto)', () => {
    expect(pitchRows([p('b', '10:1'), p('a', '2:1')]).map((r) => r[0]?.playerId)).toEqual(['a', 'b']);
  });

  it('com um jogador sem grid, agrupa por pos na ordem G, D, M, F', () => {
    const xi = [p('9', '4:1', 'F'), p('1', '1:1', 'G'), p('6', null, 'M'), p('2', '2:1', 'D'), p('3', '2:2', 'D')];
    const rows = pitchRows(xi);
    expect(rows.map((r) => r.map((x) => x.playerId))).toEqual([['1'], ['2', '3'], ['6'], ['9']]);
  });

  it('pos desconhecida vai para o fim, sem perder jogadores', () => {
    const rows = pitchRows([p('1', null, 'G'), p('x', null, null)]);
    expect(rows.map((r) => r.map((x) => x.playerId))).toEqual([['1'], ['x']]);
  });

  it('onze vazio: sem linhas', () => {
    expect(pitchRows([])).toEqual([]);
  });
});

describe('ratingOf', () => {
  const doc: PlayersDoc = {
    teams: [
      { teamId: '228', players: [{ playerId: '10', rating: 7.25 } as never, { playerId: '11', rating: null } as never] },
      { teamId: '217', players: [{ playerId: '20', rating: 6 } as never] },
    ],
  };

  it('uma casa decimal com vírgula', () => {
    expect(ratingOf(doc, '10')).toBe('7,3');
    expect(ratingOf(doc, '20')).toBe('6,0');
  });

  it('sem nota, sem jogador ou sem documento: null', () => {
    expect(ratingOf(doc, '11')).toBeNull();
    expect(ratingOf(doc, '99')).toBeNull();
    expect(ratingOf(null, '10')).toBeNull();
  });
});

describe('pitchName', () => {
  it('tira as iniciais do formato da API', () => {
    expect(pitchName('G. Inácio')).toBe('Inácio');
    expect(pitchName('F. J. Quenda')).toBe('Quenda');
  });

  it('nome completo sem iniciais: último apelido', () => {
    expect(pitchName('Pedro Gonçalves')).toBe('Gonçalves');
    expect(pitchName('Hjulmand')).toBe('Hjulmand');
  });

  it('com iniciais e vários apelidos fica com os apelidos todos (o campo corta com reticências)', () => {
    expect(pitchName('P. Gonçalves dos Santos Silva')).toBe('Gonçalves dos Santos Silva');
  });
});

describe('ratingNumbers, photosMap e enteredText', () => {
  const doc = { teams: [{ teamId: '1', players: [
    { playerId: 'a', rating: 7.96, photo: 'https://x/a.png' },
    { playerId: 'b', rating: null, photo: null },
    { playerId: 'c', rating: Number.NaN, photo: '' },
  ] }] } as never;
  it('só jogadores com nota válida, arredondada a uma casa', () => {
    expect(ratingNumbers(doc)).toEqual({ a: 8 });
    expect(ratingNumbers(null)).toEqual({});
  });
  it('só jogadores com foto', () => {
    expect(photosMap(doc)).toEqual({ a: 'https://x/a.png' });
  });
  it('"entrou aos X\'" com descontos', () => {
    expect(enteredText(67, null)).toBe("entrou aos 67'");
    expect(enteredText(90, 2)).toBe("entrou aos 90+2'");
  });
});

describe('pitchRowPositions (20/11: médios na linha do meio-campo)', () => {
  const { pitchRowPositions } = require('@/lib/pitch') as typeof import('@/lib/pitch');
  it('4-3-3 (4 linhas): avançados em cima, médios a 0,5, defesa e guarda-redes em baixo', () => {
    expect(pitchRowPositions(4)).toEqual([0.2, 0.5, 0.74, 0.94]);
  });
  it('4-2-3-1 (5 linhas): as duas linhas do meio centradas no meio-campo', () => {
    const p = pitchRowPositions(5);
    expect(p).toHaveLength(5);
    expect((p[1]! + p[2]!) / 2).toBeCloseTo(0.5);
    expect(p[0]!).toBeLessThan(p[1]!);
    expect(p[3]).toBe(0.74);
  });
  it('sempre crescente e dentro do relvado', () => {
    for (let n = 1; n <= 7; n++) {
      const p = pitchRowPositions(n);
      expect(p).toHaveLength(n);
      p.forEach((x, i) => {
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(1);
        if (i > 0) expect(x).toBeGreaterThan(p[i - 1]!);
      });
    }
  });
});

describe('goalsMap (21/11)', () => {
  const g = (playerId: string | null, detail = 'Normal Goal', comments: string | null = null) =>
    ({ minute: 10, extra: null, teamId: '228', playerId, assistId: null, type: 'goal', detail, comments }) as never;
  it('conta golos por jogador, sem autogolos, penáltis falhados nem desempate', () => {
    const ev = { items: [g('1'), g('1', 'Penalty'), g('2', 'Own Goal'), g('3', 'Missed Penalty'), g('4', 'Penalty', 'Penalty Shootout'), g(null)] };
    expect(goalsMap(ev as never)).toEqual({ '1': 2 });
    expect(goalsMap(null)).toEqual({});
  });
});
