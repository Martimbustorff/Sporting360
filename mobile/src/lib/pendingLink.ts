// Plano 8, Task 6: link aberto sem sessão. O guarda de (app) manda o utilizador para /welcome e o destino perdia-se;
// guarda-se aqui (módulo, só em memória) até haver sessão. Só aceita /e/{id} (empréstimo de GameBox) e /j (link do
// cartão de prognóstico): nada de URLs externas nem caminhos arbitrários.
const ALLOWED = /^\/(?:e\/[\w-]{1,64}|j)(?:\?[\w\-.=&%]*)?$/;

let pending: string | null = null;

export function setPendingLink(href: string): void {
  if (ALLOWED.test(href)) pending = href;
}

/** Lê sem consumir (o render do guarda tem de ser puro: o React pode renderizar duas vezes). */
export function peekPendingLink(): string | null {
  return pending;
}

/** Entrega o link pendente (uma só vez). */
export function takePendingLink(): string | null {
  const link = pending;
  pending = null;
  return link;
}

/** Rota da app para um link guardado: `/e/{id}` abre `/emprestimo/{id}`; `/j` abre-se tal e qual. */
export function pendingLinkRoute(link: string): string {
  const m = /^\/e\/([\w-]+)$/.exec(link);
  return m ? `/emprestimo/${m[1]}` : link;
}

/** Ao terminar a sessão: um link guardado não passa para a conta seguinte. */
export function clearPendingLink(): void {
  pending = null;
}
