// Inicial de um nome para avatares (Perfil, Definições).
/** Primeira letra do nome público, em maiúscula; `?` se o nome vier vazio. */
export function initialOf(name: string): string {
  const first = [...name.trim()][0];
  return first ? first.toLocaleUpperCase('pt-PT') : '?';
}
