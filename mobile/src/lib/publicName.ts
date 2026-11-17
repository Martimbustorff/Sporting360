/**
 * Cópia exata de functions/src/callables/validation.ts (validateDisplayName, validAvatarId) e
 * functions/src/data/profiles.ts (publicName). Manter os dois lados iguais; os testes espelham os de functions.
 * Regras: NFC, trim, espaços internos colapsados, 3 a 20 code points ([...s].length), sem '@'.
 */

export type DisplayNameError = "TOO_SHORT" | "TOO_LONG" | "INVALID_CHARS" | "HAS_AT" | "RESERVED_NAME";
export type DisplayNameResult =
  | { ok: true; value: string }
  | { ok: false; error: DisplayNameError };

const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._'-]*$/u;
// Nomes de fallback (prefixo "Sportinguista" mais o fim do uid) não podem ser escolhidos (evita imitar outro utilizador).
const RESERVED_RE = /^sportinguista\b/i;
const AVATAR_RE = /^[a-z0-9-]{1,32}$/;

export function validateDisplayName(raw: unknown): DisplayNameResult {
  if (typeof raw !== "string") return { ok: false, error: "TOO_SHORT" };
  const value = raw.normalize("NFC").trim().replace(/\s+/g, " ");
  const len = [...value].length;
  if (len < 3) return { ok: false, error: "TOO_SHORT" };
  if (len > 20) return { ok: false, error: "TOO_LONG" };
  if (value.includes("@")) return { ok: false, error: "HAS_AT" };
  if (!NAME_RE.test(value)) return { ok: false, error: "INVALID_CHARS" };
  if (RESERVED_RE.test(value)) return { ok: false, error: "RESERVED_NAME" };
  return { ok: true, value };
}

export function validAvatarId(v: unknown): v is string | null {
  return v === null || (typeof v === "string" && AVATAR_RE.test(v));
}

/**
 * Nome mostrado no ranking. Nunca expõe email. displayName e name (campo legado, escrito pelo dono)
 * passam ambos por validateDisplayName; inválido cai para "Sportinguista #<4 últimos do uid>".
 */
export function publicName(
  user: { displayName?: string | null; name?: string | null },
  uid: string,
): string {
  const display = validateDisplayName(user.displayName ?? "");
  if (display.ok) return display.value;

  const legacy = validateDisplayName(titleCasePt((user.name ?? "").trim()));
  if (legacy.ok) return legacy.value;

  return `Sportinguista #${uid.slice(-4)}`;
}

function titleCasePt(s: string): string {
  return s
    .toLocaleLowerCase("pt-PT")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase("pt-PT") + w.slice(1))
    .join(" ");
}
