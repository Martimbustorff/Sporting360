/**
 * R10: estado "perfil garantido" (por uid) partilhado entre signUpEmail e o SessionProvider.
 * - signUpEmail escreve users/{uid} e chama ensureProfile() ele próprio; enquanto decorre, o
 *   SessionProvider não deve chamar ensureProfile (o evento de auth chega antes de o nome existir).
 * - Sessão herdada da V2 (já autenticado ao arrancar): ninguém marcou o uid, o provider chama uma vez.
 */
let signUpInProgress = false;
let ensuredUid: string | null = null;

export function beginSignUp(): void {
  signUpInProgress = true;
}
export function endSignUp(): void {
  signUpInProgress = false;
}
export function markProfileEnsured(uid: string): void {
  ensuredUid = uid;
}
export function clearProfileEnsured(): void {
  ensuredUid = null;
}
export function resetProfileEnsured(): void {
  signUpInProgress = false;
  ensuredUid = null;
}
/** true se o provider deve chamar ensureProfile para este uid (e marca-o logo, para ser uma só vez). */
export function claimProfileEnsure(uid: string): boolean {
  if (signUpInProgress || ensuredUid === uid) return false;
  ensuredUid = uid;
  return true;
}
