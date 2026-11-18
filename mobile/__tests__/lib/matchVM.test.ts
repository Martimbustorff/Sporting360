import type { EventItem, Match } from '@/data/schemas';
import {
  competitionText,
  groupEvents,
  isShownEvent,
  minuteText,
  penaltiesText,
  scoreText,
  type ShownEvent,
  toEventVM,
  toGameHeaderVM,
  uiState,
} from '@/lib/matchVM';

const KICKOFF = new Date('2026-09-14T19:30:00Z');

function match(over: Partial<Match> = {}): Match {
  return {
    id: 'm1',
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
    home: { id: '228', name: 'Sporting CP', logo: 'https://example.com/228.png' },
    away: { id: '217', name: 'SC Braga', logo: 'https://example.com/217.png' },
    sportingSide: 'home',
    kickoff: KICKOFF,
    status: 'NS',
    elapsed: null,
    elapsedExtra: null,
    score: { home: null, away: null, halftime: null, extratime: null, penalty: null },
    finishedAt: null,
    venue: { id: '1', name: 'Estádio José Alvalade', city: 'Lisboa', capacity: 50000, image: null },
    referee: null,
    source: { provider: 'api-football', id: '1', attribution: null },
    ...over,
  } as Match;
}

function ev(over: Partial<EventItem>): EventItem {
  return {
    minute: 10,
    extra: null,
    teamId: '228',
    playerId: null,
    playerName: null,
    assistId: null,
    assistName: null,
    type: 'goal',
    detail: 'Normal Goal',
    comments: null,
    ...over,
  } as EventItem;
}

/** A shown event (not `other`), as toEventVM takes after isShownEvent. */
const shown = (over: Partial<EventItem>) => ev(over) as ShownEvent;

const comp = (round: string | null, roundLabel: string | null = null) =>
  ({ ...match().competition, round, roundLabel }) as Match['competition'];

describe('competitionText', () => {
  it('translates the raw round', () => {
    expect(competitionText(comp('Round of 32'))).toEqual({ name: 'Liga Portugal', round: '16 avos de final' });
  });

  it('prefers roundLabel', () => {
    expect(competitionText(comp('Round of 16', 'Oitavos de final')).round).toBe('Oitavos de final');
  });

  it('unknown round shows the original text', () => {
    expect(competitionText(comp('Weird Stage')).round).toBe('Weird Stage');
  });

  it('a bad J-prefixed label falls back to the raw round', () => {
    expect(competitionText(comp('Round of 32', 'JRound of 32')).round).toBe('Round of 32');
  });

  it('null round gives empty text', () => {
    expect(competitionText(comp(null)).round).toBe('');
  });

  it.each([
    'Regular Season - 11',
    'J11',
    '11',
    'League Stage - 3',
    'League Phase - 3',
    'Group Stage - 2',
    'Group A - 2',
    'Round of 32',
    'Round of 16',
    '8th Finals',
    'Quarter-finals',
    'Semi-finals',
    'Final',
    '1st Round',
    '2nd Round',
    '3rd Round',
    '4th Round',
    'Play-offs',
    'Knockout Round Play-offs',
    'Qualifying Round',
    'Algo desconhecido',
  ])('%s never gives J followed by a non-digit', (round) => {
    expect(competitionText(comp(round)).round).not.toMatch(/^J[^\d]/);
  });
});

describe('uiState', () => {
  it.each([
    ['NS', 'scheduled'],
    ['LIVE', 'live'],
    ['HT', 'halftime'],
    ['FT', 'finished'],
    ['AET', 'finished'],
    ['PEN', 'finished'],
    ['PST', 'postponed'],
    ['CANC', 'cancelled'],
  ] as const)('%s -> %s', (status, state) => {
    expect(uiState(status)).toBe(state);
  });
});

describe('minuteText', () => {
  it('formats minute and stoppage time', () => {
    expect(minuteText(23, null)).toBe('23’');
    expect(minuteText(45, 2)).toBe('45+2’');
    expect(minuteText(90, 0)).toBe('90’');
    expect(minuteText(null, null)).toBe('');
    expect(minuteText(null, 3)).toBe('');
  });
});

describe('scoreText and penaltiesText', () => {
  it('no score for scheduled, postponed or cancelled', () => {
    expect(scoreText(match())).toBeNull();
    expect(scoreText(match({ status: 'PST', score: { ...match().score, home: 0, away: 0 } }))).toBeNull();
    expect(scoreText(match({ status: 'CANC', score: { ...match().score, home: 0, away: 0 } }))).toBeNull();
  });

  it('live and finished show the score', () => {
    expect(scoreText(match({ status: 'LIVE', score: { ...match().score, home: 2, away: 0 } }))).toBe('2-0');
    expect(scoreText(match({ status: 'HT', score: { ...match().score, home: 1, away: 1 } }))).toBe('1-1');
  });

  it('penalties', () => {
    const m = match({ status: 'PEN', score: { ...match().score, home: 1, away: 1, penalty: { home: 4, away: 3 } } });
    expect(scoreText(m)).toBe('1-1 (4-3 g.p.)');
    expect(penaltiesText(4, 3)).toBe('4-3 g.p.');
  });

  it('missing numbers give null', () => {
    expect(scoreText(match({ status: 'LIVE' }))).toBeNull();
  });
});

describe('toGameHeaderVM', () => {
  it('maps teams, round and state; football has no venue; tv null', () => {
    const vm = toGameHeaderVM(match());
    expect(vm.home).toEqual({ id: 228, name: 'Sporting CP', crestUrl: 'https://example.com/228.png' });
    expect(vm.away.id).toBe(217);
    expect(vm.competitionName).toBe('Liga Portugal');
    expect(vm.round).toBe('J16');
    expect(vm.state).toBe('scheduled');
    expect(vm.kickoff).toBe(KICKOFF);
    expect(vm.score).toBeNull();
    expect(vm.tv).toBeNull();
    expect(vm.venue).toBeNull();
  });

  it('other sports carry the venue name', () => {
    expect(toGameHeaderVM(match({ sport: 'futsal' })).venue).toBe('Estádio José Alvalade');
    expect(toGameHeaderVM(match({ sport: 'futsal', venue: null })).venue).toBeNull();
  });

  it('live: score, minute and stoppage minute text', () => {
    const vm = toGameHeaderVM(
      match({ status: 'LIVE', elapsed: 45, elapsedExtra: 2, score: { ...match().score, home: 1, away: 0 } }),
    );
    expect(vm.state).toBe('live');
    expect(vm.score).toEqual({ home: 1, away: 0 });
    expect(vm.minute).toBe(45);
    expect(vm.minuteText).toBe('45+2’');
  });

  it('postponed has no score even if numbers exist', () => {
    const vm = toGameHeaderVM(match({ status: 'PST', score: { ...match().score, home: 0, away: 0 } }));
    expect(vm.state).toBe('postponed');
    expect(vm.score).toBeNull();
  });
});

describe('toEventVM', () => {
  it('substitution: primary is who comes in (assist), secondary who goes out', () => {
    const vm = toEventVM(
      shown({ type: 'subst', minute: 60, playerName: 'Gyökeres V.', assistName: 'Giroud O.', detail: 'Substitution 1' }),
      '228',
    );
    expect(vm).toMatchObject({ kind: 'sub', primary: 'Giroud O.', secondary: 'Gyökeres V.', minute: '60’', side: 'home' });
  });

  it('cards', () => {
    expect(toEventVM(shown({ type: 'card', detail: 'Yellow Card' }), '228').kind).toBe('yellow');
    expect(toEventVM(shown({ type: 'card', detail: 'Red Card' }), '228').kind).toBe('red');
    expect(toEventVM(shown({ type: 'card', detail: 'Second Yellow card' }), '228').kind).toBe('red');
  });

  it('goals: own goal and penalty secondary text, away side', () => {
    const own = toEventVM(shown({ detail: 'Own Goal', playerName: 'X', teamId: '217' }), '228');
    expect(own).toMatchObject({ kind: 'goal', primary: 'X', secondary: 'Autogolo', side: 'away' });
    expect(toEventVM(shown({ detail: 'Penalty', playerName: 'Y' }), '228').secondary).toBe('Penálti');
    expect(toEventVM(shown({ detail: 'Normal Goal', playerName: 'Z' }), '228').secondary).toBeUndefined();
    expect(toEventVM(shown({ detail: 'Missed Penalty', playerName: 'W' }), '228').secondary).toBe('Penálti falhado');
  });

  it('var and stoppage minute', () => {
    expect(toEventVM(shown({ type: 'var', minute: 90, extra: 3 }), '228')).toMatchObject({ kind: 'var', minute: '90+3’' });
  });

  it('isShownEvent drops "other"', () => {
    expect(isShownEvent(ev({ type: 'other' }))).toBe(false);
    expect(isShownEvent(ev({ type: 'goal' }))).toBe(true);
  });
});

describe('groupEvents', () => {
  it('splits halves with cumulative score', () => {
    const groups = groupEvents(
      [ev({ minute: 70, teamId: '217', playerName: 'B' }), ev({ minute: 12, teamId: '228', playerName: 'A' })],
      '228',
    );
    expect(groups.map(({ label, score }) => ({ label, score }))).toEqual([
      { label: '1ª Parte', score: '1-0' },
      { label: '2ª Parte', score: '1-1' },
    ]);
    expect(groups[0]?.events[0]?.primary).toBe('A');
  });

  it('no events gives []', () => {
    expect(groupEvents([], '228')).toEqual([]);
  });

  it('sorts by minute then extra; 45+2 stays in the first half', () => {
    const groups = groupEvents(
      [
        ev({ type: 'card', detail: 'Yellow Card', minute: 45, extra: 2, playerName: 'late' }),
        ev({ type: 'card', detail: 'Yellow Card', minute: 45, extra: null, playerName: 'on45' }),
        ev({ type: 'card', detail: 'Yellow Card', minute: 30, playerName: 'early' }),
      ],
      '228',
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.events.map((e) => e.primary)).toEqual(['early', 'on45', 'late']);
    expect(groups[0]?.score).toBe('0-0');
  });

  it('extra time and shootout; missed penalties do not count; other events hidden', () => {
    const groups = groupEvents(
      [
        ev({ minute: 20, teamId: '228' }),
        ev({ minute: 80, teamId: '217' }),
        ev({ minute: 100, type: 'other', detail: 'x' }),
        ev({ minute: 105, teamId: '228', detail: 'Missed Penalty' }),
        ev({ minute: 120, teamId: '228', detail: 'Penalty', comments: 'Penalty Shootout' }),
        ev({ minute: 120, teamId: '217', detail: 'Missed Penalty', comments: 'Penalty Shootout' }),
        ev({ minute: 120, teamId: '217', detail: 'Penalty', comments: 'Penalty Shootout' }),
        ev({ minute: 120, teamId: '228', detail: 'Penalty', comments: 'Penalty Shootout' }),
      ],
      '228',
    );
    expect(groups.map(({ label, score }) => ({ label, score }))).toEqual([
      { label: '1ª Parte', score: '1-0' },
      { label: '2ª Parte', score: '1-1' },
      { label: 'Prolongamento', score: '1-1' },
      { label: 'Penáltis', score: '2-1' },
    ]);
    expect(groups[2]?.events).toHaveLength(1);
    expect(groups[3]?.events).toHaveLength(4);
  });
});
