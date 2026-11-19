// Ids de equipas partilhados por lib/ e components/. Este módulo não importa nada de components/
// (evita o ciclo GameHeader <-> matchVM em runtime).

/** Sporting na API-Football. Com este id usa-se sempre o emblema local 2026. */
export const SPORTING_API_ID = 228;

/** Nome curto do clube para espaços apertados (faixa do bilhete, 4936:7207): "Sporting CP" passa a "Sporting". */
export const shortClubName = (name: string): string => name.replace(/^Sporting CP\b/, 'Sporting');
