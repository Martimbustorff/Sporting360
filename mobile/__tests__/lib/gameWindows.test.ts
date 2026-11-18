// Task 16: janela do prognóstico. Vetores copiados de functions/test/unit/windows.test.ts (describe "predictionOpen").
import { clockText, GameActionError, isKnockoutGame, predictionOpen } from '@/lib/gameWindows';
import type { GameStatus } from '@/data/schemas';

const game = (over: { kickoff?: Date; status?: GameStatus } = {}) => ({
  kickoff: new Date('2026-11-21T20:00:00Z'),
  status: 'NS' as GameStatus,
  ...over,
});

describe('predictionOpen (vetores do servidor)', () => {
  const kickoff = new Date('2026-11-21T20:00:00Z');

  it('is open one minute before kickoff and closed at kickoff', () => {
    const g = game({ kickoff });
    expect(predictionOpen(g, new Date('2026-11-21T19:59:00Z'))).toBe(true);
    expect(predictionOpen(g, new Date('2026-11-21T20:00:00Z'))).toBe(false);
  });

  it('is closed after kickoff even while not started', () => {
    expect(predictionOpen(game({ kickoff }), new Date('2026-11-21T20:05:00Z'))).toBe(false);
  });

  it('is closed for any status other than NS', () => {
    const now = new Date('2026-11-21T10:00:00Z');
    for (const status of ['LIVE', 'HT', 'FT', 'AET', 'PEN', 'PST', 'CANC'] as const) {
      expect(predictionOpen(game({ kickoff, status }), now)).toBe(false);
    }
  });

  it('stays closed while postponed and reopens when NS with the new kickoff', () => {
    const original = new Date('2026-11-21T20:00:00Z');
    const moved = new Date('2026-11-22T20:00:00Z');
    const now = new Date('2026-11-21T19:00:00Z');

    expect(predictionOpen(game({ kickoff: original, status: 'PST' }), now)).toBe(false);
    expect(predictionOpen(game({ kickoff: moved, status: 'NS' }), now)).toBe(true);
    expect(predictionOpen(game({ kickoff: moved, status: 'NS' }), new Date('2026-11-22T19:59:00Z'))).toBe(true);
    expect(predictionOpen(game({ kickoff: moved, status: 'NS' }), moved)).toBe(false);
  });
});

describe('clockText', () => {
  it('mm:ss com zeros à esquerda', () => {
    expect(clockText(65_000)).toBe('01:05');
    expect(clockText(9 * 60_000 + 59_999)).toBe('09:59');
  });
  it('minutos acima de 59 não passam a horas', () => {
    expect(clockText(75 * 60_000)).toBe('75:00');
  });
  it('negativo fica em 00:00', () => {
    expect(clockText(-5_000)).toBe('00:00');
  });
});

describe('GameActionError', () => {
  it('é um Error com o código', () => {
    const e = new GameActionError('OFFLINE');
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe('OFFLINE');
    expect(e.name).toBe('GameActionError');
  });
});

// Task 17 (carry da revisão da Task 16): o servidor conta prolongamento e penáltis como empate em qualquer jogo
// (functions/src/game/result.ts); a nota aparece em todos os jogos a eliminar: taças, supertaça e fases a eliminar europeias.
describe('isKnockoutGame', () => {
  const c = (type: 'league' | 'cup' | 'supercup' | 'europe' | 'friendly', round: string | null) => ({ type, round });
  it.each([
    [c('cup', '4th Round'), true],
    [c('cup', 'Something new'), true],
    [c('supercup', 'Final'), true],
    [c('europe', 'Round of 16'), true],
    [c('europe', 'Knockout Round Play-offs'), true],
    [c('europe', 'Quarter-finals'), true],
    [c('europe', '3rd Qualifying Round'), true],
    [c('europe', 'Final'), true],
    [c('europe', 'League Stage - 3'), false],
    [c('europe', 'Group A - 2'), false],
    [c('europe', null), false],
    [c('league', 'Regular Season - 12'), false],
    [c('friendly', 'Final'), false],
  ])('%j → %s', (comp, expected) => {
    expect(isKnockoutGame(comp)).toBe(expected);
  });
});
