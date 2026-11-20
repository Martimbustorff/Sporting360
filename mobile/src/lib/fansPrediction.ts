// Previsão dos sportinguistas (Plano 10, Figma 52a/52b/52c). Contagem anónima dos palpites da app em
// `predictionTallies/{gameId}` (servidor: functions/src/game/fansPrediction.ts). Decisões do Martim (20/11):
// abaixo de FANS_MIN palpites não aparece nada; antes do apito só o número de palpites; as percentagens
// (vitória/empate/derrota do Sporting) só a partir do apito inicial, quando o servidor as publica.
import type { FansPrediction } from '@/data/schemas';
import type { UiState } from '@/lib/matchVM';

export const FANS_MIN = 50;

export type FansView = { kind: 'count'; total: number } | { kind: 'split'; percents: [number, number, number]; top: number };

/** Percentagens inteiras de vitória/empate/derrota que somam 100 (maior resto). */
export function splitPercents(s: { win: number; draw: number; loss: number }): [number, number, number] {
  const sum = s.win + s.draw + s.loss;
  if (sum <= 0) return [0, 0, 0];
  const raw = [s.win, s.draw, s.loss].map((n) => (n * 100) / sum);
  const out = raw.map(Math.floor);
  const left = 100 - out.reduce((a, b) => a + b, 0);
  raw
    .map((r, i) => ({ i, rest: r - Math.floor(r) }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i)
    .slice(0, left)
    .forEach(({ i }) => (out[i] = (out[i] ?? 0) + 1));
  const [win = 0, draw = 0, loss = 0] = out;
  return [win, draw, loss];
}

export function fansView(doc: FansPrediction | null, state: UiState): FansView | null {
  if (!doc || doc.total < FANS_MIN) return null;
  if (state === 'scheduled') return { kind: 'count', total: doc.total };
  if (state === 'postponed' || state === 'cancelled') return null;
  if (doc.win === undefined || doc.draw === undefined || doc.loss === undefined) return null;
  const percents = splitPercents({ win: doc.win, draw: doc.draw, loss: doc.loss });
  const top = percents.indexOf(Math.max(...percents));
  return { kind: 'split', percents, top };
}

/** 1234 -> "1.234" (separador de milhares com ponto, como no Figma 52a). */
export function thousandsPt(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
