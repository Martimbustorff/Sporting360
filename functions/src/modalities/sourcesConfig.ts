// Fontes das modalidades escolhidas na Task 1 (investigação de 2026-11-17).
// Detalhes, termos e alternativas rejeitadas: docs/superpowers/notes/2026-11-24-fontes-modalidades.md

export interface FreeSourceRef {
  key: string;
  kind: "html" | "json" | "ical" | "rss";
  url: string;
  notes: string;
}

export interface ApiSportsLeague {
  name: string;
  /** null = por confirmar com uma chamada real; true/false só depois de confirmado. */
  id: number | null;
  covered: boolean | null;
}

export interface ApiSportsSport {
  host: string;
  /** Desligado até os ids estarem confirmados (ver nota, secção "Pendentes"). */
  enabled: boolean;
  /** null = por confirmar com uma chamada real. */
  teamId: number | null;
  seasonFormat: "year" | "span";
  leagues: ApiSportsLeague[];
}

export const API_SPORTS: Record<"handball" | "volleyball" | "basketball", ApiSportsSport> = {
  handball: {
    host: "v1.handball.api-sports.io",
    enabled: false,
    teamId: null,
    seasonFormat: "year",
    leagues: [
      { id: null, name: "Andebol 1", covered: null },
      { id: null, name: "EHF European League", covered: null },
    ],
  },
  volleyball: {
    host: "v1.volleyball.api-sports.io",
    enabled: false,
    teamId: null,
    seasonFormat: "year",
    leagues: [
      { id: null, name: "Campeonato Nacional", covered: null },
      { id: null, name: "Taça de Portugal", covered: null },
      { id: null, name: "Supertaça", covered: null },
      { id: null, name: "CEV Champions League", covered: null },
      { id: null, name: "CEV Cup", covered: null },
      { id: null, name: "CEV Challenge Cup", covered: null },
    ],
  },
  basketball: {
    host: "v1.basketball.api-sports.io",
    enabled: false,
    teamId: null,
    seasonFormat: "span",
    leagues: [
      { id: null, name: "Liga Portuguesa de Basquetebol", covered: null },
      { id: null, name: "Taça de Portugal", covered: null },
    ],
  },
};

const HP_FPP: FreeSourceRef = {
  key: "hp_fpp",
  kind: "html",
  url: "https://hp.fpp.pt",
  notes:
    "Portal oficial da Federação de Patinagem de Portugal, HTML no servidor. Uma página por fase: /Competicao/{id} (493 Campeonato Placard fase regular, 496 Supertaça, 509 Elite Cup, 508 Taça de Portugal). Lista de fases: /136/{12|19|15|20}. Hora local de Lisboa, sem local do jogo, sem ano nas rondas. Pedir no máximo 1 vez por 10 min fora de dia de jogo.",
};

const HOQUEIPATINS: FreeSourceRef = {
  key: "hoqueipatins",
  kind: "json",
  url: "https://www.hoqueipatins.pt/wp-json/sportspress/v2/events",
  notes:
    "SportsPress REST (WordPress). Filtros: seasons=1122 (2026/2027), leagues=230|233|535|538|1123, per_page=100, orderby=date. Sporting = team 3860 (filtrar por id, 'Sporting' apanha Sporting B e Alcoi). date é hora de Lisboa; date_gmt nem sempre é fiável. Site não oficial, termos pedem indicação da fonte.",
};

const FUTSALPORTUGAL: FreeSourceRef = {
  key: "futsalportugal",
  kind: "html",
  url: "https://futsalportugal.com/pt/schedule/3/{competicao}",
  notes:
    "Zona Técnica Futsal, HTML no servidor. Competições: 26 Liga Placard, 45 Taça de Portugal, 43 Taça da Liga, 40 Supertaça, 57 UEFA Futsal Champions League. A hora da lista segue o país do pedido (aparece 'hora US'); usar o startDate com offset do JSON-LD de /pt/gamesheet/{id} para a hora certa e o local. Pedir no máximo 1 vez por 30 min.",
};

const FUTSALPORTUGAL_GAMESHEET: FreeSourceRef = {
  key: "futsalportugal_gamesheet",
  kind: "html",
  url: "https://futsalportugal.com/pt/gamesheet/{id}",
  notes:
    "Mesmo editor, vista diferente: JSON-LD SportsEvent com startDate (offset de Lisboa), local e resultado no título. Serve de recurso quando a lista muda de estrutura, mas não é independente. Não há segunda fonte gratuita independente para futsal (FPF e zerozero bloqueiam clientes automáticos).",
};

const WSE_SCHEDULE: FreeSourceRef = {
  key: "wse_schedule_post",
  kind: "json",
  url: "https://europe.worldskate.org/wp-json/wp/v2/posts/50343?_fields=content",
  notes:
    "Calendário oficial das taças europeias de hóquei 2026-27 em texto (jornada, data, equipas, sem hora). Só confirma datas; resultados vêm de artigos.",
};

export const FREE_SOURCES: Record<"futsal" | "roller_hockey", { primary: FreeSourceRef; fallback: FreeSourceRef }> = {
  futsal: { primary: FUTSALPORTUGAL, fallback: FUTSALPORTUGAL_GAMESHEET },
  roller_hockey: { primary: HP_FPP, fallback: HOQUEIPATINS },
};

/** Competições europeias de hóquei: a fonte oficial só tem texto; o recurso estruturado é o hoqueipatins (liga 1123). */
export const ROLLER_HOCKEY_EUROPE: { primary: FreeSourceRef; fallback: FreeSourceRef } = {
  primary: HOQUEIPATINS,
  fallback: WSE_SCHEDULE,
};

export const API_SPORTS_GAPS: {
  sport: "handball" | "volleyball" | "basketball";
  competition: string;
  primary: FreeSourceRef;
  fallback: FreeSourceRef;
}[] = [
  // Não confirmados sem chave (a página de cobertura da API-Sports só mostra 15 linhas sem JavaScript).
  // Fontes por avaliar na Task 16: federações (fpa.pt, fpb.pt respondem a pedidos normais).
];

/** Textos de ronda reais, copiados das fontes escolhidas (2026-11-17), para os testes de roundLabel. */
export const REAL_ROUND_TEXTS = {
  hp_fpp: [
    "1ª Jornada",
    "26ª Jornada",
    "Jornada 1",
    "Final",
    "1/4 Final",
    "1/2 Final",
    "Meias Finais",
    "Pré Eliminatória Norte",
    "Pré Eliminatória Sul",
    "Taça de Portugal Masculina | 4 Avos de Final",
    "8 Avos de Final",
  ],
  hoqueipatins: ["0001-Jornada 1", "0300-Quartos de Final", "0100-FINAL", "0400-Oitavos de Final"],
  futsalportugal: [
    "1ª Jornada",
    "22ª Jornada",
    "1ª Eliminatória",
    "2.ª Eliminatória",
    "3.ª Eliminatória",
    "Quartos-De-Final",
    "Meias-Finais",
    "Final",
    "Oitavos-De-Final",
    "Jornada 1",
  ],
} as const;
