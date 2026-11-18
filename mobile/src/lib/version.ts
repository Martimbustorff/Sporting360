export type StoreOS = 'ios' | 'android';

export const STORE_URLS: Record<StoreOS, string> = {
  ios: 'https://apps.apple.com/app/id6450608023',
  android: 'https://play.google.com/store/apps/details?id=com.scp360',
};

const STORE_HOSTS: Record<StoreOS, string> = { ios: 'apps.apple.com', android: 'play.google.com' };
const SEMVER = /^\d+(\.\d+){0,2}$/;

/** Compara numericamente até 3 partes (parte em falta vale 0). Valor inválido (ou ausente) em qualquer lado: false. */
export function isVersionBelow(current: string, min: string): boolean {
  if (typeof current !== 'string' || typeof min !== 'string') return false;
  if (!SEMVER.test(current) || !SEMVER.test(min)) return false;
  const a = current.split('.').map(Number);
  const b = min.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}

/**
 * `config/app.storeUrls` só sobrepõe o URL por omissão se for https para a loja da plataforma
 * (apps.apple.com / play.google.com). Um valor mal formado ou de outro domínio cai no por omissão:
 * um config adulterado não pode enviar os utilizadores para um site arbitrário.
 */
export function resolveStoreUrl(os: StoreOS, overrides?: { ios?: string | null; android?: string | null } | null): string {
  const candidate = overrides?.[os];
  if (typeof candidate !== 'string' || candidate === '') return STORE_URLS[os];
  try {
    const u = new URL(candidate);
    if (u.protocol === 'https:' && u.hostname === STORE_HOSTS[os] && u.username === '' && u.password === '') return candidate;
  } catch {
    // URL inválido: usa o por omissão
  }
  return STORE_URLS[os];
}
