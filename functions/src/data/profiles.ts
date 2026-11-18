import { validateDisplayName } from "../callables/validation";

/**
 * Nome mostrado no ranking. Nunca expõe email. displayName e name (campo legado, escrito pelo dono)
 * passam ambos por validateDisplayName (name longo tenta primeiro + último nome); inválido cai para "Sportinguista #<4 últimos do uid>".
 */
export function publicName(
  user: { displayName?: string | null; name?: string | null },
  uid: string,
): string {
  const display = validateDisplayName(user.displayName ?? "");
  if (display.ok) return display.value;

  const legacyName = titleCasePt((user.name ?? "").trim());
  const legacy = validateDisplayName(legacyName);
  if (legacy.ok) return legacy.value;
  // Nome legado longo (ex.: nome completo): tenta "<primeiro> <último>" antes do fallback.
  if (!legacy.ok && legacy.error === "TOO_LONG") {
    const words = legacyName.split(" ");
    if (words.length >= 2) {
      const short = validateDisplayName(`${words[0]} ${words[words.length - 1]}`);
      if (short.ok) return short.value;
    }
  }

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
