/** Nome mostrado no ranking. Nunca expõe email. */
export function publicName(
  user: { displayName?: string | null; name?: string | null },
  uid: string,
): string {
  const display = (user.displayName ?? "").trim();
  if (display) return display;

  const name = (user.name ?? "").trim();
  if (name && !name.includes("@")) return titleCasePt(name);

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
