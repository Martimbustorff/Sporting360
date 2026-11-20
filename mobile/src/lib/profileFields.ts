// Task 22: validação e montagem do pedido de gravação do perfil privado (users/{uid}).
// `partnerNumber` guarda "sócio desde" (MM/AAAA, nome antigo da V2); `memberNumber` é o número de sócio.
import type { NotificationPrefs, Sport, UserDoc } from '@/data/schemas';
import { lisbonParts } from '@/lib/ptDate';

/** Chaves que a app pode gravar em users/{uid} (nunca displayName, nameChangedAt nem email). */
export const PROFILE_PATCH_KEYS = [
  'memberNumber',
  'partnerNumber',
  'seasonSeat',
  'favoriteSport',
  'favoritePlayer',
  'notificationPrefs',
] as const;
export type ProfilePatchKey = (typeof PROFILE_PATCH_KEYS)[number];
export type ProfilePatch = Partial<Pick<UserDoc, ProfilePatchKey>>;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  matchStart: true,
  goals: true,
  predictionReminder: true,
  mvpOpen: true,
  news: true,
};

export const SEASON_SEAT_MAX = 60;

const MEMBER_SINCE = /^(0[1-9]|1[0-2])\/(19|20)\d{2}$/;

/** MM/AAAA com mês 01 a 12, ano 19xx ou 20xx e não posterior ao mês atual (Lisboa). */
export function validMemberSince(v: string, now: Date = new Date()): boolean {
  if (!MEMBER_SINCE.test(v)) return false;
  const month = Number(v.slice(0, 2));
  const year = Number(v.slice(3));
  const cur = lisbonParts(now);
  return year < cur.year || (year === cur.year && month <= cur.month);
}

/** 1 a 10 algarismos. */
export function validMemberNumber(v: string): boolean {
  return /^\d{1,10}$/.test(v);
}

export function validSeasonSeat(v: string): boolean {
  return v.length <= SEASON_SEAT_MAX;
}

export type ProfileForm = {
  memberNumber: string;
  partnerNumber: string;
  seasonSeat: string;
  favoriteSport: Sport | null;
  favoritePlayer: { id: string; name: string } | null;
};

/** Valores iniciais do formulário a partir do documento lido (campos em falta ficam vazios). */
export function formFromUser(u: UserDoc): ProfileForm {
  return {
    memberNumber: (u.memberNumber ?? '').trim(),
    partnerNumber: u.partnerNumber == null ? '' : String(u.partnerNumber).trim(),
    seasonSeat: (u.seasonSeat ?? '').trim(),
    favoriteSport: u.favoriteSport ?? null,
    favoritePlayer: u.favoritePlayer ?? null,
  };
}

export type FormErrors = Partial<Record<'memberNumber' | 'partnerNumber' | 'seasonSeat', string>>;

export const FIELD_ERRORS = {
  memberNumber: 'O número de sócio tem de ter entre 1 e 10 algarismos.',
  partnerNumber: 'Indica o mês e o ano no formato MM/AAAA, sem datas futuras.',
  seasonSeat: `O lugar anual pode ter até ${SEASON_SEAT_MAX} caracteres.`,
} as const;

/**
 * Só o que mudou em relação ao valor inicial. Campos de texto limpos gravam '' (a app mostra "Não indicado").
 * Um campo de texto só é validado quando mudou: valores antigos fora do formato não bloqueiam a gravação.
 */
export function diffForm(
  initial: ProfileForm,
  form: ProfileForm,
  now: Date = new Date(),
): { patch: ProfilePatch; errors: FormErrors } {
  const patch: ProfilePatch = {};
  const errors: FormErrors = {};
  const text = (key: 'memberNumber' | 'partnerNumber' | 'seasonSeat', ok: (v: string) => boolean) => {
    const v = form[key].trim();
    if (v === initial[key]) return;
    if (v !== '' && !ok(v)) errors[key] = FIELD_ERRORS[key];
    else patch[key] = v;
  };
  text('memberNumber', validMemberNumber);
  text('partnerNumber', (v) => validMemberSince(v, now));
  text('seasonSeat', validSeasonSeat);
  if (form.favoriteSport !== null && form.favoriteSport !== initial.favoriteSport) {
    patch.favoriteSport = form.favoriteSport;
  }
  if (form.favoritePlayer !== null && form.favoritePlayer.id !== initial.favoritePlayer?.id) {
    patch.favoritePlayer = { id: form.favoritePlayer.id, name: form.favoritePlayer.name };
  }
  return { patch, errors };
}

/**
 * Anos completos de sócio a partir de "sócio desde" (MM/AAAA; dos dados antigos também MAAAA sem barra, ex. 52008, ou só AAAA), em Lisboa (20/11, Martim:
 * a Home mostra "30 anos de sócio"). Conta o ano só quando o mês de entrada já chegou. Valor ilegível ou no futuro: null.
 */
export function memberYears(since: string, now: Date = new Date()): number | null {
  const m = /^\s*(?:(\d{1,2})\s*\/?\s*)?((?:19|20)\d{2})\s*$/.exec(since);
  if (!m) return null;
  const month = m[1] ? Number(m[1]) : 1;
  if (month < 1 || month > 12) return null;
  const year = Number(m[2]);
  const cur = lisbonParts(now);
  const years = cur.year - year - (cur.month < month ? 1 : 0);
  return years < 0 ? null : years;
}

/** "30 ANOS DE SÓCIO" / "1 ANO DE SÓCIO" / "SÓCIO HÁ MENOS DE 1 ANO"; null quando não há data legível. */
export function memberYearsText(since: string, now: Date = new Date()): string | null {
  const y = memberYears(since, now);
  if (y === null) return null;
  if (y === 0) return 'Sócio há menos de 1 ano';
  return y === 1 ? '1 ano de sócio' : `${y} anos de sócio`;
}
