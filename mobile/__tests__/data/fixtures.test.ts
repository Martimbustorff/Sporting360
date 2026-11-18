import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { buildFixtures, periodKeys } from '@/data/fixtures';
import {
  AppConfigSchema,
  BracketDocSchema,
  CoachDocSchema,
  CompetitionSchema,
  EventsDocSchema,
  InjuriesDocSchema,
  LineupsDocSchema,
  MatchSchema,
  NewsSchema,
  PlayersDocSchema,
  PlayerStatsDocSchema,
  PrematchDocSchema,
  PublicProfileSchema,
  SettlementSchema,
  SquadDocSchema,
  StandingsDocSchema,
  StatisticsDocSchema,
  TeamInjuriesDocSchema,
  TeamStatsDocSchema,
  TopListDocSchema,
  TransfersDocSchema,
  TrophiesDocSchema,
  SidelinedDocSchema,
  UserDocSchema,
  VideoSchema,
} from '@/data/schemas';

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

describe('fixtures of the plan 4 screen states', () => {
  const docs = buildFixtures(new Date('2026-11-17T12:00:00Z'));
  const byPath = new Map(docs.map((d) => [d.path, d.data]));
  const get = (p: string) => {
    expect(byPath.has(p)).toBe(true);
    return byPath.get(p);
  };

  it('has a game for every state and each passes MatchSchema', () => {
    const want: Record<string, string> = { '9001': 'NS', '9002': 'LIVE', '9003': 'HT', '9000': 'FT', '9004': 'PST', '9005': 'CANC', '9101': 'NS' };
    for (const [id, status] of Object.entries(want)) {
      const m = MatchSchema.parse(get(`matches/${id}`));
      expect(m.status).toBe(status);
    }
    expect(MatchSchema.parse(get('matches/9002')).elapsed).toBe(82);
    const futsal = MatchSchema.parse(get('matches/9101'));
    expect(futsal.sport).toBe('futsal');
    expect(futsal.source.attribution).toBeTruthy();
  });

  it('football NS has prematch and no lineups; the live game has players, events, lineups, statistics', () => {
    expect(PrematchDocSchema.safeParse(get('matches/9001/details/prematch')).success).toBe(true);
    expect(byPath.has('matches/9001/details/lineups')).toBe(false);
    for (const [k, schema] of [['players', PlayersDocSchema], ['events', EventsDocSchema], ['lineups', LineupsDocSchema], ['statistics', StatisticsDocSchema]] as const) {
      expect(schema.safeParse(get(`matches/9002/details/${k}`)).success).toBe(true);
    }
    expect(PlayersDocSchema.safeParse(get('matches/9000/details/players')).success).toBe(true);
  });

  it('FT has the settlement', () => {
    expect(SettlementSchema.parse(get('settlements/9000')).officialMvp).toEqual(['1002']);
  });

  it('table, bracket and both competitions, the bracket legs carry homeId', () => {
    const view = (k: string) => CompetitionSchema.parse(get(`competitions/${k}`)).view;
    expect(view('football_94_2026')).toMatchObject({ primary: 'table', hasTable: true, hasBracket: false });
    expect(view('football_96_2026')).toMatchObject({ primary: 'bracket', hasTable: false, hasBracket: true });
    expect(view('football_2_2026')).toMatchObject({ primary: 'bracket', hasTable: true, hasBracket: true });
    expect(StandingsDocSchema.safeParse(get('competitions/football_94_2026/data/standings')).success).toBe(true);
    expect(StandingsDocSchema.safeParse(get('competitions/football_2_2026/data/standings')).success).toBe(true);
    for (const k of ['football_96_2026', 'football_2_2026']) {
      const b = BracketDocSchema.parse(get(`competitions/${k}/data/bracket`));
      const legs = b.stages.flatMap((s) => s.ties.flatMap((t) => t.legs));
      expect(legs.length).toBeGreaterThan(0);
      for (const l of legs) expect(typeof l.homeId).toBe('string');
    }
    expect(TopListDocSchema.safeParse(get('competitions/football_94_2026/data/topscorers')).success).toBe(true);
  });

  it('team data passes the schemas', () => {
    const b = 'teams/football_228/data';
    expect(SquadDocSchema.safeParse(get(`${b}/squad`)).success).toBe(true);
    expect(CoachDocSchema.safeParse(get(`${b}/coach`)).success).toBe(true);
    expect(TeamInjuriesDocSchema.safeParse(get(`${b}/injuries`)).success).toBe(true);
    expect(TransfersDocSchema.safeParse(get(`${b}/transfers`)).success).toBe(true);
    expect(TrophiesDocSchema.safeParse(get(`${b}/trophies`)).success).toBe(true);
    expect(SidelinedDocSchema.safeParse(get(`${b}/sidelined`)).success).toBe(true);
    expect(PlayerStatsDocSchema.safeParse(get(`${b}/playerStats_2026`)).success).toBe(true);
    expect(TeamStatsDocSchema.safeParse(get(`${b}/teamStats_94_2026`)).success).toBe(true);
    expect(InjuriesDocSchema.safeParse({ items: [], fetchedAt: null }).success).toBe(true);
  });

  it('news of 3 sports and videos with the VSports embed shape', () => {
    const news = docs.filter((d) => d.path.startsWith('news/')).map((d) => NewsSchema.parse(d.data));
    expect(new Set(news.map((n) => n.sport)).size).toBe(3);
    const vids = docs.filter((d) => d.path.startsWith('matches/9000/videos/')).map((d) => VideoSchema.parse(d.data));
    expect(vids.length).toBeGreaterThanOrEqual(3);
    for (const v of vids) expect(v.embedSrc).toMatch(/^https:\/\/sporting\.vsports\.pt\/embd\/100020\/m\/19776\/scp\/[0-9a-f]+\?autostart=false$/);
  });

  it('config/app hides Comunidade Leonina and requires 7.0.0', () => {
    const c = AppConfigSchema.parse(get('config/app'));
    expect(c.features.comunidadeLeonina).toBe(false);
    expect(c.minVersion).toEqual({ ios: '7.0.0', android: '7.0.0' });
  });

  it('the three current leaderboard keys exist', () => {
    for (const p of ['week_2026-W47', 'month_2026-11', 'season_2026-2027']) {
      expect(byPath.has(`leaderboards/${p}/entries/seed-user-1`)).toBe(true);
    }
  });

  it('loads under plain Node (seed script import, .ts extension)', () => {
    const res = spawnSync(
      process.execPath,
      ['-e', "import('./src/data/fixtures.ts').then(m=>{const d=m.buildFixtures(new Date());console.log('N='+d.length)})"],
      { cwd: path.join(__dirname, '..', '..'), encoding: 'utf8' },
    );
    expect(res.stdout).toMatch(/N=\d+/);
  });
});
