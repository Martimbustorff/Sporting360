// Pontos provisórios do prognóstico durante o jogo (frame 06 do Figma, aprovado pelo Martim): participação 1 + exato 3
// ou vencedor/empate 1, com o resultado atual. Espelha `functions/src/game/scoring.ts` (POINTS e predictionBonus) e
// `result.ts` (outcome); o teste `provisionalPoints.test.ts` compara as duas implementações em grelha. Depois de
// liquidado mandam sempre os `pointEvents` do servidor.
type Score = { home: number; away: number };

export type ProvisionalPoints = { total: number; kind: 'exact' | 'outcome' | 'none' };

const PARTICIPATION = 1;
const EXACT = 3;
const OUTCOME = 1;

const outcomeOf = (home: number, away: number): 'H' | 'D' | 'A' => (home > away ? 'H' : home < away ? 'A' : 'D');

export function provisionalPoints(pred: Score, live: Score): ProvisionalPoints {
  if (pred.home === live.home && pred.away === live.away) return { total: PARTICIPATION + EXACT, kind: 'exact' };
  if (outcomeOf(pred.home, pred.away) === outcomeOf(live.home, live.away)) {
    return { total: PARTICIPATION + OUTCOME, kind: 'outcome' };
  }
  return { total: PARTICIPATION, kind: 'none' };
}

/** Linha de apoio do cartão ao vivo ("Estás a acertar no ..."), a partir do palpite e do tipo de acerto. */
export function provisionalNote(pred: Score, kind: ProvisionalPoints['kind']): string {
  if (kind === 'exact') return 'Estás a acertar no resultado exato';
  if (kind === 'outcome') return pred.home === pred.away ? 'Estás a acertar no empate' : 'Estás a acertar no vencedor';
  return 'Para já só tens o ponto da participação';
}
