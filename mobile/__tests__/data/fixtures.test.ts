import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { buildFixtures, periodKeys } from '@/data/fixtures';
import { AppConfigSchema, PublicProfileSchema, UserDocSchema } from '@/data/schemas';

describe('periodKeys', () => {
  it('matches the backend keys', () => {
    expect(periodKeys(new Date('2026-11-17T12:00:00Z'))).toEqual({
      week: '2026-W47',
      month: '2026-11',
      season: '2026-2027',
    });
  });

  it('handles the ISO year boundary and the season start', () => {
    expect(periodKeys(new Date('2027-01-01T12:00:00Z')).week).toBe('2026-W53');
    expect(periodKeys(new Date('2026-06-30T12:00:00Z')).season).toBe('2025-2026');
    expect(periodKeys(new Date('2026-07-01T12:00:00Z')).season).toBe('2026-2027');
  });

  it('uses Lisbon time, not UTC', () => {
    // 23:30 UTC on 30 Jun is already 1 Jul in Lisbon (WEST, UTC+1).
    expect(periodKeys(new Date('2026-06-30T23:30:00Z')).month).toBe('2026-07');
  });
});

describe('buildFixtures', () => {
  const docs = buildFixtures(new Date('2026-11-17T12:00:00Z'));
  const byPath = new Map(docs.map((d) => [d.path, d.data]));

  it('has unique paths and never creates leaderboard parent docs', () => {
    expect(byPath.size).toBe(docs.length);
    expect(docs.some((d) => /^leaderboards\/[^/]+$/.test(d.path))).toBe(false);
    expect(byPath.has('leaderboards/week_2026-W47/entries/seed-user-1')).toBe(true);
  });

  it('validates against the app schemas', () => {
    expect(AppConfigSchema.safeParse(byPath.get('config/app')).success).toBe(true);
    expect(UserDocSchema.safeParse(byPath.get('users/seed-user-1')).success).toBe(true);
    expect(PublicProfileSchema.safeParse(byPath.get('publicProfiles/seed-user-1')).success).toBe(true);
  });

  it('never puts an email in a public profile or leaderboard entry', () => {
    const pub = docs.filter((d) => d.path.startsWith('publicProfiles/') || d.path.includes('/entries/'));
    expect(pub.length).toBeGreaterThan(0);
    for (const d of pub) expect(JSON.stringify(d.data)).not.toContain('@');
  });
});

describe('seed-emulator.mjs', () => {
  it('refuses to run without FIRESTORE_EMULATOR_HOST', () => {
    const env = { ...process.env };
    delete env.FIRESTORE_EMULATOR_HOST;
    const res = spawnSync(
      process.execPath,
      [path.join(__dirname, '..', '..', 'scripts', 'seed-emulator.mjs')],
      { env, encoding: 'utf8' },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('FIRESTORE_EMULATOR_HOST');
  });

  it('refuses a non-local FIRESTORE_EMULATOR_HOST', () => {
    const res = spawnSync(
      process.execPath,
      [path.join(__dirname, '..', '..', 'scripts', 'seed-emulator.mjs')],
      { env: { ...process.env, FIRESTORE_EMULATOR_HOST: 'firestore.googleapis.com:443' }, encoding: 'utf8' },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('not a local emulator host');
  });
});

describe('fixtures follow backend contracts', () => {
  const docs = buildFixtures(new Date('2026-11-17T12:00:00Z'));
  const byPath = new Map(docs.map((d) => [d.path, d.data]));

  it('uses Plan 2 roundLabel output and the publicName fallback', () => {
    expect((byPath.get('matches/9000') as { competition: { roundLabel: string } }).competition.roundLabel).toBe('J11');
    expect((byPath.get('matches/9001') as { competition: { roundLabel: string } }).competition.roundLabel).toBe('J12');
    expect((byPath.get('publicProfiles/seed-user-4') as { displayName: string }).displayName).toBe('Sportinguista #er-4');
  });

  it('player lines carry every PlayerStatLine field', () => {
    const lines = (byPath.get('matches/9000/details/players') as { teams: { players: Record<string, unknown>[] }[] }).teams[0]!.players;
    for (const f of ['playerId','name','photo','number','position','minutes','rating','goals','assists','saves','passesAccuracy','tackles','foulsCommitted','cardsYellow','cardsRed','substitute']) {
      for (const l of lines) expect(l).toHaveProperty(f);
    }
  });
});
