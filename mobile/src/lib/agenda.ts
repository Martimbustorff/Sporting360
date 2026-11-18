// Listas da Agenda: junta as duas queries (próximos e resultados), desduplica por id e separa os
// jogos pelo estado. Sem React nem Firestore; só recebe `Match` já validado (data/schemas.ts).
// Os estados vêm de `uiState` (Task 4), para não haver uma segunda tabela de estados na app.
import type { Match } from '@/data/schemas';
import { uiState, type UiState } from '@/lib/matchVM';

/** Próximos: por jogar, a decorrer ou adiado (NS, LIVE, HT, PST). O resto (FT, AET, PEN, CANC) é resultado. */
const UPCOMING: readonly UiState[] = ['scheduled', 'live', 'halftime', 'postponed'];
const IN_PLAY: readonly UiState[] = ['live', 'halftime'];

const isUpcoming = (m: Match) => UPCOMING.includes(uiState(m.status));
/** 0 para os jogos a decorrer, 1 para os outros: o que está a jogar-se fica no topo dos Próximos. */
const livePriority = (m: Match) => (IN_PLAY.includes(uiState(m.status)) ? 0 : 1);
const byKickoffAsc = (a: Match, b: Match) => a.kickoff.getTime() - b.kickoff.getTime();

/**
 * Próximos por data ascendente (ao vivo primeiro) e Resultados por data descendente, a partir das
 * duas listas das queries. Um jogo que apareça nas duas (a janela delas sobrepõe-se) conta uma vez.
 * As listas recebidas não são alteradas.
 */
export function agendaLists(upcoming: Match[], results: Match[]): { upcoming: Match[]; results: Match[] } {
  const byId = new Map<string, Match>();
  for (const m of [...upcoming, ...results]) if (!byId.has(m.id)) byId.set(m.id, m);
  const all = [...byId.values()];
  return {
    upcoming: all.filter(isUpcoming).sort((a, b) => livePriority(a) - livePriority(b) || byKickoffAsc(a, b)),
    results: all.filter((m) => !isUpcoming(m)).sort((a, b) => byKickoffAsc(b, a)),
  };
}
