export const BIOMETRIC_RELOCK_MS = 5 * 60_000;

export type LockState = {
  enabled: boolean;
  signedIn: boolean;
  coldStart: boolean;
  backgroundedAt: number | null;
  now: number;
};

/** Bloqueia no arranque a frio, ou ao regressar do background depois de pelo menos 5 minutos. */
export function shouldLock(s: LockState): boolean {
  if (!s.enabled || !s.signedIn) return false;
  if (s.coldStart) return true;
  return s.backgroundedAt !== null && s.now - s.backgroundedAt >= BIOMETRIC_RELOCK_MS;
}
