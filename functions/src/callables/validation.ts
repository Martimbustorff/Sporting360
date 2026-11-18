/** Id de jogo válido: não vazio, sem "/" (caminho Firestore) e diferente de "none" (reservado no ledger). */
export function validGameId(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && !v.includes("/") && v !== "none";
}
