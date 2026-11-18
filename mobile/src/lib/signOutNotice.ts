// R17 (Task 16): aviso a mostrar no Welcome depois de um signOut (ex.: "Conta apagada.").
// A guarda de (app) redireciona signedOut para /welcome e perderia um parâmetro passado por quem navegou:
// fica guardado aqui (módulo) até o Welcome o mostrar. Só valores fixos, nunca dados do utilizador.
export type SignOutNotice = 'conta-apagada';

let pending: SignOutNotice | null = null;

export function setSignOutNotice(n: SignOutNotice): void {
  pending = n;
}
export function peekSignOutNotice(): SignOutNotice | null {
  return pending;
}
export function clearSignOutNotice(): void {
  pending = null;
}
