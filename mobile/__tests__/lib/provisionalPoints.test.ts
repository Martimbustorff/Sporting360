// Paridade com o servidor: functions/src/game/scoring.ts (POINTS, predictionBonus) e result.ts (outcome).
jest.mock('firebase-functions', () => ({ logger: { warn: jest.fn() } }), { virtual: true });

import { POINTS, predictionBonus } from '../../../functions/src/game/scoring';
import { provisionalPoints } from '@/lib/provisionalPoints';

describe('provisionalPoints', () => {
  const grid: number[] = [0, 1, 2, 3, 4, 5];

  it('tem o mesmo total que participação + predictionBonus do servidor em 0-5 x 0-5', () => {
    for (const ph of grid) for (const pa of grid) for (const lh of grid) for (const la of grid) {
      const bonus = predictionBonus({ home: ph, away: pa }, { home: lh, away: la });
      const got = provisionalPoints({ home: ph, away: pa }, { home: lh, away: la });
      expect(got.total).toBe(POINTS.participation + bonus);
      expect(got.kind).toBe(bonus === POINTS.exact ? 'exact' : bonus === POINTS.outcome ? 'outcome' : 'none');
    }
  });

  it('exemplos', () => {
    expect(provisionalPoints({ home: 2, away: 1 }, { home: 2, away: 1 })).toEqual({ total: 4, kind: 'exact' });
    expect(provisionalPoints({ home: 2, away: 1 }, { home: 1, away: 0 })).toEqual({ total: 2, kind: 'outcome' });
    expect(provisionalPoints({ home: 1, away: 1 }, { home: 0, away: 0 })).toEqual({ total: 2, kind: 'outcome' });
    expect(provisionalPoints({ home: 2, away: 1 }, { home: 0, away: 1 })).toEqual({ total: 1, kind: 'none' });
  });
});
