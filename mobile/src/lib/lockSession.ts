// "Arranque a frio" = primeira avaliação do BiometricGate desde que o bundle JS arrancou.
// Vive no módulo (sobrevive a remontagens do layout). O SessionProvider chama markFreshSession() sempre que
// observa signedOut: um login feito depois disso nunca conta como arranque a frio.
let coldStartPending = true;

export function consumeColdStart(): boolean {
  const v = coldStartPending;
  coldStartPending = false;
  return v;
}
export function markFreshSession(): void {
  coldStartPending = false;
}
export function resetColdStartForTests(): void {
  coldStartPending = true;
}
