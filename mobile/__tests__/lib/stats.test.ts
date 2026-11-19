import type { StatisticsDoc } from '@/data/schemas';
import { STAT_ORDER, statBars, statNumber, statPeriods, statRows } from '@/lib/stats';

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
    expect(statBars('58%', '42%')).toEqual({ home: { grow: 58, leader: true }, away: { grow: 42, leader: false } });
    expect(statBars('9', '13')).toEqual({ home: { grow: 9, leader: false }, away: { grow: 13, leader: true } });
  });

  it('xG com vírgula e valores a zero', () => {
    expect(statBars('1,4', '0,6').home.leader).toBe(true);
    expect(statBars('0', '4')).toEqual({ home: { grow: 0, leader: false }, away: { grow: 4, leader: true } });
  });

  it('empate (também 0 contra 0): sem líder, barras iguais', () => {
    expect(statBars('3', '3')).toEqual({ home: { grow: 3, leader: false }, away: { grow: 3, leader: false } });
    expect(statBars('0', '0')).toEqual({ home: { grow: 1, leader: false }, away: { grow: 1, leader: false } });
  });

  it('texto ilegível vale 0', () => {
    expect(statNumber('abc')).toBe(0);
    expect(statNumber('42%')).toBe(42);
  });
});

describe('statPeriods', () => {
  const part = { teams: [{ teamId: '228', items: { Fouls: 3 } }], xg: null };
  it('sem documento ou sem partes: null', () => {
    expect(statPeriods(null)).toBeNull();
    expect(statPeriods(doc())).toBeNull();
    expect(statPeriods(doc({ periods: { first: part, second: null } }))).toBeNull();
  });
  it('com as duas partes: Jogo, 1.ª parte e 2.ª parte', () => {
    const p = statPeriods(doc({ periods: { first: part, second: part } }));
    expect(p?.map((x) => x.label)).toEqual(['Jogo', '1.ª parte', '2.ª parte']);
    expect(p?.[1]?.doc.teams).toBe(part.teams);
  });
});
