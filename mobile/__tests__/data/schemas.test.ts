import { AppConfigSchema, PublicProfileSchema, UserDocSchema } from '@/data/schemas';

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

  it('does not fail the whole document on one malformed optional field', () => {
    const parsed = UserDocSchema.parse({ name: 'Ana', partnerNumber: { weird: 1 } });
    expect(parsed.name).toBe('Ana');
    expect(parsed.partnerNumber).toBeUndefined();
  });
});
