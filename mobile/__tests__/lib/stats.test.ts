import type { StatisticsDoc } from '@/data/schemas';
import { STAT_ORDER, hasHalves, isRatioStat, liveNumbers, partRows, statBars, statNumber, statRows } from '@/lib/stats';

const doc = (over: Partial<StatisticsDoc> = {}): StatisticsDoc =>
  ({
    teams: [
      { teamId: '228', items: { 'Ball Possession': '55%', 'Total Shots': 12, 'Yellow Cards': null, Fouls: 7 } },
      { teamId: '217', items: { 'Ball Possession': '45%', 'Total Shots': 4, 'Red Cards': 1 } },
    ],
    xg: { home: 1.43, away: 0.6 },
    ...over,
  }) as StatisticsDoc;

const row = (rows: ReturnType<typeof statRows>, label: string) => rows.find((r) => r.label === label)!;

describe('statRows', () => {
  it('10 linhas pela ordem do Figma', () => {
    const rows = statRows(doc(), '228', '217');
    expect(rows.map((r) => r.label)).toEqual(STAT_ORDER.map((s) => s.label));
    expect(rows).toHaveLength(10);
  });

  it('posse tal como vem, xG com vírgula decimal', () => {
    const rows = statRows(doc(), '228', '217');
    expect(row(rows, 'Posse de bola (%)')).toEqual({ label: 'Posse de bola (%)', home: '55%', away: '45%' });
    expect(row(rows, 'Golos esperados (xG)')).toEqual({ label: 'Golos esperados (xG)', home: '1,4', away: '0,6' });
    expect(row(rows, 'Total de remates')).toMatchObject({ home: '12', away: '4' });
  });

  it('casa e fora pelo teamId mesmo que teams[0] seja a equipa de fora', () => {
    const d = doc();
    d.teams.reverse();
    const rows = statRows(d, '228', '217');
    expect(row(rows, 'Posse de bola (%)')).toMatchObject({ home: '55%', away: '45%' });
    expect(row(rows, 'Total de remates')).toMatchObject({ home: '12', away: '4' });
    const swapped = statRows(d, '217', '228');
    expect(row(swapped, 'Posse de bola (%)')).toMatchObject({ home: '45%', away: '55%' });
  });

  it('valores nulos ou em falta ficam a zero', () => {
    const rows = statRows(doc({ xg: null }), '228', '217');
    expect(row(rows, 'Cartão amarelo')).toMatchObject({ home: '0', away: '0' });
    expect(row(rows, 'Cartão vermelho')).toMatchObject({ home: '0', away: '1' });
    expect(row(rows, 'Golos esperados (xG)')).toMatchObject({ home: '0', away: '0' });
  });

  it('sem documento (antes do jogo): 10 linhas a zero, posse "0%"', () => {
    const rows = statRows(null, '228', '217');
    expect(rows).toHaveLength(10);
    expect(row(rows, 'Posse de bola (%)')).toMatchObject({ home: '0%', away: '0%' });
    rows.filter((r) => r.label !== 'Posse de bola (%)').forEach((r) => expect(r).toMatchObject({ home: '0', away: '0' }));
  });

  it('equipa ausente no documento: zeros só desse lado', () => {
    const rows = statRows(doc({ teams: doc().teams.slice(0, 1) }), '228', '217');
    expect(row(rows, 'Posse de bola (%)')).toMatchObject({ home: '55%', away: '0%' });
  });
});

describe('statBars', () => {
  it('lidera quem tem o valor maior; a barra cresce pelo valor', () => {
    expect(statBars('58%', '42%')).toEqual({ home: { grow: 0.58, leader: true }, away: { grow: 0.42, leader: false } });
    expect(statBars('9', '13').away.leader).toBe(true);
    expect(statBars('9', '13').home.grow).toBeCloseTo(9 / 22);
  });

  it('xG com vírgula e valores a zero', () => {
    expect(statBars('1,4', '0,6').home.leader).toBe(true);
    expect(statBars('0', '4')).toEqual({ home: { grow: 0, leader: false }, away: { grow: 1, leader: true } });
  });

  it('empate (também 0 contra 0): sem líder, barras iguais', () => {
    expect(statBars('3', '3')).toEqual({ home: { grow: 0.5, leader: false }, away: { grow: 0.5, leader: false } });
    expect(statBars('0', '0')).toEqual({ home: { grow: 1, leader: false }, away: { grow: 1, leader: false } });
  });

  it('normaliza: xG 0,3 contra 0,2 enche a linha (soma 1)', () => {
    const b = statBars('0,3', '0,2');
    expect(b.home.grow + b.away.grow).toBeCloseTo(1);
    expect(b.home.grow).toBeCloseTo(0.6);
  });

  it('texto ilegível vale 0', () => {
    expect(statNumber('abc')).toBe(0);
    expect(statNumber('42%')).toBe(42);
  });
});

describe('partes (firstHalf gravado no intervalo)', () => {
  const half = () =>
    doc({
      xg: { home: 1.43, away: 0.6 },
      firstHalf: {
        teams: [
          { teamId: '228', items: { 'Ball Possession': '60%', 'Total Shots': 5, Fouls: null, 'Yellow Cards': 1 } },
          { teamId: '217', items: { 'Ball Possession': '40%', 'Total Shots': 3 } },
        ],
        xg: { home: 0.9, away: null },
      },
    } as never);
  const find = (rows: ReturnType<typeof partRows>, key: string) => rows.find((r) => r.key === key);

  it('hasHalves só com firstHalf; documento antigo sem partes não tem', () => {
    expect(hasHalves(half())).toBe(true);
    expect(hasHalves(doc())).toBe(false);
    expect(hasHalves(null)).toBe(false);
  });

  it('isRatioStat: posse e percentagens ou precisão', () => {
    expect(isRatioStat('Ball Possession')).toBe(true);
    expect(isRatioStat('Passes %')).toBe(true);
    expect(isRatioStat('Pass accuracy')).toBe(true);
    expect(isRatioStat('Total Shots')).toBe(false);
  });

  it('total é igual a statRows; 1.ª parte usa firstHalf (posse incluída)', () => {
    expect(partRows(half(), 'total', '228', '217').map(({ key: _k, ...r }) => r)).toEqual(statRows(half(), '228', '217'));
    const first = partRows(half(), 'first', '228', '217');
    expect(find(first, 'Ball Possession')).toMatchObject({ home: '60%', away: '40%' });
    expect(find(first, 'Total Shots')).toMatchObject({ home: '5', away: '3' });
    expect(find(first, 'xg')).toMatchObject({ home: '0,9', away: '0' });
  });

  it('2.ª parte = total menos 1.ª parte nas contagens; nulos contam 0; nunca negativo', () => {
    const second = partRows(half(), 'second', '228', '217');
    expect(find(second, 'Total Shots')).toMatchObject({ home: '7', away: '1' });
    expect(find(second, 'Fouls')).toMatchObject({ home: '7', away: '0' });
    expect(find(second, 'Yellow Cards')).toMatchObject({ home: '0', away: '0' });
    expect(find(second, 'xg')).toMatchObject({ home: '0,5', away: '0,6' });
    const odd = half() as { firstHalf: { teams: { items: Record<string, unknown> }[] } };
    odd.firstHalf.teams[0]!.items['Total Shots'] = 99;
    expect(find(partRows(odd as never, 'second', '228', '217'), 'Total Shots')).toMatchObject({ home: '0' });
  });

  it('2.ª parte esconde as percentagens (posse); 1.ª parte e total mantêm-nas', () => {
    expect(find(partRows(half(), 'second', '228', '217'), 'Ball Possession')).toBeUndefined();
    expect(partRows(half(), 'second', '228', '217')).toHaveLength(9);
    expect(find(partRows(half(), 'first', '228', '217'), 'Ball Possession')).toBeDefined();
    expect(find(partRows(half(), 'total', '228', '217'), 'Ball Possession')).toBeDefined();
  });

  it('sem partes: 1.ª e 2.ª parte caem no total', () => {
    expect(partRows(doc(), 'first', '228', '217')).toHaveLength(10);
    expect(find(partRows(doc(), 'second', '228', '217'), 'Total Shots')).toMatchObject({ home: '12' });
  });
});

describe('liveNumbers (Números do jogo, Figma 06)', () => {
  it('posse, remates e xG pela ordem do frame, com os rótulos do frame e os valores das linhas da tab Estatísticas', () => {
    const rows = liveNumbers(doc(), '228', '217');
    expect(rows).toEqual([
      { label: 'Posse de bola', home: '55%', away: '45%' },
      { label: 'Remates', home: '12', away: '4' },
      { label: 'Golos esperados (xG)', home: '1,4', away: '0,6' },
    ]);
  });

  it('só as linhas com dados dos dois lados: um lado em falta ou nulo esconde a linha', () => {
    const d = doc({
      teams: [
        { teamId: '228', items: { 'Ball Possession': '55%', 'Total Shots': 12 } },
        { teamId: '217', items: { 'Ball Possession': '45%', 'Total Shots': null } },
      ],
      xg: { home: 1.2, away: null },
    } as Partial<StatisticsDoc>);
    expect(liveNumbers(d, '228', '217').map((r) => r.label)).toEqual(['Posse de bola']);
  });

  it('um zero real (0 remates, xG 0) conta como dado', () => {
    const d = doc({
      teams: [
        { teamId: '228', items: { 'Total Shots': 0 } },
        { teamId: '217', items: { 'Total Shots': 3 } },
      ],
      xg: { home: 0, away: 0.2 },
    } as Partial<StatisticsDoc>);
    expect(liveNumbers(d, '228', '217')).toEqual([
      { label: 'Remates', home: '0', away: '3' },
      { label: 'Golos esperados (xG)', home: '0', away: '0,2' },
    ]);
  });

  it('sem documento ou sem nenhuma linha: lista vazia', () => {
    expect(liveNumbers(null, '228', '217')).toEqual([]);
    expect(liveNumbers({ teams: [], xg: null } as unknown as StatisticsDoc, '228', '217')).toEqual([]);
  });
});
