// Task 7: listas da Agenda (junta as duas queries, desduplica e separa Próximos/Resultados).
import type { GameStatus, Match } from '@/data/schemas';
import { agendaLists } from '@/lib/agenda';

function match(id: string, status: GameStatus, kickoff: string): Match {
  return {
    id,
    sport: 'football',
    competition: {
      key: 'football_94_2026',
      id: '94',
      name: 'Liga Portugal',
      type: 'league',
      season: '2026',
      round: 'Regular Season - 16',
      roundLabel: null,
    },
    home: { id: '228', name: 'Sporting CP', logo: null },
    away: { id: '217', name: 'SC Braga', logo: null },
    sportingSide: 'home',
    kickoff: new Date(kickoff),
    status,
    elapsed: null,
    elapsedExtra: null,
    score: { home: null, away: null, halftime: null, extratime: null, penalty: null },
    finishedAt: null,
    venue: null,
    referee: null,
    source: { provider: 'api-football', id, attribution: null },
  } as Match;
}

const ids = (ms: Match[]) => ms.map((m) => m.id);

it('um jogo adiado de ontem fica nos Próximos (não é resultado)', () => {
  const pst = match('pst', 'PST', '2026-11-17T20:30:00Z');
  const lists = agendaLists([pst], []);
  expect(ids(lists.upcoming)).toEqual(['pst']);
  expect(lists.results).toEqual([]);
});

it('um jogo cancelado vai para Resultados', () => {
  const canc = match('canc', 'CANC', '2026-11-17T20:30:00Z');
  const lists = agendaLists([canc], [canc]);
  expect(lists.upcoming).toEqual([]);
  expect(ids(lists.results)).toEqual(['canc']);
});

it('o jogo ao vivo aparece primeiro, mesmo que comece mais tarde no dia', () => {
  const live = match('live', 'LIVE', '2026-11-18T20:30:00Z');
  const ns = match('ns', 'NS', '2026-11-18T18:00:00Z');
  const later = match('later', 'NS', '2026-11-22T20:30:00Z');
  expect(ids(agendaLists([ns, later, live], []).upcoming)).toEqual(['live', 'ns', 'later']);
});

it('o intervalo também conta como ao vivo', () => {
  const ht = match('ht', 'HT', '2026-11-18T20:30:00Z');
  const ns = match('ns', 'NS', '2026-11-18T18:00:00Z');
  expect(ids(agendaLists([ns, ht], []).upcoming)).toEqual(['ht', 'ns']);
});

it('ids repetidos nas duas queries aparecem uma vez', () => {
  const ft = match('ft', 'FT', '2026-11-15T20:30:00Z');
  const ns = match('ns', 'NS', '2026-11-22T20:30:00Z');
  const lists = agendaLists([ns, ft], [ft, ns]);
  expect(ids(lists.upcoming)).toEqual(['ns']);
  expect(ids(lists.results)).toEqual(['ft']);
});

it('Próximos por data ascendente, Resultados por data descendente', () => {
  const upcoming = [match('b', 'NS', '2026-11-29T20:30:00Z'), match('a', 'NS', '2026-11-22T20:30:00Z')];
  const results = [
    match('x', 'FT', '2026-11-01T20:30:00Z'),
    match('z', 'AET', '2026-11-15T20:30:00Z'),
    match('y', 'PEN', '2026-11-08T20:30:00Z'),
  ];
  const lists = agendaLists(upcoming, results);
  expect(ids(lists.upcoming)).toEqual(['a', 'b']);
  expect(ids(lists.results)).toEqual(['z', 'y', 'x']);
});

it('não altera as listas recebidas', () => {
  const upcoming = [match('b', 'NS', '2026-11-29T20:30:00Z'), match('a', 'NS', '2026-11-22T20:30:00Z')];
  agendaLists(upcoming, []);
  expect(ids(upcoming)).toEqual(['b', 'a']);
});
