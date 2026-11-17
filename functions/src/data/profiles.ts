import { validateDisplayName } from "../callables/validation";

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
