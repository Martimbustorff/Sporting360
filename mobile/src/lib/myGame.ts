// "Meu jogo" do Perfil (spec §5.11 e §6): contas feitas na app a partir dos prognósticos da V2027, das liquidações
// do servidor e dos eventos de pontos. A app só lê: os pontos vêm sempre dos `pointEvents` escritos pelo servidor.
// - Liquidado = existe `settlements/{gameId}` e o evento `prediction_participation` desse jogo está entre os eventos
//   lidos (o servidor só dá bónus a quem tem participação, settle.ts). Um prognóstico cujos eventos ficaram fora da
//   janela lida (ou sem participação) não conta como liquidado: nunca é um falhanço falso.
// - Acerto = (exatos + vencedores) / liquidados, arredondado; `null` sem liquidados.
// - Série atual = liquidados seguidos com acerto, do mais recente para trás; os não liquidados saltam-se.
// - A data de cada jogo é o `gameDate` do evento `prediction_participation` (sem ele, `createdAt` do prognóstico).
import type { MatchPrediction, PointEvent, Settlement } from '@/data/schemas';

const HISTORY_LIMIT = 20;

export type MyGameHistoryItem = {
  gameId: string;
  gameDate: Date;
  pick: string;
  final: string | null;
  points: number;
};

export type MyGameStats = {
  settled: number;
  accuracyPct: number | null;
  exact: number;
  outcome: number;
  mvpCorrect: number;
  streak: number;
  history: MyGameHistoryItem[];
};

type GameEvents = { types: Set<string>; points: number; participationDate: Date | null };

function eventsByGame(events: PointEvent[]): Map<string, GameEvents> {
  const byGame = new Map<string, GameEvents>();
  for (const e of events) {
    if (e.gameId === null) continue;
    const g = byGame.get(e.gameId) ?? { types: new Set<string>(), points: 0, participationDate: null };
    g.types.add(e.type);
    g.points += e.points;
    if (e.type === 'prediction_participation') g.participationDate = e.gameDate;
    byGame.set(e.gameId, g);
  }
  return byGame;
}

export function myGameStats(i: {
  predictions: MatchPrediction[];
  settlements: Record<string, Settlement>;
  events: PointEvent[];
}): MyGameStats {
  const byGame = eventsByGame(i.events);
  const games = i.predictions
    .map((p) => {
      const ev = byGame.get(p.gameId);
      const s = i.settlements[p.gameId];
      const exact = ev?.types.has('prediction_exact') === true;
      return {
        gameId: p.gameId,
        gameDate: ev?.participationDate ?? p.createdAt ?? new Date(0),
        pick: `${p.home}-${p.away}`,
        final: s ? `${s.finalHome}-${s.finalAway}` : null,
        points: ev?.points ?? 0,
        settled: s !== undefined && ev?.participationDate != null,
        exact,
        outcome: !exact && ev?.types.has('prediction_outcome') === true,
      };
    })
    .sort((a, b) => b.gameDate.getTime() - a.gameDate.getTime());

  const settledGames = games.filter((g) => g.settled);
  const exact = settledGames.filter((g) => g.exact).length;
  const outcome = settledGames.filter((g) => g.outcome).length;
  const firstMiss = settledGames.findIndex((g) => !g.exact && !g.outcome);

  return {
    settled: settledGames.length,
    accuracyPct: settledGames.length === 0 ? null : Math.round((100 * (exact + outcome)) / settledGames.length),
    exact,
    outcome,
    mvpCorrect: i.events.filter((e) => e.type === 'mvp_correct').length,
    streak: firstMiss === -1 ? settledGames.length : firstMiss,
    history: games
      .slice(0, HISTORY_LIMIT)
      .map(({ gameId, gameDate, pick, final, points }) => ({ gameId, gameDate, pick, final, points })),
  };
}
