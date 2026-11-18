import { footballSeason, periodKeys } from '@/lib/periods';
import { periodKeys as fromFixtures } from '@/data/fixtures';

// Vectors from functions/test/unit/periods.test.ts and model.test.ts (server parity, F1/F2/F21).
describe('periodKeys', () => {
  it('Sunday 23:30 UTC in November is still Sunday in Lisbon (WET)', () => {
    expect(periodKeys(new Date('2026-11-22T23:30:00Z'))).toEqual({
      week: '2026-W47',
      month: '2026-11',
      season: '2026-2027',
    });
  });

  it('Monday 00:30 UTC starts the next ISO week', () => {
    expect(periodKeys(new Date('2026-11-23T00:30:00Z')).week).toBe('2026-W48');
  });

  it('month and season turn at Lisbon midnight in summer (UTC+1)', () => {
    expect(periodKeys(new Date('2026-06-30T23:30:00Z'))).toMatchObject({ month: '2026-07', season: '2026-2027' });
    expect(periodKeys(new Date('2026-06-30T23:00:00Z')).season).toBe('2026-2027');
    expect(periodKeys(new Date('2026-06-30T22:59:00Z')).season).toBe('2025-2026');
  });

  it('server vectors: ISO week year and Monday boundary', () => {
    expect(periodKeys(new Date('2026-11-16T23:30:00Z')).week).toBe('2026-W47');
    expect(periodKeys(new Date('2027-01-01T00:30:00Z'))).toMatchObject({ week: '2026-W53', month: '2027-01' });
    expect(periodKeys(new Date('2026-12-28T00:00:00Z')).week).toBe('2026-W53');
  });

  it('fixtures re-exports the same function (no copy)', () => {
    expect(fromFixtures).toBe(periodKeys);
  });
});

describe('footballSeason (August start, as footballApiSeason)', () => {
  it('July still belongs to the previous season', () => {
    expect(footballSeason(new Date('2026-07-31T22:59:00Z'))).toBe('2025');
    expect(footballSeason(new Date('2026-06-30T12:00:00Z'))).toBe('2025');
  });

  it('1 August in Lisbon starts the new season', () => {
    expect(footballSeason(new Date('2026-07-31T23:00:00Z'))).toBe('2026');
  });

  it('server vectors', () => {
    expect(footballSeason(new Date('2026-11-17T12:00:00Z'))).toBe('2026');
    expect(footballSeason(new Date('2027-07-31T22:00:00Z'))).toBe('2026');
    expect(footballSeason(new Date('2027-08-01T00:00:00+01:00'))).toBe('2027');
    expect(footballSeason(new Date('2027-01-15T12:00:00Z'))).toBe('2026');
  });
});
