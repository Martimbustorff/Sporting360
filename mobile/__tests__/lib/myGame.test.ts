// Task 21: estatísticas do "meu jogo" (spec §5.11). Vetor do preflight T21: settled 4, 75 %, exact 2, outcome 1, streak 2.
import type { MatchPrediction, PointEvent, Settlement } from '@/data/schemas';
import { myGameStats } from '@/lib/myGame';

const day = (n: number) => new Date(Date.UTC(2026, 10, n, 20, 0));
const pred = (gameId: string, home: number, away: number, created: Date | null = null): MatchPrediction => ({
  gameId,
  userId: 'me',
  home,
  away,
  createdAt: created,
  source: 'v2027',
});
const ev = (gameId: string | null, type: string, points: number, gameDate: Date): PointEvent => ({
  uid: 'me',
  gameId,
  type,
  points,
  gameDate,
});
const settle = (finalHome: number, finalAway: number): Settlement => ({ finalHome, finalAway, officialMvp: [] });

// Do mais recente para o mais antigo: g5 por liquidar, g4 exato, g3 vencedor, g2 falhado, g1 exato.
const predictions = [pred('g5', 1, 0), pred('g4', 2, 1), pred('g3', 3, 0), pred('g2', 0, 0), pred('g1', 1, 1)];
const settlements: Record<string, Settlement> = { g4: settle(2, 1), g3: settle(1, 0), g2: settle(0, 2), g1: settle(1, 1) };
const events: PointEvent[] = [
  ev('g5', 'prediction_participation', 1, day(15)),
  ev('g4', 'prediction_participation', 1, day(12)),
  ev('g4', 'prediction_exact', 5, day(12)),
  ev('g4', 'mvp_participation', 1, day(12)),
  ev('g4', 'mvp_correct', 3, day(12)),
  ev('g3', 'prediction_participation', 1, day(9)),
  ev('g3', 'prediction_outcome', 2, day(9)),
  ev('g2', 'prediction_participation', 1, day(6)),
  ev('g1', 'prediction_participation', 1, day(3)),
  ev('g1', 'prediction_exact', 5, day(3)),
  ev('g0', 'mvp_correct', 3, day(1)),
];

describe('myGameStats', () => {
  it('conta liquidados, acerto, exatos, vencedores e a série atual', () => {
    const s = myGameStats({ predictions, settlements, events });
    expect(s).toMatchObject({ settled: 4, accuracyPct: 75, exact: 2, outcome: 1, streak: 2 });
  });

  it('mvp_correct conta em mvpCorrect, também em jogos sem prognóstico', () => {
    expect(myGameStats({ predictions, settlements, events }).mvpCorrect).toBe(2);
  });

  it('sem liquidados: accuracyPct null, série 0', () => {
    const s = myGameStats({ predictions: [pred('g5', 1, 0)], settlements: {}, events: [] });
    expect(s).toMatchObject({ settled: 0, accuracyPct: null, exact: 0, outcome: 0, streak: 0 });
  });

  it('a série para no primeiro liquidado sem acerto e salta os não liquidados', () => {
    // g4 falhado mais recente: série 0, mesmo com acertos antes.
    const s = myGameStats({
      predictions,
      settlements,
      events: events.filter((e) => !(e.gameId === 'g4' && e.type === 'prediction_exact')),
    });
    expect(s.streak).toBe(0);
    expect(s.exact).toBe(1);
  });

  it('a ordem vem do gameDate do evento de participação, não da ordem da lista', () => {
    const s = myGameStats({ predictions: [...predictions].reverse(), settlements, events });
    expect(s.streak).toBe(2);
    expect(s.history.map((h) => h.gameId)).toEqual(['g5', 'g4', 'g3', 'g2', 'g1']);
  });

  it('histórico: palpite, resultado final (null por liquidar) e soma dos pontos do jogo', () => {
    const { history } = myGameStats({ predictions, settlements, events });
    expect(history[0]).toEqual({ gameId: 'g5', gameDate: day(15), pick: '1-0', final: null, points: 1 });
    expect(history[1]).toEqual({ gameId: 'g4', gameDate: day(12), pick: '2-1', final: '2-1', points: 10 });
    expect(history[3]).toMatchObject({ gameId: 'g2', final: '0-2', points: 1 });
  });

  it('sem evento de participação usa createdAt; o histórico fica nos 20 mais recentes', () => {
    const many = Array.from({ length: 25 }, (_, i) => pred(`p${i}`, 1, 0, day(i + 1)));
    const { history } = myGameStats({ predictions: many, settlements: {}, events: [] });
    expect(history).toHaveLength(20);
    expect(history[0]?.gameId).toBe('p24');
    expect(history[19]?.gameId).toBe('p5');
  });

  it('com liquidação mas sem participação nos eventos lidos não conta como liquidado nem como falhanço', () => {
    const s = myGameStats({
      predictions: [pred('gx', 0, 0, day(20)), ...predictions],
      settlements: { ...settlements, gx: settle(3, 3) },
      events,
    });
    expect(s).toMatchObject({ settled: 4, accuracyPct: 75, exact: 2, outcome: 1, streak: 2 });
    // Continua no histórico, com o resultado final.
    expect(s.history[0]).toMatchObject({ gameId: 'gx', final: '3-3', points: 0 });
  });

  it('utilizador com mais prognósticos do que a janela de eventos: acerto só sobre os jogos com eventos', () => {
    // 30 jogos liquidados; só os 10 mais recentes têm eventos lidos (8 exatos, 2 falhados).
    const many = Array.from({ length: 30 }, (_, i) => pred(`h${i}`, 1, 0, day(1)));
    const allSettled = Object.fromEntries(many.map((p) => [p.gameId, settle(1, 0)]));
    const recent: PointEvent[] = [];
    for (let i = 20; i < 30; i++) {
      const date = new Date(Date.UTC(2026, 10, 1, i));
      recent.push(ev(`h${i}`, 'prediction_participation', 1, date));
      if (i >= 22) recent.push(ev(`h${i}`, 'prediction_exact', 5, date));
    }
    const s = myGameStats({ predictions: many, settlements: allSettled, events: recent });
    expect(s).toMatchObject({ settled: 10, accuracyPct: 80, exact: 8, outcome: 0, streak: 8 });
  });

  it('arredonda a percentagem (2 em 3 = 67)', () => {
    const s = myGameStats({
      predictions: predictions.slice(1, 4),
      settlements,
      events,
    });
    expect(s).toMatchObject({ settled: 3, accuracyPct: 67 });
  });
});
