import {
  AppConfigSchema,
  GameboxDocSchema,
  MatchPredictionSchema,
  PointEventSchema,
  SettlementSchema,
  UserDocSchema,
} from '@/data/schemas';

const base = { minVersion: { ios: '7.0.0', android: '7.0.0' } };

describe('AppConfigSchema: features and comunidadeLeonina', () => {
  it('features missing means off', () => {
    expect(AppConfigSchema.parse(base).features.comunidadeLeonina).toBe(false);
  });

  it('only the boolean true turns the flag on', () => {
    expect(AppConfigSchema.parse({ ...base, features: { comunidadeLeonina: 'sim' } }).features.comunidadeLeonina).toBe(false);
    expect(AppConfigSchema.parse({ ...base, features: { comunidadeLeonina: 1 } }).features.comunidadeLeonina).toBe(false);
    expect(AppConfigSchema.parse({ ...base, features: 'x' }).features.comunidadeLeonina).toBe(false);
    expect(AppConfigSchema.parse({ ...base, features: { comunidadeLeonina: true } }).features.comunidadeLeonina).toBe(true);
  });

  it('comunidadeLeonina defaults to [] and tolerates malformed values', () => {
    expect(AppConfigSchema.parse(base).comunidadeLeonina).toEqual([]);
    for (const bad of ['x', 5, { a: 1 }, null]) {
      const r = AppConfigSchema.safeParse({ ...base, comunidadeLeonina: bad });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.comunidadeLeonina).toEqual([]);
    }
  });

  it('keeps valid entries, drops malformed ones, fills defaults', () => {
    const r = AppConfigSchema.parse({
      ...base,
      comunidadeLeonina: [{ name: 'Leões' }, { nope: 1 }, { name: 'Y', description: 'd', image: 'i', links: { twitter: 't', patreon: 5 } }],
    });
    expect(r.comunidadeLeonina).toEqual([
      { name: 'Leões', description: null, image: null, links: {} },
      { name: 'Y', description: 'd', image: 'i', links: { twitter: 't', patreon: undefined, youtube: undefined } },
    ]);
  });
});

describe('UserDocSchema', () => {
  it('V2 user with only name, email and partnerNumber is valid', () => {
    const r = UserDocSchema.safeParse({ name: 'A', email: 'a@b.pt', partnerNumber: '05/2008' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.partnerNumber).toBe('05/2008');
      expect(r.data.memberNumber).toBeUndefined();
    }
  });

  it('keeps partnerNumber as written (number or text); memberNumber is a separate field', () => {
    expect(UserDocSchema.parse({ partnerNumber: 2008 }).partnerNumber).toBe(2008);
    expect(UserDocSchema.parse({ memberNumber: '12345', seasonSeat: 'A1' })).toMatchObject({ memberNumber: '12345', seasonSeat: 'A1' });
  });

  it('an unknown favoriteSport becomes undefined without invalidating', () => {
    const r = UserDocSchema.safeParse({ name: 'A', favoriteSport: 'golf' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.favoriteSport).toBeUndefined();
    expect(UserDocSchema.parse({ favoriteSport: 'futsal' }).favoriteSport).toBe('futsal');
  });

  it('favoritePlayer and notificationPrefs are tolerant', () => {
    expect(UserDocSchema.parse({ favoritePlayer: { id: '1', name: 'X' } }).favoritePlayer).toEqual({ id: '1', name: 'X' });
    expect(UserDocSchema.parse({ favoritePlayer: 5 }).favoritePlayer).toBeUndefined();
    expect(UserDocSchema.parse({ notificationPrefs: { goals: true, news: 'x' } }).notificationPrefs).toEqual({
      matchStart: false,
      goals: true,
      predictionReminder: false,
      mvpOpen: false,
      news: false,
    });
    expect(UserDocSchema.parse({ notificationPrefs: 'x' }).notificationPrefs).toBeUndefined();
  });
});

describe('points and game documents', () => {
  it('PointEvent accepts a null gameId', () => {
    const r = PointEventSchema.safeParse({ uid: 'u', gameId: null, type: 'mvp_participation', points: 1, gameDate: new Date() });
    expect(r.success).toBe(true);
  });

  it('MatchPrediction accepts a V2 document without createdAt or source', () => {
    const r = MatchPredictionSchema.safeParse({ gameId: '1', userId: 'u', home: 2, away: 1 });
    expect(r.success).toBe(true);
  });

  it('Settlement tolerates a missing officialMvp', () => {
    expect(SettlementSchema.parse({ finalHome: 1, finalAway: 0 }).officialMvp).toEqual([]);
  });

  it('GameboxDoc keeps optional pavilion fields', () => {
    const r = GameboxDocSchema.parse({ userid: 'u', gameboxNumber: 'enc', gameboxName: 'N', order: 1, pavilionSector: 'B' });
    expect(r.pavilionSector).toBe('B');
    expect(r.gameboxPort).toBeUndefined();
  });
});
