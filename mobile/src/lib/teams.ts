// Ids de equipas partilhados por lib/ e components/. Este módulo não importa nada de components/
// (evita o ciclo GameHeader <-> matchVM em runtime).

/** Sporting na API-Football. Com este id usa-se sempre o emblema local 2026. */
export const SPORTING_API_ID = 228;

/** Nome curto do clube para espaços apertados (faixa do bilhete, 4936:7207): "Sporting CP" passa a "Sporting". */
export const shortClubName = (name: string): string => name.replace(/^Sporting CP\b/, 'Sporting');

// Siglas e palavras de ligação que não identificam o clube ("AD Fundão" → "Fundão").
const GENERIC = new Set(['sc', 'fc', 'cf', 'sl', 'cp', 'ad', 'ud', 'cd', 'gd', 'hc', 'oc', 'cs', 'ac', 'sad', 'clube', 'de', 'do', 'da', 'dos', 'das', 'd', 'e']);

/**
 * Iniciais para o emblema de recurso, quando a fonte não tem emblema do adversário: as duas primeiras palavras que
 * identificam o clube ("SC Ferreira do Zêzere" → "FZ"), ou as duas primeiras letras de uma só ("AD Fundão" → "FU").
 * Sem co-nome depois de "/" ("J. Pacense / Des Compagnons" → "JP").
 */
export function teamInitials(name: string): string {
  const words = (name.split('/')[0] ?? '')
    .replace(/[.'’`]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w !== '' && !GENERIC.has(w.toLowerCase()));
  if (words.length === 0) return name.trim().slice(0, 2).toUpperCase();
  const [a = '', b = ''] = words;
  if (words.length === 1) return a.slice(0, 2).toUpperCase();
  return (a.slice(0, 1) + b.slice(0, 1)).toUpperCase();
}
