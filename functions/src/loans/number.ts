// Formato do número da GameBox. Cópia de normalizeGameboxNumber em mobile/src/lib/gamebox.ts:
// mobile/__tests__/lib/serverParity.test.ts falha se um lado mudar sem o outro.
export const GAMEBOX_NUMBER_MIN = 6;
export const GAMEBOX_NUMBER_MAX = 20;

/** Tira os espaços; 6 a 20 algarismos, senão null. */
export function normalizeGameboxNumber(raw: string): string | null {
  const n = raw.replace(/\s+/g, '');
  const re = new RegExp(`^\\d{${GAMEBOX_NUMBER_MIN},${GAMEBOX_NUMBER_MAX}}$`);
  return re.test(n) ? n : null;
}
