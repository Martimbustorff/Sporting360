// Classificação ao vivo: projeção sobre a tabela oficial (3/1/0 pontos) e documento de jogos ao vivo velho.
import type { LiveFixture, StandingRow } from '@/data/schemas';
import { LIVE_MAX_AGE_MS, liveStandingsAvailable, projectStandings, zoneOf } from '@/lib/liveStandings';

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

  it('mesmos pontos e diferença: desempata pelos golos marcados', () => {
    const f = [row(1, 'A', 'A', 20, { goalsDiff: 5, goalsFor: 15 }), row(2, 'B', 'B', 20, { goalsDiff: 5, goalsFor: 26 })];
    const rows = projectStandings(f, []).rows;
    expect(rows.map((x) => x.teamId)).toEqual(['B', 'A']);
    // A ordem muda face à oficial (B era 2.º): sem jogos, o delta mede essa mudança.
    expect(rows[0]!.delta).toBe(1);
    expect(rows[1]!.delta).toBe(-1);
  });

  it('pontos e diferença iguais e golos marcados iguais: a ordem oficial', () => {
    const f = [row(1, 'A', 'A', 20, { goalsDiff: 5, goalsFor: 15 }), row(2, 'B', 'B', 20, { goalsDiff: 5, goalsFor: 15 })];
    expect(projectStandings(f, []).rows.map((x) => x.teamId)).toEqual(['A', 'B']);
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
  it('sem jogos, sem documento ou com data no futuro além da tolerância: escondido', () => {
    expect(liveStandingsAvailable(doc(1_000, 0), now)).toBe(false);
    expect(liveStandingsAvailable(null, now)).toBe(false);
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
