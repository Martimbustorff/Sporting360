/** Documento `config/app`: lido sem sessão pela app (portão de atualização obrigatória). */
export interface AppConfig {
  /** Versões mínimas aceites, semver. Sobem no Plano 5. */
  minVersion: { ios: string; android: string };
  storeUrls?: { ios?: string; android?: string };
  texts: { updateRequiredTitle: string; updateRequiredBody: string; updateButton: string };
  comunidadeLeonina: CommunityEntry[];
  /** Secções escondidas na UI por configuração (não apagadas). */
  features?: { comunidadeLeonina?: boolean };
}

export interface CommunityEntry {
  name: string;
  description: string | null;
  image: string | null;
  links: { twitter?: string; patreon?: string; youtube?: string };
}
