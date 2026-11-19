import {
  BracketDocSchema,
  CompetitionSchema,
  EventsDocSchema,
  FixturesDocSchema,
  LineupsDocSchema,
  MatchSchema,
  MvpTallySchema,
  PlayersDocSchema,
  PrematchDocSchema,
  StatisticsDocSchema,
  VideoSchema,
} from '@/data/schemas';
import { buildFixtures } from '@/data/fixtures';

const fakeTs = (iso: string) => ({ toDate: () => new Date(iso) });

const match = (over: Record<string, unknown> = {}) => ({
  id: '9001',
  sport: 'football',
  competition: { key: 'football_94_2026', id: '94', name: 'Liga Portugal', type: 'league', season: '2026', round: 'Regular Season - 12', roundLabel: 'J12' },
  home: { id: '228', name: 'Sporting CP', logo: null },
  away: { id: '211', name: 'Benfica', logo: null },
  sportingSide: 'home',
  kickoff: fakeTs('2026-11-20T20:30:00Z'),
  status: 'NS',
  statusRaw: 'NS',
  elapsed: null,
  elapsedExtra: null,
  score: { home: null, away: null, halftime: null, extratime: null, penalty: null },
  finishedAt: null,
  venue: { id: '1', name: 'Estádio José Alvalade', city: 'Lisboa' },
  referee: 'A. Árbitro',
  source: { provider: 'api-football', id: '9001' },
  ...over,
});

describe('MatchSchema', () => {
  it('turns a Firestore Timestamp into a Date', () => {
    const m = MatchSchema.parse(match());
    expect(m.kickoff).toBeInstanceOf(Date);
    expect(m.kickoff.toISOString()).toBe('2026-11-20T20:30:00.000Z');
  });

  it('accepts a plain Date (fixtures, emulator)', () => {
    expect(MatchSchema.parse(match({ kickoff: new Date('2026-11-20T20:30:00Z') })).kickoff.getTime()).toBe(
      Date.parse('2026-11-20T20:30:00Z'),
    );
  });

  it('tv e statusRaw são opcionais (ausentes ou null) e passam quando existem', () => {
    const raw = match();
    delete (raw as Record<string, unknown>).statusRaw;
    const bare = MatchSchema.parse(raw);
    expect(bare.tv).toBeUndefined();
    expect(bare.statusRaw).toBeUndefined();
    const nulls = MatchSchema.parse(match({ tv: null, statusRaw: null }));
    expect(nulls.tv).toBeNull();
    expect(nulls.statusRaw).toBeNull();
    const full = MatchSchema.parse(match({ tv: 'TVI / V+', statusRaw: 'ET' }));
    expect(full.tv).toBe('TVI / V+');
    expect(full.statusRaw).toBe('ET');
  });

  it('tv que não é texto não parte o jogo: fica null', () => {
    expect(MatchSchema.parse(match({ tv: 42 })).tv).toBeNull();
    expect(MatchSchema.parse(match({ tv: { x: 1 } })).tv).toBeNull();
  });

  it('venue null and no referee is valid', () => {
    const raw = match({ venue: null });
    delete (raw as Record<string, unknown>).referee;
    const r = MatchSchema.safeParse(raw);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.venue).toBeNull();
      expect(r.data.referee).toBeNull();
    }
  });

  it('rejects an unknown status', () => {
    expect(MatchSchema.safeParse(match({ status: 'XYZ' })).success).toBe(false);
  });

  it('rejects a kickoff that is neither Timestamp nor Date', () => {
    expect(MatchSchema.safeParse(match({ kickoff: 'amanhã' })).success).toBe(false);
  });

  it('tolerates malformed elapsedExtra, attribution and extra server fields', () => {
    const r = MatchSchema.safeParse(
      match({ elapsedExtra: 'x', source: { provider: 'hp', id: '1', attribution: 5, fallbackUsed: true }, locked: true, score: { home: 1, away: 1, halftime: null, extratime: null, penalty: null, sets: [] } }),
    );
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.elapsedExtra).toBeNull();
      expect(r.data.source.attribution).toBeNull();
    }
  });
});

describe('detail docs', () => {
  it('prematch accepts the empty marker', () => {
    const r = PrematchDocSchema.safeParse({ fetchedAt: fakeTs('2026-11-18T10:00:00Z'), empty: true });
    expect(r.success).toBe(true);
    if (r.success) expect('empty' in r.data && r.data.empty).toBe(true);
  });

  it('prematch accepts the full document', () => {
    const r = PrematchDocSchema.safeParse({
      fetchedAt: fakeTs('2026-11-18T10:00:00Z'),
      advice: 'Sporting ganha',
      winner: { id: '228', name: 'Sporting CP', comment: 'Win' },
      percent: { home: 60, draw: 25, away: 15 },
      form: { home: 'WWDWW', away: 'WLWDW' },
      last5: { home: { played: 5, form: '80%', att: '70%', def: '60%', goalsFor: 12, goalsAgainst: 3 }, away: null },
      h2h: [{ id: '1', kickoff: fakeTs('2025-11-01T20:00:00Z'), home: { id: '228', name: 'Sporting CP', logo: null }, away: { id: '211', name: 'Benfica', logo: null }, score: { home: 2, away: 1 } }],
    });
    expect(r.success).toBe(true);
  });

  it('events, statistics, lineups and players parse server shapes', () => {
    expect(EventsDocSchema.safeParse({ items: [{ minute: 45, extra: 2, teamId: '228', playerId: '1', playerName: 'X', assistId: null, assistName: null, type: 'goal', detail: 'Normal Goal', comments: null }] }).success).toBe(true);
    expect(StatisticsDocSchema.safeParse({ teams: [{ teamId: '228', items: { 'Ball Possession': '55%', 'Shots on Goal': 5, expected_goals: null } }], xg: null }).success).toBe(true);
    expect(LineupsDocSchema.safeParse({ teams: [{ teamId: '228', formation: '3-4-3', coach: null, startXI: [{ playerId: '1', name: 'X', number: 1, pos: 'G', grid: '1:1' }], substitutes: [] }] }).success).toBe(true);
    const fx = buildFixtures(new Date('2026-11-17T12:00:00Z'));
    const players = fx.find((d) => d.path === 'matches/9000/details/players')!.data;
    expect(PlayersDocSchema.safeParse(players).success).toBe(true);
  });
});

describe('competition docs', () => {
  it('bracket legs keep the ISO string kickoff', () => {
    const r = BracketDocSchema.safeParse({
      stages: [{
        label: 'Oitavos de final',
        raw: 'Round of 16',
        ties: [{
          id: '1', stage: 'Round of 16',
          home: { id: '228', name: 'Sporting CP', logo: null }, away: { id: '50', name: 'Man City', logo: null },
          legs: [{ matchId: '1', kickoff: '2027-03-10T20:00:00.000Z', status: 'FT', score: { home: 2, away: 1, penaltyHome: null, penaltyAway: null } }],
          aggregate: { home: 3, away: 2 }, winnerTeamId: '228', sportingInvolved: true,
        }],
      }],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.stages[0]!.ties[0]!.legs[0]!.kickoff).toBe('2027-03-10T20:00:00.000Z');
  });

  it('bracket legs: homeId is optional (old docs) and kept when present', () => {
    const leg = { matchId: '1', kickoff: '2027-03-10T20:00:00.000Z', status: 'FT', score: { home: 2, away: 1, penaltyHome: null, penaltyAway: null } };
    const doc = (legs: object[]) => ({
      stages: [{
        label: 'Final', raw: 'Final',
        ties: [{
          id: '1', stage: 'Final',
          home: { id: '228', name: 'Sporting CP', logo: null }, away: { id: '50', name: 'Man City', logo: null },
          legs, aggregate: null, winnerTeamId: null, sportingInvolved: true,
        }],
      }],
    });
    const old = BracketDocSchema.parse(doc([leg]));
    expect(old.stages[0]!.ties[0]!.legs[0]!.homeId).toBeUndefined();
    const fresh = BracketDocSchema.parse(doc([{ ...leg, homeId: '50' }]));
    expect(fresh.stages[0]!.ties[0]!.legs[0]!.homeId).toBe('50');
    // A malformed homeId does not drop the doc.
    expect(BracketDocSchema.parse(doc([{ ...leg, homeId: 7 }])).stages[0]!.ties[0]!.legs[0]!.homeId).toBeUndefined();
  });

  it('competition leagueId number becomes a string; view is optional', () => {
    const r = CompetitionSchema.parse({ sport: 'football', leagueId: 94, name: 'Liga Portugal', type: 'league' });
    expect(r.leagueId).toBe('94');
    expect(r.view).toBeUndefined();
    const v = CompetitionSchema.parse({ sport: 'football', leagueId: '2', name: 'Liga dos Campeões', type: 'europe', view: { primary: 'bracket', hasTable: true, hasBracket: true, currentStage: 'Oitavos de final' } });
    expect(v.view?.primary).toBe('bracket');
  });

  it('fixtures items take a Timestamp kickoff', () => {
    const r = FixturesDocSchema.parse({
      items: [{ id: '1', kickoff: fakeTs('2026-11-20T20:30:00Z'), round: 'Regular Season - 12', roundLabel: 'J12', home: { id: '228', name: 'Sporting CP', logo: null }, away: { id: '211', name: 'Benfica', logo: null }, status: 'NS', score: { home: null, away: null, extraHome: null, extraAway: null, penaltyHome: null, penaltyAway: null } }],
    });
    expect(r.items[0]!.kickoff).toBeInstanceOf(Date);
  });
});

describe('MvpTallySchema', () => {
  it('aceita o documento do agregador, com updatedAt a mais', () => {
    const r = MvpTallySchema.safeParse({ gameId: '1001', counts: { '10': 3, '20': 1 }, total: 4, updatedAt: fakeTs('2026-11-21T21:40:00Z') });
    expect(r.success).toBe(true);
    expect(r.success && r.data.total).toBe(4);
  });

  it('rejeita total negativo', () => {
    expect(MvpTallySchema.safeParse({ gameId: '1001', counts: { '10': 1 }, total: -1 }).success).toBe(false);
  });
});

describe('VideoSchema', () => {
  it('publishedAt may be null', () => {
    const r = VideoSchema.safeParse({ id: '1', title: 'Golo', minute: null, type: 'golo', thumbnail: 'https://x/y.jpg', embedSrc: 'https://www.vsports.pt/embed/1', publishedAt: null });
    expect(r.success).toBe(true);
  });
});

describe('fixtures follow the sports schemas', () => {
  it('seeded matches parse', () => {
    const fx = buildFixtures(new Date('2026-11-17T12:00:00Z'));
    for (const p of ['matches/9000', 'matches/9001']) {
      expect(MatchSchema.safeParse(fx.find((d) => d.path === p)!.data).success).toBe(true);
    }
  });
});

describe('StatisticsDocSchema: firstHalf (instantâneo do intervalo)', () => {
  const base = { teams: [{ teamId: '228', items: { 'Total Shots': 5 } }], xg: null };
  it('lê firstHalf; documento antigo sem ele continua a ler', () => {
    const withHalf = StatisticsDocSchema.parse({ ...base, firstHalf: { teams: [{ teamId: '228', items: { 'Total Shots': 2, Fouls: null } }], xg: { home: 0.4, away: null } } });
    expect(withHalf.firstHalf?.teams[0]?.items['Total Shots']).toBe(2);
    expect(StatisticsDocSchema.parse(base).firstHalf).toBeUndefined();
  });
  it('firstHalf malformado é ignorado, não parte o documento', () => {
    const r = StatisticsDocSchema.safeParse({ ...base, firstHalf: { teams: 'x' } });
    expect(r.success).toBe(true);
    expect(r.success && r.data.firstHalf).toBeUndefined();
  });
});
