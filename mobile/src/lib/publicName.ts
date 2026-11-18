/**
 * Cópia exata de functions/src/callables/validation.ts (validateDisplayName, validAvatarId) e
 * functions/src/data/profiles.ts (publicName, derivedName, titleCasePt). Manter os dois lados iguais; os testes espelham os de functions.
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
 * Nome mostrado no ranking. Nunca expõe email. Um displayName escolhido (válido) mostra-se como está.
 * Sem ele, o nome deriva do campo legado name (escrito pelo dono): primeiro nome + inicial do último apelido
 * ("Maria Albuquerque Costa" -> "Maria C."), por privacidade. Inválido ou reservado cai para "Sportinguista #<4 últimos do uid>".
 */
export function publicName(
  user: { displayName?: string | null; name?: string | null },
  uid: string,
): string {
  const display = validateDisplayName(user.displayName ?? "");
  if (display.ok) return display.value;

  const derived = validateDisplayName(derivedName(titleCasePt((user.name ?? "").normalize("NFC").trim())));
  if (derived.ok) return derived.value;

  return `Sportinguista #${uid.slice(-4)}`;
}

// Primeiro nome + "." + inicial do último apelido que comece por letra e não seja partícula (da, de, do, das, dos, e).
function derivedName(titled: string): string {
  const words = titled.split(" ").filter(Boolean);
  // Iniciais à cabeça ("D. Maria Costa") não são o primeiro nome: saltam-se enquanto sobrarem mais de duas palavras (nunca deixa um apelido sozinho).
  while (words.length > 2 && /^\p{L}\.?$/u.test(words[0] ?? "")) words.shift();
  const first = words[0];
  if (first === undefined) return "";
  const particles = ["da", "de", "do", "das", "dos", "e"];
  const surnames = words
    .slice(1)
    .filter((w) => !particles.includes(w.toLocaleLowerCase("pt-PT")) && /^\p{L}/u.test(w));
  const last = surnames[surnames.length - 1];
  if (last === undefined) return first;
  const initial = [...last][0]?.toLocaleUpperCase("pt-PT") ?? "";
  return `${first} ${initial}.`;
}

function titleCasePt(s: string): string {
  return s
    .toLocaleLowerCase("pt-PT")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase("pt-PT") + w.slice(1))
    .join(" ");
}
