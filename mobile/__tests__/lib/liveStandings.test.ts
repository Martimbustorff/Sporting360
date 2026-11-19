// Classificação ao vivo: projeção sobre a tabela oficial (3/1/0 pontos) e documento de jogos ao vivo velho.
import type { LiveFixture, StandingRow } from '@/data/schemas';
import { LIVE_MAX_AGE_MS, LIVE_MAX_SKEW_MS, finishedResults, liveStandingsAvailable, projectStandings, zoneOf } from '@/lib/liveStandings';

function row(rank: number, teamId: string, name: string, points: number, o: Partial<StandingRow> = {}): StandingRow {
  return {
    rank,
    teamId,
    name,
    logo: null,
    points,
    played: 12,
    win: 0,
    draw: 0,
    lose: 0,
    goalsFor: 20,
    goalsAgainst: 10,
    goalsDiff: 10,
    form: null,
    description: null,
    ...o,
  } as StandingRow;
}
const live = (homeId: string, awayId: string, homeGoals: number, awayGoals: number): LiveFixture =>
  ({ homeId, awayId, homeGoals, awayGoals, elapsed: 67, status: '2H' }) as LiveFixture;

const official = [row(1, '228', 'Sporting', 28), row(2, '211', 'Benfica', 28), row(3, '212', 'FC Porto', 27), row(4, '217', 'Braga', 23)];
// Sporting 28 (+10), Benfica 28 (+10) -> Sporting à frente só pela ordem oficial.
const by = (rows: ReturnType<typeof projectStandings>['rows'], id: string) => rows.find((r) => r.teamId === id)!;

describe('projectStandings', () => {
  it('sem jogos ao vivo: a tabela oficial, delta 0 e sem resultado', () => {
    const { rows } = projectStandings(official, []);
    expect(rows.map((r) => r.teamId)).toEqual(['228', '211', '212', '217']);
    expect(rows.every((r) => r.delta === 0 && r.liveScore === null)).toBe(true);
    expect(rows.map((r) => r.points)).toEqual([28, 28, 27, 23]);
  });

  it('vitória: 3 pontos, mais um jogo, golos e diferença; o derrotado fica a 0', () => {
    const { rows } = projectStandings(official, [live('212', '217', 2, 0)]);
    const porto = by(rows, '212');
    expect(porto).toMatchObject({ points: 30, played: 13, win: 1, goalsFor: 22, goalsAgainst: 10, goalsDiff: 12, liveScore: '2-0' });
    const braga = by(rows, '217');
    expect(braga).toMatchObject({ points: 23, played: 13, lose: 1, goalsFor: 20, goalsAgainst: 12, goalsDiff: 8, liveScore: '0-2' });
    // FC Porto passa de 3.º para 1.º (30 pontos); Sporting e Benfica descem uma posição.
    expect(rows.map((r) => r.teamId)).toEqual(['212', '228', '211', '217']);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    expect(porto.delta).toBe(2);
    expect(by(rows, '228').delta).toBe(-1);
    expect(by(rows, '211').delta).toBe(-1);
    expect(braga.delta).toBe(0);
  });

  it('empate: 1 ponto para cada, uma só vez', () => {
    const { rows } = projectStandings(official, [live('228', '212', 1, 1)]);
    expect(by(rows, '228')).toMatchObject({ points: 29, played: 13, draw: 1, goalsFor: 21, goalsAgainst: 11, goalsDiff: 10, liveScore: '1-1' });
    expect(by(rows, '212')).toMatchObject({ points: 28, played: 13, draw: 1, liveScore: '1-1' });
    // Sporting 29 lidera; Benfica e FC Porto com 28 pontos e +10: o FC Porto passa pelos golos marcados (21 contra 20).
    expect(rows.map((r) => r.teamId)).toEqual(['228', '212', '211', '217']);
    expect(by(rows, '212').delta).toBe(1);
    expect(by(rows, '211').delta).toBe(-1);
  });

  it('ultrapassagem por diferença de golos: mesmos pontos, a melhor diferença sobe', () => {
    // A 20 pontos (+5), B 18 pontos (+9); B vence C por 3-0 e fica com 21 pontos (+12): passa à frente de A.
    const t = [row(1, 'A', 'A', 20, { goalsDiff: 5 }), row(2, 'B', 'B', 18, { goalsDiff: 9 }), row(3, 'C', 'C', 10, { goalsDiff: 0 })];
    const rows = projectStandings(t, [live('B', 'C', 3, 0)]).rows;
    expect(rows.map((r) => r.teamId)).toEqual(['B', 'A', 'C']);
    expect(rows[0]!).toMatchObject({ points: 21, goalsDiff: 12, delta: 1 });
    expect(rows[1]!.delta).toBe(-1);
    // Igualam em pontos (20 e 20): a diferença decide (+5 contra +9) e não a ordem oficial.
    const tie = [row(1, 'A', 'A', 20, { goalsDiff: 5 }), row(2, 'B', 'B', 17, { goalsDiff: 9 }), row(3, 'C', 'C', 10, { goalsDiff: 0 })];
    expect(projectStandings(tie, [live('B', 'C', 1, 0)]).rows.map((r) => r.teamId)).toEqual(['B', 'A', 'C']);
  });

  it('grupo de pontos com uma equipa em jogo: diferença de golos, depois golos marcados', () => {
    // A 20 (+5, 15 marcados) e B 17 (+2, 20 marcados); B vence C por 3-0: 20 pontos, +5, 23 marcados. Iguala A em pontos e
    // diferença; os golos marcados (23 contra 15) põem B à frente.
    const f = [row(1, 'A', 'A', 20, { goalsDiff: 5, goalsFor: 15 }), row(2, 'B', 'B', 17, { goalsDiff: 2, goalsFor: 20 }), row(3, 'C', 'C', 5, { goalsDiff: 0, goalsFor: 5 })];
    const rows = projectStandings(f, [live('B', 'C', 3, 0)]).rows;
    expect(rows.map((x) => x.teamId)).toEqual(['B', 'A', 'C']);
    expect(rows[0]!.delta).toBe(1);
    expect(rows[1]!.delta).toBe(-1);
  });

  it('equipas que não jogam com os mesmos pontos mantêm a ordem oficial (sem setas), mesmo com melhor diferença', () => {
    // C e D (não jogam) têm 15 pontos; D tem melhor diferença mas está atrás na tabela oficial: nada muda.
    // A e B jogam entre si (empate) e ficam noutros pontos.
    const t = [
      row(1, 'A', 'A', 30, { goalsDiff: 10 }),
      row(2, 'B', 'B', 25, { goalsDiff: 8 }),
      row(3, 'C', 'C', 15, { goalsDiff: 1, goalsFor: 10 }),
      row(4, 'D', 'D', 15, { goalsDiff: 9, goalsFor: 30 }),
    ];
    const rows = projectStandings(t, [live('A', 'B', 1, 1)]).rows;
    expect(rows.map((r) => r.teamId)).toEqual(['A', 'B', 'C', 'D']);
    expect(rows.map((r) => r.delta)).toEqual([0, 0, 0, 0]);
  });

  it('a ordem oficial é a posição na tabela recebida, não o campo rank', () => {
    const t = [row(7, 'A', 'A', 20), row(3, 'B', 'B', 20)]; // `rank` desalinhado da posição no array
    const rows = projectStandings(t, []).rows;
    expect(rows.map((r) => r.teamId)).toEqual(['A', 'B']);
    expect(rows.map((r) => r.rank)).toEqual([1, 2]);
    expect(rows.map((r) => r.delta)).toEqual([0, 0]);
  });

  it('pontos, diferença e golos marcados iguais com uma equipa em jogo: a ordem oficial', () => {
    const f = [row(1, 'A', 'A', 20, { goalsDiff: 5, goalsFor: 15 }), row(2, 'B', 'B', 20, { goalsDiff: 5, goalsFor: 15 }), row(3, 'C', 'C', 1)];
    expect(projectStandings(f, [live('A', 'C', 0, 0)]).rows.map((x) => x.teamId)).toEqual(['A', 'B', 'C']);
  });

  it('equipa fora da tabela é ignorada; o resultado de cada equipa é "seus-adversário"', () => {
    const { rows } = projectStandings(official, [live('228', '999', 3, 1)]);
    expect(by(rows, '228')).toMatchObject({ points: 31, liveScore: '3-1' });
    expect(rows).toHaveLength(4);
    const away = projectStandings(official, [live('999', '212', 0, 2)]).rows;
    expect(by(away, '212')).toMatchObject({ points: 30, liveScore: '2-0' });
  });

  it('não altera a tabela oficial recebida', () => {
    const copy = JSON.parse(JSON.stringify(official));
    projectStandings(official, [live('228', '212', 5, 0)]);
    expect(official).toEqual(copy);
  });
});

describe('projectStandings: confronto direto (regulamento da Liga Portugal)', () => {
  const res = (homeId: string, awayId: string, homeGoals: number, awayGoals: number) => ({ homeId, awayId, homeGoals, awayGoals });

  it('duas equipas a par: o confronto direto vence a diferença de golos geral', () => {
    // A 20 (+9) e B 20 (+2); B ganhou 2-0 a A. A perde ao vivo com C e continua a 20: B passa à frente.
    const t = [row(1, 'A', 'A', 20, { goalsDiff: 9 }), row(2, 'B', 'B', 20, { goalsDiff: 2 }), row(3, 'C', 'C', 5)];
    const rows = projectStandings(t, [live('A', 'C', 0, 1)], [res('B', 'A', 2, 0)]).rows;
    expect(rows.map((r) => r.teamId)).toEqual(['B', 'A', 'C']);
    expect(rows.map((r) => r.delta)).toEqual([1, -1, 0]);
    // Sem esse resultado: diferença de golos geral (A à frente).
    expect(projectStandings(t, [live('A', 'C', 0, 1)], []).rows.map((r) => r.teamId)).toEqual(['A', 'B', 'C']);
  });

  it('mini-liga a três: pontos iguais entre eles, decide a diferença nesses jogos e não a geral', () => {
    // Z sobe a 30 pontos com 1-0 ao vivo sobre V. X, Y, Z a 30. Entre eles: X 3-0 Y, Y 1-0 Z, Z 1-0 X (3 pontos cada).
    // Diferença nos jogos entre eles: X +2, Z 0, Y -2. A geral daria Y (+8), Z (+5), X (+1).
    const t = [
      row(1, 'X', 'X', 30, { goalsDiff: 1 }),
      row(2, 'Y', 'Y', 30, { goalsDiff: 8 }),
      row(3, 'Z', 'Z', 27, { goalsDiff: 5 }),
      row(4, 'V', 'V', 0, { goalsDiff: -20 }),
    ];
    const results = [res('X', 'Y', 3, 0), res('Y', 'Z', 1, 0), res('Z', 'X', 1, 0)];
    const rows = projectStandings(t, [live('Z', 'V', 1, 0)], results).rows;
    expect(rows.map((r) => r.teamId)).toEqual(['X', 'Z', 'Y', 'V']);
  });

  it('um jogo ao vivo entre as equipas empatadas conta como resultado entre elas', () => {
    // A 20 (+3) e B 17 (+9); B-A 1-0 ao vivo põe os dois a 20.
    const t = [row(1, 'A', 'A', 20, { goalsDiff: 3 }), row(2, 'B', 'B', 17, { goalsDiff: 9 }), row(3, 'C', 'C', 0)];
    // Só o jogo ao vivo entre eles (B 1-0): B tem 3 pontos no confronto, A 0.
    expect(projectStandings(t, [live('B', 'A', 1, 0)], []).rows.map((r) => r.teamId)).toEqual(['B', 'A', 'C']);
    // Com a ida A 3-0 B: 3 pontos cada, diferença A +2 e B -2: A à frente, apesar de B ter melhor diferença geral (+10 contra +2).
    expect(projectStandings(t, [live('B', 'A', 1, 0)], [res('A', 'B', 3, 0)]).rows.map((r) => r.teamId)).toEqual(['A', 'B', 'C']);
  });

  it('o jogo ao vivo não conta duas vezes se o calendário já o traz terminado', () => {
    const t = [row(1, 'A', 'A', 20, { goalsDiff: 3 }), row(2, 'B', 'B', 17, { goalsDiff: 9 }), row(3, 'C', 'C', 0)];
    // O calendário já tem B-A 1-0 como terminado (documento a chegar tarde): fica só o resultado ao vivo, como acima.
    const rows = projectStandings(t, [live('B', 'A', 1, 0)], [res('A', 'B', 3, 0), res('B', 'A', 1, 0)]).rows;
    expect(rows.map((r) => r.teamId)).toEqual(['A', 'B', 'C']);
  });

  it('sem calendário (omitido ou vazio): diferença de golos, golos marcados e ordem oficial', () => {
    const t = [row(1, 'A', 'A', 20, { goalsDiff: 5 }), row(2, 'B', 'B', 17, { goalsDiff: 9 }), row(3, 'C', 'C', 0)];
    const lv = [live('B', 'C', 3, 0)];
    expect(projectStandings(t, lv).rows.map((r) => r.teamId)).toEqual(['B', 'A', 'C']);
    expect(projectStandings(t, lv, []).rows.map((r) => r.teamId)).toEqual(['B', 'A', 'C']);
  });

  it('grupos sem equipa em jogo ignoram o confronto direto e mantêm a ordem oficial', () => {
    const t = [row(1, 'A', 'A', 30), row(2, 'B', 'B', 25), row(3, 'C', 'C', 15, { goalsDiff: 1 }), row(4, 'D', 'D', 15, { goalsDiff: 9 })];
    const rows = projectStandings(t, [live('A', 'B', 1, 1)], [res('D', 'C', 3, 0)]).rows;
    expect(rows.map((r) => r.teamId)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('empatadas também no confronto direto: diferença geral decide', () => {
    const t = [row(1, 'A', 'A', 20, { goalsDiff: 3 }), row(2, 'B', 'B', 20, { goalsDiff: 7 }), row(3, 'C', 'C', 0)];
    // Ida 1-1 e volta 0-0: 2 pontos cada e diferença 0 no confronto. A perde ao vivo 0-1 com C e continua a 20 (+2 contra +7):
    // B fica à frente pela diferença geral.
    const rows = projectStandings(t, [live('A', 'C', 0, 1)], [res('A', 'B', 1, 1), res('B', 'A', 0, 0)]).rows;
    expect(rows.map((r) => r.teamId)).toEqual(['B', 'A', 'C']);
  });
});

describe('projectStandings: confronto direto recursivo', () => {
  const res = (homeId: string, awayId: string, homeGoals: number, awayGoals: number) => ({ homeId, awayId, homeGoals, awayGoals });

  it('ciclo: B ganha a C, C ganha a A, A ganha a B; B e C ficam a par e B fica acima de C pelo jogo entre os dois', () => {
    // C sobe a 30 pontos com 1-0 ao vivo sobre E. Pontos entre eles 3 cada; diferença: A -2, B +1, C +1.
    // B e C ficam a par: reaplica-se só entre os dois (B 2-0 C). C tem melhor diferença geral que B, A a melhor de todas.
    const t = [
      row(1, 'A', 'A', 30, { goalsDiff: 20 }),
      row(2, 'B', 'B', 30, { goalsDiff: 1 }),
      row(3, 'C', 'C', 27, { goalsDiff: 9 }),
      row(4, 'E', 'E', 0, { goalsDiff: -20 }),
    ];
    const results = [res('B', 'C', 2, 0), res('C', 'A', 3, 0), res('A', 'B', 1, 0)];
    const rows = projectStandings(t, [live('C', 'E', 1, 0)], results).rows;
    expect(rows.map((r) => r.teamId)).toEqual(['B', 'C', 'A', 'E']);
  });

  it('4 equipas: o subgrupo repete o confronto sem os jogos contra a equipa já separada', () => {
    // D 27 sobe a 30 com 1-0 ao vivo sobre E. D ganhou a todos: 9 pontos no mini-campeonato, sozinha no topo.
    // A, B, C: A 3-0 B, B 1-0 C, C 1-0 A (3 pontos cada); com os jogos contra D (A 0-5, B 0-1, C 0-3) a diferença é -3 para os três.
    // Sem os jogos contra D: A +2, C 0, B -2. A diferença geral daria B, C, A.
    const t = [
      row(1, 'A', 'A', 30, { goalsDiff: 0 }),
      row(2, 'B', 'B', 30, { goalsDiff: 8 }),
      row(3, 'C', 'C', 30, { goalsDiff: 4 }),
      row(4, 'D', 'D', 27, { goalsDiff: 2 }),
      row(5, 'E', 'E', 0, { goalsDiff: -20 }),
    ];
    const results = [
      res('D', 'A', 5, 0),
      res('D', 'B', 1, 0),
      res('D', 'C', 3, 0),
      res('A', 'B', 3, 0),
      res('B', 'C', 1, 0),
      res('C', 'A', 1, 0),
    ];
    const rows = projectStandings(t, [live('D', 'E', 1, 0)], results).rows;
    expect(rows.map((r) => r.teamId)).toEqual(['D', 'A', 'C', 'B', 'E']);
  });

  it('subgrupo igual ao grupo: diferença geral, golos marcados e ordem oficial, sempre determinista', () => {
    // Três equipas, três empates 0-0 entre elas: nada separa no confronto, decide a geral e depois a oficial.
    const t = [
      row(1, 'A', 'A', 30, { goalsDiff: 1, goalsFor: 10 }),
      row(2, 'B', 'B', 30, { goalsDiff: 5, goalsFor: 10 }),
      row(3, 'C', 'C', 27, { goalsDiff: 5, goalsFor: 10 }),
      row(4, 'E', 'E', 0),
    ];
    const results = [res('A', 'B', 0, 0), res('B', 'C', 0, 0), res('C', 'A', 0, 0)];
    // C 27 +3 com 1-0 sobre E: GD +6 e 11 marcados, à frente de B (+5); A em último pela geral.
    expect(projectStandings(t, [live('C', 'E', 1, 0)], results).rows.map((r) => r.teamId)).toEqual(['C', 'B', 'A', 'E']);
  });
});

describe('finishedResults', () => {
  const item = (id: string, status: string, h: number | null, a: number | null, extra = {}) =>
    ({ id, status, home: { id: 'H' + id }, away: { id: 'A' + id }, score: { home: h, away: a, extraHome: null, extraAway: null, penaltyHome: null, penaltyAway: null }, ...extra }) as never;
  it('só jogos terminados com golos; ignora adiados, ao vivo e sem golos', () => {
    const r = finishedResults([item('1', 'FT', 2, 1), item('2', 'LIVE', 1, 0), item('3', 'PST', null, null), item('4', 'FT', null, null), item('5', 'NS', null, null)]);
    expect(r).toEqual([{ homeId: 'H1', awayId: 'A1', homeGoals: 2, awayGoals: 1 }]);
  });
});

describe('liveStandingsAvailable', () => {
  const now = new Date('2026-11-22T21:07:00Z');
  const doc = (ageMs: number, n = 1) => ({ updatedAt: new Date(now.getTime() - ageMs), fixtures: Array.from({ length: n }, () => live('228', '212', 2, 1)) });

  it('documento recente com jogos: disponível', () => {
    expect(liveStandingsAvailable(doc(60_000), now)).toBe(true);
    expect(liveStandingsAvailable(doc(LIVE_MAX_AGE_MS - 1), now)).toBe(true);
  });
  it('documento velho (5 min ou mais): escondido', () => {
    expect(liveStandingsAvailable(doc(LIVE_MAX_AGE_MS), now)).toBe(false);
    expect(liveStandingsAvailable(doc(20 * 60_000), now)).toBe(false);
  });
  it('sem jogos ou sem documento: escondido', () => {
    expect(liveStandingsAvailable(doc(1_000, 0), now)).toBe(false);
    expect(liveStandingsAvailable(null, now)).toBe(false);
  });
  it('relógio desalinhado: até 2 min no futuro ainda conta; mais do que isso, escondido', () => {
    expect(liveStandingsAvailable(doc(-60_000), now)).toBe(true);
    expect(liveStandingsAvailable(doc(-LIVE_MAX_SKEW_MS), now)).toBe(false);
    expect(liveStandingsAvailable(doc(-10 * 60_000), now)).toBe(false);
  });
});

describe('zoneOf', () => {
  it('lê a zona de `description`', () => {
    expect(zoneOf('Promotion - Champions League (Group Stage: )')).toBe('champions');
    expect(zoneOf('Promotion - Europa League (League phase: )')).toBe('europa');
    expect(zoneOf('Promotion - Conference League (Qualification: )')).toBe('conference');
    expect(zoneOf('Relegation - Liga Portugal 2')).toBeNull();
    expect(zoneOf(null)).toBeNull();
  });
});

describe('jogos FT mantidos pelo servidor até a oficial os contar', () => {
  it('o esquema aceita status FT, elapsed nulo e finishedAt, e a projeção conta o jogo', () => {
    const { LiveFixturesDocSchema } = jest.requireActual('@/data/schemas') as typeof import('@/data/schemas');
    const doc = LiveFixturesDocSchema.parse({
      updatedAt: new Date(),
      fixtures: [{ homeId: 212, awayId: '217', homeGoals: 2, awayGoals: 0, elapsed: null, status: 'FT', finishedAt: new Date() }],
    });
    expect(doc.fixtures[0]).toMatchObject({ homeId: '212', status: 'FT', elapsed: null });
    const { rows } = projectStandings(official, doc.fixtures);
    expect(by(rows, '212')).toMatchObject({ points: 30, liveScore: '2-0' });
    expect(liveStandingsAvailable({ updatedAt: new Date(), fixtures: doc.fixtures }, new Date())).toBe(true);
  });
});
