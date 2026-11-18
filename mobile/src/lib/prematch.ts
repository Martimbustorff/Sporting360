// Pré-jogo e informação do jogo da tab Sumário: funções puras sobre os documentos do Plano 2
// (`details/prematch`, `details/injuries`, `venues/{id}`). Textos em pt-PT.
import type { PrematchDoc } from '@/data/schemas';
import { MONTHS_SHORT, lisbonParts } from '@/lib/ptDate';

export type FormLetter = 'V' | 'E' | 'D';
const FORM: Record<string, FormLetter> = { W: 'V', D: 'E', L: 'D' };

/** Forma da API ("WWDLW", mais recente no fim) em pt-PT, só os últimos 5 jogos. */
export function formLetters(form: string | null): FormLetter[] {
  if (!form) return [];
  const letters = [...form.toUpperCase()].flatMap((c) => (FORM[c] ? [FORM[c]] : []));
  return letters.slice(-5);
}

const TYPE_TEXT: Record<string, string> = { 'Missing Fixture': 'Fora', Questionable: 'Dúvida', Doubtful: 'Dúvida' };
const BAN_REASONS = new Set(['suspended', 'red card', 'yellow cards']);
// Por ordem: o mais específico primeiro ("Hamstring Muscle Injury" é dos isquiotibiais, não "muscular").
// Palavras inteiras (`\b`): "Championship" não é anca, "Setback" não são costas, "Football" não é pé.
const REASONS: [RegExp, string][] = [
  [/\bhamstrings?\b/i, 'Lesão nos isquiotibiais'],
  [/\bachilles\b/i, 'Lesão no tendão de Aquiles'],
  [/\b(knees?|acl|cruciate|menisc\w*)\b/i, 'Lesão no joelho'],
  [/\bankles?\b/i, 'Lesão no tornozelo'],
  [/\b(groin|adductors?)\b/i, 'Lesão na virilha'],
  [/\b(calf|calves)\b/i, 'Lesão na barriga da perna'],
  [/\b(thighs?|quadriceps)\b/i, 'Lesão na coxa'],
  [/\b(foot|feet|toes?)\b/i, 'Lesão no pé'],
  [/\bhips?\b/i, 'Lesão na anca'],
  [/\bshoulders?\b/i, 'Lesão no ombro'],
  [/\b(back|lumbar)\b/i, 'Lesão nas costas'],
  [/\b(head|concussion)\b/i, 'Lesão na cabeça'],
  [/\b(muscles?|muscular|strain\w*)\b/i, 'Lesão muscular'],
  [/\b(illness|virus|covid\w*|flu)\b/i, 'Doença'],
];

/**
 * Motivo de uma ausência da API-Football (`injuries.reason`, `sidelined.type`) em pt-PT: castigos "Castigo",
 * partes do corpo conhecidas ("Lesão no joelho"), doença "Doença"; o resto "Lesão" (nunca o texto inglês).
 */
export function injuryReasonText(reason: string): string {
  const r = reason.trim();
  if (BAN_REASONS.has(r.toLowerCase())) return 'Castigo';
  return REASONS.find(([re]) => re.test(r))?.[1] ?? 'Lesão';
}

/** "Dúvida, Lesão no joelho". Um tipo desconhecido é "Fora" (nunca o texto inglês); partes vazias não aparecem. */
export function injuryText(type: string, reason: string): string {
  const t = type.trim();
  const r = reason.trim();
  return [t ? (TYPE_TEXT[t] ?? 'Fora') : '', r ? injuryReasonText(r) : ''].filter(Boolean).join(', ');
}

export type PrematchEmpty = Extract<PrematchDoc, { empty: true }>;
export type PrematchFull = Exclude<PrematchDoc, PrematchEmpty>;

/** `{ fetchedAt, empty: true }`: a API não tem previsões para este jogo. */
export function isPrematchEmpty(p: PrematchDoc): p is PrematchEmpty {
  return 'empty' in p && p.empty === true;
}

/** Inteiro com os milhares separados por espaço, como em pt-PT ("50 095"). */
export function capacityText(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Data de um confronto direto, em Lisboa: "1 Fev 2026". */
export function h2hDate(d: Date): string {
  const p = lisbonParts(d);
  return `${p.day} ${MONTHS_SHORT[p.month - 1]} ${p.year}`;
}
