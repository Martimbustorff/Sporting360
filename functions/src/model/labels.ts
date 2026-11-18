import type { CompetitionType, Sport } from "./types";

type Label = { name: string; type: CompetitionType };

const FOOTBALL_BY_ID: Record<number, Label> = {
  94: { name: "Liga Portugal", type: "league" },
  96: { name: "Taça de Portugal", type: "cup" },
  97: { name: "Taça da Liga", type: "cup" },
  550: { name: "Supertaça", type: "supercup" },
  2: { name: "Liga dos Campeões", type: "europe" },
  3: { name: "Liga Europa", type: "europe" },
  848: { name: "Liga Conferência", type: "europe" },
  531: { name: "Supertaça Europeia", type: "europe" },
  10: { name: "Particular", type: "friendly" },
  667: { name: "Particular", type: "friendly" },
};

// Nomes (em minúsculas) das competições das outras modalidades, como vêm das fontes.
const OTHER_BY_NAME: Record<string, Label> = {
  "andebol 1": { name: "Andebol 1", type: "league" },
  "ehf european league": { name: "Liga Europa EHF", type: "europe" },
  "campeonato nacional": { name: "Campeonato Nacional", type: "league" },
  "cev champions league": { name: "Liga dos Campeões CEV", type: "europe" },
  "cev cup": { name: "Taça CEV", type: "europe" },
  "cev challenge cup": { name: "Taça Challenge CEV", type: "europe" },
  "liga portuguesa de basquetebol": { name: "Liga Portuguesa de Basquetebol", type: "league" },
  "taça de portugal": { name: "Taça de Portugal", type: "cup" },
  "supertaça": { name: "Supertaça", type: "supercup" },
  "elite cup": { name: "Elite Cup", type: "cup" },
  "wse champions league": { name: "Liga dos Campeões WSE", type: "europe" },
  // Futsal (futsalportugal.com: lista e JSON-LD das fichas) e hóquei (hp.fpp.pt, hoqueipatins.pt), nomes reais de 2026-11-17.
  "liga placard": { name: "Liga Placard", type: "league" },
  "taça da liga": { name: "Taça da Liga", type: "cup" },
  "uefa futsal champions league": { name: "Liga dos Campeões UEFA de Futsal", type: "europe" },
  "liga dos campeões uefa de futsal": { name: "Liga dos Campeões UEFA de Futsal", type: "europe" },
  "campeonato placard": { name: "Campeonato Placard", type: "league" },
  "campeonato placard hp - fase regular": { name: "Campeonato Placard", type: "league" },
  "supertaça antónio livramento placard": { name: "Supertaça", type: "supercup" },
  "elite cup masculina": { name: "Elite Cup", type: "cup" },
  "taça de portugal masculina": { name: "Taça de Portugal", type: "cup" },
  "liga dos campeões wse": { name: "Liga dos Campeões WSE", type: "europe" },
};

export function competitionLabel(sport: Sport, leagueId: number | null, rawName: string): Label {
  if (sport === "football") {
    return (leagueId !== null && FOOTBALL_BY_ID[leagueId]) || { name: rawName, type: "league" };
  }
  return OTHER_BY_NAME[rawName.trim().replace(/\s+/g, " ").toLowerCase()] ?? { name: rawName, type: "league" };
}

export function competitionKey(sport: Sport, leagueId: number | null, season: string): string {
  return `${sport}_${leagueId}_${season}`;
}

const KNOCKOUT_BY_AVOS: Record<number, string> = {
  2: "Meias-finais",
  4: "Quartos de final",
  8: "Oitavos de final",
};

function avos(n: number): string {
  return KNOCKOUT_BY_AVOS[n] ?? `${n} avos de final`;
}

function eliminatoria(n: string): string {
  return `${n}.ª eliminatória`;
}

/**
 * Rótulo curto em pt-PT para a ronda. Reconhece as formas da API-Football e as
 * das fontes gratuitas (hp.fpp.pt, hoqueipatins.pt, futsalportugal.com).
 * O que não reconhece devolve tal e qual; nunca começa por "J" sem número de jornada.
 */
export function roundLabel(raw: string | null, type: CompetitionType): string | null {
  if (raw === null) return null;
  if (type === "friendly") return null;

  // "Taça de Portugal Masculina | 4 Avos de Final" → parte depois de "|"; "0400-Oitavos…" → sem prefixo numérico.
  let t = raw.trim();
  if (t.includes("|")) t = t.slice(t.lastIndexOf("|") + 1).trim();
  t = t.replace(/^\d{3,}\s*-\s*/, "");

  let m: RegExpMatchArray | null;

  // Série de play-off (hp.fpp.pt, hoqueipatins.pt): "1/2 Final - Jornada 2" → "Meias-finais, jogo 2".
  if ((m = t.match(/^(.+?)\s+-\s+(?:(\d+)\s*[.ªa]?\s*jornada|jornada\s*(\d+))$/i))) {
    const phase = roundLabel(m[1], type);
    if (phase !== null && (phase !== m[1] || /^final$/i.test(m[1]))) return `${phase}, jogo ${m[2] ?? m[3]}`;
  }

  if ((m = t.match(/^regular season\s*-\s*(\d+)$/i))) return `J${m[1]}`;
  if ((m = t.match(/^league stage\s*-\s*(\d+)$/i))) return `Fase de liga, J${m[1]}`;
  if ((m = t.match(/^(?:group stage|group [a-z0-9]+)\s*-\s*(\d+)$/i))) return `Fase de grupos, J${m[1]}`;
  if ((m = t.match(/^(\d+)\s*[.ªa]?\s*jornada$/i)) || (m = t.match(/^jornada\s*(\d+)$/i))) return `J${m[1]}`;

  if ((m = t.match(/^round of (\d+)$/i))) return avos(Number(m[1]) / 2);
  if ((m = t.match(/^1\/(\d+)[\s-]*(?:de\s*)?finals?$/i))) return avos(Number(m[1]));
  if ((m = t.match(/^(\d+)(?:st|nd|rd|th)\s+finals?$/i))) return avos(Number(m[1]));
  if ((m = t.match(/^(\d+)\s*avos\s*(?:de\s*)?final$/i))) return avos(Number(m[1]));

  if (/^quarter[- ]?finals?$/i.test(t) || /^quartos[- ]de[- ]final$/i.test(t)) return "Quartos de final";
  if (/^semi[- ]?finals?$/i.test(t) || /^meias[- ]finais$/i.test(t)) return "Meias-finais";
  if (/^oitavos[- ]de[- ]final$/i.test(t)) return "Oitavos de final";
  if (/^final$/i.test(t)) return "Final";

  if ((m = t.match(/^(\d+)(?:st|nd|rd|th)\s+round$/i))) return eliminatoria(m[1]);
  if ((m = t.match(/^(\d+)\s*[.]?\s*ª\s*eliminat[óo]ria$/i))) return eliminatoria(m[1]);

  if (/^(?:knockout round )?play-?offs?$/i.test(t)) return "Play-off";

  return raw;
}
