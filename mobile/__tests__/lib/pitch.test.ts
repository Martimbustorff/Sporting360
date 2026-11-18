// Task 11: funções puras do campo (Formações).
import type { LineupPlayer, PlayersDoc } from '@/data/schemas';
import { pitchName, pitchRows, ratingOf } from '@/lib/pitch';

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
