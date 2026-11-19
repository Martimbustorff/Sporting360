/** Documento `config/app`: lido sem sessão pela app (portão de atualização obrigatória). */
export interface AppConfig {
  /** Versões mínimas aceites, semver. Sobem no Plano 5. */
  minVersion: { ios: string; android: string };
  storeUrls?: { ios?: string; android?: string };
  texts: { updateRequiredTitle: string; updateRequiredBody: string; updateButton: string };
  comunidadeLeonina: CommunityEntry[];
  /** Secções escondidas na UI por configuração (não apagadas). */
  features?: { comunidadeLeonina?: boolean };
  /**
   * Empréstimos de GameBox. Por omissão desligado: só se liga depois de `firestore.final.rules` estar publicada (L5), porque
   * na fase 2 `gamebox` e `users` são públicos. Um empréstimo já ativo continua a funcionar com o interruptor desligado.
   */
  loansEnabled?: boolean;
}

export interface CommunityEntry {
  name: string;
  description: string | null;
  image: string | null;
  links: { twitter?: string; patreon?: string; youtube?: string };
}
