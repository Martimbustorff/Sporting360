import { AppConfigSchema, LoanSchema, PublicProfileSchema, UserDocSchema } from '@/data/schemas';

describe('AppConfigSchema', () => {
  it('accepts the minimal document and keeps unknown Plan 2 fields', () => {
    const parsed = AppConfigSchema.parse({
      minVersion: { ios: '7.0.0', android: '7.0.0' },
      comunidadeLeonina: [{ name: 'x' }],
      updatedAt: 'whatever',
    });
    expect(parsed.minVersion).toEqual({ ios: '7.0.0', android: '7.0.0' });
    expect((parsed as Record<string, unknown>).comunidadeLeonina).toBeDefined();
  });

  it('accepts storeUrls and texts', () => {
    const parsed = AppConfigSchema.parse({
      minVersion: { ios: '7.0.0', android: '7.0.0' },
      storeUrls: { ios: 'https://apps.apple.com/x' },
      texts: { updateButton: 'Atualizar' },
    });
    expect(parsed.storeUrls?.ios).toBe('https://apps.apple.com/x');
    expect(parsed.texts?.updateButton).toBe('Atualizar');
  });

  it('accepts null storeUrls and texts entries', () => {
    const parsed = AppConfigSchema.safeParse({
      minVersion: { ios: '7.0.0', android: '7.0.0' },
      storeUrls: { ios: null, android: null },
      texts: { updateRequiredTitle: null, updateRequiredBody: null, updateButton: null },
    });
    expect(parsed.success).toBe(true);
  });

  it('keeps the document valid when optional fields are malformed', () => {
    const base = { minVersion: { ios: '7.0.0', android: '7.0.0' } };
    for (const bad of [
      { storeUrls: 'x' },
      { storeUrls: { ios: 5 } },
      { texts: 7 },
      { texts: { updateButton: 5, updateRequiredTitle: 'Ok' } },
    ]) {
      expect(AppConfigSchema.safeParse({ ...base, ...bad }).success).toBe(true);
    }
    const parsed = AppConfigSchema.parse({ ...base, texts: { updateButton: 5, updateRequiredTitle: 'Ok' }, storeUrls: 'x' });
    expect(parsed.storeUrls).toBeUndefined();
    expect(parsed.texts?.updateButton).toBeUndefined();
    expect(parsed.texts?.updateRequiredTitle).toBe('Ok');
  });

  it.each([
    ['no minVersion', {}],
    ['minVersion without android', { minVersion: { ios: '7.0.0' } }],
    ['non-string version', { minVersion: { ios: 7, android: '7.0.0' } }],
  ])('rejects %s', (_label, input) => {
    expect(AppConfigSchema.safeParse(input).success).toBe(false);
  });
});

describe('PublicProfileSchema', () => {
  it('accepts a string or null avatarId', () => {
    expect(PublicProfileSchema.parse({ displayName: 'Leão', avatarId: 'a1' }).avatarId).toBe('a1');
    expect(PublicProfileSchema.parse({ displayName: 'Leão', avatarId: null }).avatarId).toBeNull();
  });

  it('treats a missing avatarId as null', () => {
    expect(PublicProfileSchema.parse({ displayName: 'Leão' }).avatarId).toBeNull();
  });

  it('rejects a missing displayName', () => {
    expect(PublicProfileSchema.safeParse({ avatarId: null }).success).toBe(false);
  });
});

describe('UserDocSchema', () => {
  it('accepts an empty document', () => {
    expect(UserDocSchema.safeParse({}).success).toBe(true);
  });

  it('keeps V2 fields and passes unknown ones through', () => {
    const parsed = UserDocSchema.parse({
      name: 'Ana',
      email: 'ana@example.com',
      partnerNumber: '123',
      gameboxNumber: 45,
      somethingElse: true,
    });
    expect(parsed.name).toBe('Ana');
    expect(parsed.gameboxNumber).toBe(45);
    expect((parsed as Record<string, unknown>).somethingElse).toBe(true);
  });

  it('reads the V2 profile GameBox seat fields (Task 23 "Principal")', () => {
    const parsed = UserDocSchema.parse({ gameboxName: 'Casa', gameboxPort: 5, gameboxSector: 'A27', gameboxLine: { x: 1 } });
    expect(parsed.gameboxName).toBe('Casa');
    expect(parsed.gameboxPort).toBe(5);
    expect(parsed.gameboxSector).toBe('A27');
    expect(parsed.gameboxLine).toBeUndefined();
  });

  it('does not fail the whole document on one malformed optional field', () => {
    const parsed = UserDocSchema.parse({ name: 'Ana', partnerNumber: { weird: 1 } });
    expect(parsed.name).toBe('Ana');
    expect(parsed.partnerNumber).toBeUndefined();
  });
});

describe('LoanSchema.cancelReason', () => {
  const ts = (iso: string) => ({ toDate: () => new Date(iso) });
  const loan = (extra: Record<string, unknown> = {}) => ({
    ownerUid: 'u1',
    gameboxId: 'g1',
    matchId: 'm1',
    match: { homeName: 'A', awayName: 'B', kickoff: ts('2026-12-01T20:00:00Z'), venue: 'stadium' },
    seat: { gate: null, sector: null, row: null, seat: null },
    createdAt: ts('2026-11-20T10:00:00Z'),
    expiresAt: ts('2026-12-01T23:00:00Z'),
    ...extra,
  });
  it('aceita os cinco motivos, null e a falta (documentos antigos)', () => {
    for (const r of ['owner', 'gamebox-edited', 'gamebox-deleted', 'recipient-left', 'owner-left']) {
      expect(LoanSchema.parse(loan({ cancelReason: r })).cancelReason).toBe(r);
    }
    expect(LoanSchema.parse(loan({ cancelReason: null })).cancelReason).toBeNull();
    expect(LoanSchema.parse(loan()).cancelReason).toBeUndefined();
  });
  it('um motivo desconhecido não parte o documento', () => {
    expect(LoanSchema.parse(loan({ cancelReason: 'novo-motivo' })).cancelReason).toBeNull();
  });
});
