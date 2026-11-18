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

const TYPE_TEXT: Record<string, string> = { 'Missing Fixture': 'Fora', Questionable: 'Dúvida' };
const BAN_REASONS = new Set(['Suspended', 'Red Card', 'Yellow Cards']);

function reasonText(reason: string): string {
  if (/injury/i.test(reason)) return 'Lesão';
  if (BAN_REASONS.has(reason)) return 'Castigo';
  return reason;
}

/** "Dúvida, Lesão". Um valor desconhecido mostra o texto original; partes vazias não aparecem. */
export function injuryText(type: string, reason: string): string {
  const t = type.trim();
  const r = reason.trim();
  return [t ? (TYPE_TEXT[t] ?? t) : '', r ? reasonText(r) : ''].filter(Boolean).join(', ');
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
