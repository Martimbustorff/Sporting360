/**
 * Validação de perfil (displayName e avatarId).
 *
 * A app (Task 16) duplica `validateDisplayName`: manter os dois lados iguais. Vetores partilhados
 * (entrada -> resultado), todos testados em test/unit/validation.test.ts:
 *   '  Leão   77 '        -> ok 'Leão 77'
 *   'Leão' em NFD         -> ok 'Leão' (normaliza para NFC antes de validar)
 *   "D'Alva-Sá"           -> ok "D'Alva-Sá"
 *   'Ç' x 20              -> ok (20 code points)
 *   'ab'                  -> TOO_SHORT
 *   '   '                 -> TOO_SHORT
 *   'a' x 21              -> TOO_LONG
 *   'a@b.pt'              -> HAS_AT (tem prioridade sobre INVALID_CHARS)
 *   'Leão 🦁'             -> INVALID_CHARS
 *   '-abc'                -> INVALID_CHARS
 * Regras: NFC, trim, espaços internos colapsados num só, 3 a 20 code points (contar com [...s].length,
 * nunca s.length), sem '@', regex /^[\p{L}\p{N}][\p{L}\p{N} ._'-]*$/u.
 * validAvatarId: null ou /^[a-z0-9-]{1,32}$/.
 */

export type DisplayNameError = "TOO_SHORT" | "TOO_LONG" | "INVALID_CHARS" | "HAS_AT";
export type DisplayNameResult =
  | { ok: true; value: string }
  | { ok: false; error: DisplayNameError };

const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._'-]*$/u;
const AVATAR_RE = /^[a-z0-9-]{1,32}$/;

export function validateDisplayName(raw: unknown): DisplayNameResult {
  if (typeof raw !== "string") return { ok: false, error: "TOO_SHORT" };
  const value = raw.normalize("NFC").trim().replace(/\s+/g, " ");
  const len = [...value].length;
  if (len < 3) return { ok: false, error: "TOO_SHORT" };
  if (len > 20) return { ok: false, error: "TOO_LONG" };
  if (value.includes("@")) return { ok: false, error: "HAS_AT" };
  if (!NAME_RE.test(value)) return { ok: false, error: "INVALID_CHARS" };
  return { ok: true, value };
}

export function validAvatarId(v: unknown): v is string | null {
  return v === null || (typeof v === "string" && AVATAR_RE.test(v));
}
