import { CREST_FILE, matchActivityProps } from '@/lib/matchActivity';
import type { EventItem, Match } from '@/data/schemas';

const NOW = new Date('2026-12-21T21:40:00Z');
const m = (over: Partial<Match> = {}): Match =>
  ({
    id: 'g1',
    sport: 'football',
    competition: { key: 'football_94_2026', id: '94', name: 'Liga Portugal', type: 'league', season: '2026', round: 'Regular Season - 12', roundLabel: null },
    home: { id: '228', name: 'Sporting CP', logo: null },
    away: { id: '212', name: 'FC Porto', logo: null },
    sportingSide: 'home',
    kickoff: new Date('2026-12-21T20:30:00Z'),
    status: 'LIVE',
    statusRaw: '2H',
    elapsed: 67,
    elapsedExtra: null,
    score: { home: 2, away: 1, halftime: null, extratime: null, penalty: null },
    finishedAt: null,
    ...over,
  }) as Match;
const goal = (minute: number, teamId: string, playerName: string): EventItem =>
  ({ minute, extra: null, teamId, playerId: '1', playerName, assistId: null, assistName: null, type: 'goal', detail: 'Normal Goal', comments: null }) as EventItem;

// O mesmo caso de functions/test/unit/liveActivityProps.test.ts: a app e o servidor têm de dar o mesmo conteúdo.
it('igual ao servidor para o mesmo jogo', () => {
  expect(matchActivityProps(m(), [goal(23, '228', 'L. Suárez'), goal(38, '212', 'Samu'), goal(54, '228', 'Trincão')], NOW, '/grp/w')).toEqual({
    matchId: 'g1',
    competition: 'LIGA PORTUGAL',
    round: 'JORNADA 12',
    homeName: 'SPORTING',
    awayName: 'FC PORTO',
    homeCrest: '/grp/w/crest_228.png',
    awayCrest: '/grp/w/crest_212.png',
    homeScore: 2,
    awayScore: 1,
    phase: '2.ª PARTE',
    clockFrom: NOW.getTime() - 67 * 60_000,
    minute: "67'",
    lastGoal: "Trincão 54'",
  });
});

it('intervalo: sem relógio', () => {
  expect(matchActivityProps(m({ status: 'HT', statusRaw: 'HT' } as Partial<Match>), [], NOW, null)).toMatchObject({ phase: 'INTERVALO', clockFrom: null, homeCrest: null });
});

it('nome do ficheiro do emblema', () => expect(CREST_FILE('228')).toBe('crest_228.png'));
