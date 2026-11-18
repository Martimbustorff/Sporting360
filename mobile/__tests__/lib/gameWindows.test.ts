// Task 16: janela do prognóstico. Vetores copiados de functions/test/unit/windows.test.ts (describe "predictionOpen").
import {
  clockText,
  GameActionError,
  isKnockoutGame,
  MVP_CLOSE_AFTER_MS,
  MVP_OPEN_ELAPSED,
  mvpCandidates,
  mvpWindow,
  predictionOpen,
} from '@/lib/gameWindows';
import type { GameStatus, PlayersDoc } from '@/data/schemas';

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

// Task 18: janela do MVP. Vetores copiados de functions/test/unit/windows.test.ts (describe "mvpWindow").
describe('mvpWindow (vetores do servidor)', () => {
  const g = (over: { status?: GameStatus; elapsed?: number | null; finishedAt?: Date | null } = {}) => ({
    status: 'NS' as GameStatus,
    elapsed: null,
    finishedAt: null,
    ...over,
  });

  it('constantes: fecha 20 min depois do apito final, abre ao minuto 80', () => {
    expect(MVP_CLOSE_AFTER_MS).toBe(20 * 60_000);
    expect(MVP_OPEN_ELAPSED).toBe(80);
  });

  it.each([95, 105])('LIVE with elapsed %i is open', (elapsed) => {
    expect(mvpWindow(g({ status: 'LIVE', elapsed }), new Date('2026-11-21T21:50:00Z'))).toEqual({ state: 'open', closesAt: null });
  });

  it('LIVE with elapsed 79 is before', () => {
    expect(mvpWindow(g({ status: 'LIVE', elapsed: 79 }), new Date('2026-11-21T21:19:00Z'))).toEqual({ state: 'before', closesAt: null });
  });

  it('LIVE with elapsed 80 is open with no close time', () => {
    expect(mvpWindow(g({ status: 'LIVE', elapsed: 80 }), new Date('2026-11-21T21:20:00Z'))).toEqual({ state: 'open', closesAt: null });
  });

  it('LIVE with null elapsed is before', () => {
    expect(mvpWindow(g({ status: 'LIVE', elapsed: null }), new Date('2026-11-21T21:30:00Z'))).toEqual({ state: 'before', closesAt: null });
  });

  it('HT is before', () => {
    expect(mvpWindow(g({ status: 'HT', elapsed: 45 }), new Date('2026-11-21T20:45:00Z'))).toEqual({ state: 'before', closesAt: null });
  });

  it('FT 21:52 is open until 22:12 and closed from 22:12', () => {
    const finishedAt = new Date('2026-11-21T21:52:00Z');
    const closesAt = new Date('2026-11-21T22:12:00Z');
    const m = g({ status: 'FT', finishedAt });
    expect(mvpWindow(m, new Date('2026-11-21T22:11:00Z'))).toEqual({ state: 'open', closesAt });
    expect(mvpWindow(m, new Date('2026-11-21T22:12:00Z'))).toEqual({ state: 'closed', closesAt });
  });

  it('AET and PEN use the same post-match window', () => {
    const finishedAt = new Date('2026-11-21T21:52:00Z');
    const closesAt = new Date('2026-11-21T22:12:00Z');
    for (const status of ['AET', 'PEN'] as const) {
      const m = g({ status, finishedAt });
      expect(mvpWindow(m, new Date('2026-11-21T22:11:00Z'))).toEqual({ state: 'open', closesAt });
      expect(mvpWindow(m, new Date('2026-11-21T22:12:00Z'))).toEqual({ state: 'closed', closesAt });
    }
  });

  it('finished match with null finishedAt is before with no close time', () => {
    expect(mvpWindow(g({ status: 'FT', finishedAt: null }), new Date('2026-11-21T23:00:00Z'))).toEqual({ state: 'before', closesAt: null });
  });

  it('PST, CANC and NS are before', () => {
    const now = new Date('2026-11-21T23:00:00Z');
    for (const status of ['PST', 'CANC', 'NS'] as const) {
      expect(mvpWindow(g({ status }), now)).toEqual({ state: 'before', closesAt: null });
    }
  });
});

// Task 18: candidatos. Vetores de functions/test/unit/mvp.test.ts (describe "mvpCandidates"), no formato PlayersDoc.
describe('mvpCandidates (vetores do servidor)', () => {
  const line = (playerId: string, name: string, minutes: number | null, number: number | null = null) =>
    ({ playerId, name, minutes, number, photo: null, position: null, rating: 7 }) as PlayersDoc['teams'][number]['players'][number];
  const doc = (sporting: ReturnType<typeof line>[], other: ReturnType<typeof line>[] = []): PlayersDoc => ({
    teams: [
      { teamId: '228', players: sporting },
      { teamId: '217', players: other },
    ],
  });

  it('exclui adversários e jogadores do Sporting com minutes 0 ou null', () => {
    const d = doc(
      [line('s1', 'Pote', 45, 8), line('s2', 'Banco', 0), line('s3', 'Não entrou', null)],
      [line('a1', 'Adversário', 90)],
    );
    expect(mvpCandidates(d)).toEqual([{ playerId: 's1', name: 'Pote', number: 8 }]);
  });

  it('ordena os candidatos por nome com localeCompare pt', () => {
    const d = doc([line('p3', 'Zeca', 90), line('p1', 'Ábel', 90), line('p2', 'Bruno', 90)]);
    expect(mvpCandidates(d).map((p) => p.name)).toEqual(['Ábel', 'Bruno', 'Zeca'].sort((a, b) => a.localeCompare(b, 'pt')));
    expect(mvpCandidates(d).map((p) => p.playerId)).toEqual(['p1', 'p2', 'p3']);
  });

  it('sem documento ou sem a equipa do Sporting: lista vazia', () => {
    expect(mvpCandidates(null)).toEqual([]);
    expect(mvpCandidates({ teams: [{ teamId: '217', players: [line('a1', 'Adversário', 90)] }] })).toEqual([]);
  });

  it('aceita outra equipa como Sporting (parâmetro)', () => {
    const d = doc([line('s1', 'Pote', 90)], [line('a1', 'Adversário', 90)]);
    expect(mvpCandidates(d, '217').map((p) => p.playerId)).toEqual(['a1']);
  });
});
