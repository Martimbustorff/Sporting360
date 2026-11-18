import { BIOMETRIC_RELOCK_MS, shouldLock } from '@/lib/biometricPolicy';

const base = { enabled: true, signedIn: true, coldStart: false, backgroundedAt: null as number | null, now: 1_000_000 };

describe('shouldLock', () => {
  it('relock window is 5 minutes', () => expect(BIOMETRIC_RELOCK_MS).toBe(300_000));
  it('cold start with option on locks', () => expect(shouldLock({ ...base, coldStart: true })).toBe(true));
  it('cold start with option off does not lock', () => expect(shouldLock({ ...base, coldStart: true, enabled: false })).toBe(false));
  it('cold start without session does not lock', () => expect(shouldLock({ ...base, coldStart: true, signedIn: false })).toBe(false));
  it('return after 4m59s does not lock', () =>
    expect(shouldLock({ ...base, backgroundedAt: base.now - (BIOMETRIC_RELOCK_MS - 1000) })).toBe(false));
  it('return after 5m locks', () => expect(shouldLock({ ...base, backgroundedAt: base.now - BIOMETRIC_RELOCK_MS })).toBe(true));
  it('never backgrounded and not cold start does not lock', () => expect(shouldLock(base)).toBe(false));
  it('backgrounded long ago but option off does not lock', () =>
    expect(shouldLock({ ...base, enabled: false, backgroundedAt: 0 })).toBe(false));
});
