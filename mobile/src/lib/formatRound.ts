// Traduz o texto da ronda (API em inglês) para pt-PT. Idempotente: texto já traduzido
// (incluindo o formato gravado pelo backend, com vírgula: "Fase de liga, J3") passa tal e qual.
// Ruling R5: separador com vírgula, nunca ponto médio. Qualquer outra coisa devolve-se como está.

const ORDINAL_ROUNDS: Record<string, string> = {
  '1st round': '1.ª eliminatória',
  '2nd round': '2.ª eliminatória',
  '3rd round': '3.ª eliminatória',
  '4th round': '4.ª eliminatória',
};

const FIXED: Record<string, string> = {
  'round of 32': '16 avos de final',
  'round of 16': 'Oitavos de final',
  '8th finals': 'Oitavos de final',
  'quarter-finals': 'Quartos de final',
  'semi-finals': 'Meias-finais',
  final: 'Final',
  'play-offs': 'Play-off',
  'knockout round play-offs': 'Play-off',
  'qualifying round': 'Pré-eliminatória',
};

export function formatRound(raw: string | null | undefined): string {
  const text = (raw ?? '').trim();
  if (!text) return '';
  const key = text.toLowerCase();

  const matchday = /^(?:regular season\s*-\s*)?j?(\d+)$/i.exec(text);
  if (matchday) return `J${matchday[1]}`;

  const league = /^league (?:stage|phase)\s*-\s*(\d+)$/i.exec(text);
  if (league) return `Fase de liga, J${league[1]}`;

  const group = /^group(?: stage| [a-z])?\s*-\s*(\d+)$/i.exec(text);
  if (group) return `Fase de grupos, J${group[1]}`;

  return ORDINAL_ROUNDS[key] ?? FIXED[key] ?? text;
}
