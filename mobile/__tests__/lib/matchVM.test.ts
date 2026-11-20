import type { Competition, EventItem, FixtureItem, Match } from '@/data/schemas';
import {
  competitionText,
  fixtureToMatch,
  goalsFromEvents,
  groupEvents,
  isShownEvent,
  liveFeed,
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

  it('passa o canal de TV do jogo; ausente, null ou vazio ficam sem canal', () => {
    expect(toGameHeaderVM(match({ tv: 'SPORT TV' })).tv).toBe('SPORT TV');
    expect(toGameHeaderVM(match({ tv: null })).tv).toBeNull();
    expect(toGameHeaderVM(match()).tv).toBeNull();
  });

  it('crest ids: Sporting side is always 228; opponent id only in football', () => {
    const away = toGameHeaderVM(match({ sportingSide: 'away', home: { id: '217', name: 'SC Braga', logo: 'b' }, away: { id: '228', name: 'Sporting CP', logo: 's' } }));
    expect(away.home.id).toBe(217);
    expect(away.away.id).toBe(228);

    const futsal = toGameHeaderVM(
      match({
        sport: 'futsal',
        sportingSide: 'home',
        home: { id: '5001', name: 'Sporting CP', logo: 's' },
        away: { id: '228', name: 'Benfica', logo: 'https://example.com/benfica.png' },
      }),
    );
    expect(futsal.home.id).toBe(228);
    expect(futsal.away).toEqual({ id: null, name: 'Benfica', crestUrl: 'https://example.com/benfica.png' });

    const hockey = toGameHeaderVM(
      match({ sport: 'roller_hockey', sportingSide: 'away', away: { id: '777', name: 'Sporting CP', logo: null } }),
    );
    expect(hockey.away.id).toBe(228);
    expect(hockey.home.id).toBeNull();
  });

  it('other sports carry the venue name and city', () => {
    expect(toGameHeaderVM(match({ sport: 'futsal' })).venue).toBe('Estádio José Alvalade, Lisboa');
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
    expect(vm).toMatchObject({ kind: 'sub', primary: 'Giroud O.', secondary: 'sai Gyökeres V.', minute: '60’', side: 'sporting' });
  });

  it('cards', () => {
    expect(toEventVM(shown({ type: 'card', detail: 'Yellow Card' }), '228').kind).toBe('yellow');
    expect(toEventVM(shown({ type: 'card', detail: 'Red Card' }), '228').kind).toBe('red');
    expect(toEventVM(shown({ type: 'card', detail: 'Second Yellow card' }), '228').kind).toBe('red');
  });

  it('goals: own goal and penalty secondary text, away side', () => {
    const own = toEventVM(shown({ detail: 'Own Goal', playerName: 'X', teamId: '217' }), '228');
    expect(own).toMatchObject({ kind: 'goal', primary: 'X', secondary: 'Autogolo', side: 'sporting' });
    expect(toEventVM(shown({ detail: 'Penalty', playerName: 'Y' }), '228').secondary).toBe('Penálti');
    expect(toEventVM(shown({ detail: 'Normal Goal', playerName: 'Z' }), '228').secondary).toBeUndefined();
    expect(toEventVM(shown({ detail: 'Missed Penalty', playerName: 'W' }), '228').secondary).toBe('Penálti falhado');
  });

  it('missed penalty is its own kind, not a goal', () => {
    expect(toEventVM(shown({ detail: 'Missed Penalty', playerName: 'W' }), '228')).toMatchObject({
      kind: 'missedPenalty',
      primary: 'W',
    });
  });

  it('side: Sporting events on the sporting column, opponent on the other, also when Sporting is away', () => {
    expect(toEventVM(shown({ type: 'card', detail: 'Yellow Card', teamId: '228' }), '228').side).toBe('sporting');
    expect(toEventVM(shown({ type: 'card', detail: 'Yellow Card', teamId: '217' }), '228').side).toBe('opponent');
    expect(toEventVM(shown({ type: 'card', detail: 'Yellow Card', teamId: '228' }), '217', 'away').side).toBe('sporting');
    expect(toEventVM(shown({ type: 'card', detail: 'Yellow Card', teamId: '217' }), '217', 'away').side).toBe('opponent');
  });

  it('side: an own goal sits on the column of the team that scored', () => {
    // golo na própria baliza de um jogador do Sporting: conta para o adversário
    expect(toEventVM(shown({ detail: 'Own Goal', teamId: '228' }), '228').side).toBe('opponent');
    // golo na própria baliza de um jogador do adversário: conta para o Sporting
    expect(toEventVM(shown({ detail: 'Own Goal', teamId: '217' }), '228').side).toBe('sporting');
    expect(toEventVM(shown({ detail: 'Own Goal', teamId: '217' }), '217', 'away').side).toBe('sporting');
    expect(toEventVM(shown({ detail: 'Own Goal', teamId: '228' }), '217', 'away').side).toBe('opponent');
  });

  it('side: a missed penalty stays on the team that missed', () => {
    expect(toEventVM(shown({ detail: 'Missed Penalty', teamId: '217' }), '228').side).toBe('opponent');
  });

  it('goal with an assist and no detail: "assist. X"', () => {
    expect(toEventVM(shown({ detail: 'Normal Goal', playerName: 'Trincão', assistName: 'Morita' }), '228')).toMatchObject({
      kind: 'goal',
      primary: 'Trincão',
      secondary: 'assist. Morita',
    });
  });

  it('var: a disallowed goal is a var event (never kind goal), with its own text', () => {
    const vm = toEventVM(shown({ type: 'var', detail: 'Goal Disallowed - offside', playerName: 'Samu', teamId: '217' }), '228');
    expect(vm).toMatchObject({ kind: 'var', primary: 'Golo anulado', secondary: 'fora de jogo de Samu', side: 'opponent' });
    expect(toEventVM(shown({ type: 'var', detail: 'Goal cancelled', playerName: 'Samu' }), '228')).toMatchObject({
      kind: 'var',
      primary: 'Golo anulado',
      secondary: 'Samu',
    });
    expect(toEventVM(shown({ type: 'var', detail: 'Penalty confirmed', playerName: 'Y' }), '228')).toMatchObject({
      kind: 'var',
      primary: 'Penálti confirmado',
      secondary: 'Y',
    });
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

  it('an own goal counts for the other team (API-Football: event team is the scorer\'s)', () => {
    const groups = groupEvents(
      [ev({ minute: 10, teamId: '217', detail: 'Own Goal' }), ev({ minute: 30, teamId: '228', detail: 'Own Goal' })],
      '228',
    );
    expect(groups.map((g) => g.score)).toEqual(['1-1']);
    const one = groupEvents([ev({ minute: 10, teamId: '217', detail: 'Own Goal' })], '228');
    expect(one[0]?.score).toBe('1-0');
  });

  it('keeps the match order (oldest first inside each part) and passes the Sporting side through', () => {
    const groups = groupEvents(
      [ev({ minute: 70, teamId: '228', playerName: 'late' }), ev({ minute: 12, teamId: '217', playerName: 'early' })],
      '217',
      'away',
    );
    expect(groups.flatMap((g) => g.events.map((e) => `${e.primary}:${e.side}`))).toEqual(['early:opponent', 'late:sporting']);
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
    expect(groups[2]?.events[0]?.kind).toBe('missedPenalty');
  });

  it('a missed penalty in regulation time does not change the part score', () => {
    const groups = groupEvents(
      [ev({ minute: 30, teamId: '228', detail: 'Missed Penalty' }), ev({ minute: 60, teamId: '217', detail: 'Missed Penalty' })],
      '228',
    );
    expect(groups.map(({ label, score }) => ({ label, score }))).toEqual([
      { label: '1ª Parte', score: '0-0' },
      { label: '2ª Parte', score: '0-0' },
    ]);
  });
});

describe('fixtureToMatch (preflight F9)', () => {
  const cup: Competition & { key: string; season: string } = {
    sport: 'football',
    leagueId: '96',
    name: 'Taça de Portugal',
    type: 'cup',
    logo: null,
    key: 'football_96_2026',
    season: '2026',
  };
  const item = (over: Partial<FixtureItem> = {}): FixtureItem => ({
    id: '3001',
    kickoff: KICKOFF,
    round: 'Round of 32',
    roundLabel: null,
    home: { id: '762', name: 'Gil Vicente', logo: null },
    away: { id: '228', name: 'Sporting CP', logo: null },
    status: 'PEN',
    score: { home: 1, away: 1, extraHome: 0, extraAway: 0, penaltyHome: 3, penaltyAway: 4 },
    ...over,
  });

  it('mapeia o FixtureItem para um Match (competição, resultado, penáltis, prolongamento)', () => {
    const m = fixtureToMatch(item(), cup);
    expect(m).toMatchObject({
      id: '3001',
      sport: 'football',
      competition: { key: 'football_96_2026', id: '96', name: 'Taça de Portugal', type: 'cup', season: '2026', round: 'Round of 32', roundLabel: null },
      sportingSide: 'away',
      status: 'PEN',
      elapsed: null,
      elapsedExtra: null,
      finishedAt: null,
      venue: null,
      referee: null,
      source: { provider: 'api-football', id: '3001', attribution: null },
    });
    expect(m.score).toEqual({ home: 1, away: 1, halftime: null, extratime: { home: 0, away: 0 }, penalty: { home: 3, away: 4 } });
    expect(scoreText(m)).toBe('1-1 (3-4 g.p.)');
    expect(competitionText(m.competition).round).toBe('16 avos de final');
  });

  it('sem penáltis nem prolongamento ficam a null; jogo sem o Sporting fica "home" por omissão', () => {
    const m = fixtureToMatch(
      item({
        home: { id: '212', name: 'FC Porto', logo: null },
        away: { id: '211', name: 'SL Benfica', logo: null },
        status: 'NS',
        score: { home: null, away: null, extraHome: null, extraAway: null, penaltyHome: null, penaltyAway: null },
      }),
      cup,
    );
    expect(m.sportingSide).toBe('home');
    expect(m.score.penalty).toBeNull();
    expect(m.score.extratime).toBeNull();
    // O adversário usa o seu id (o lado "home" não é o Sporting só por omissão: o id não é 228).
    expect(toGameHeaderVM(m).home.id).toBe(212);
    expect(toGameHeaderVM(m).away.id).toBe(211);
  });
});

describe('goalsFromEvents', () => {
  const ev = (over: Partial<EventItem>): EventItem =>
    ({ minute: 10, extra: null, teamId: '228', playerId: null, playerName: 'Gyökeres', assistId: null, assistName: null, type: 'goal', detail: 'Normal Goal', comments: null, ...over }) as EventItem;

  it('golos por ordem do jogo, com o lado e o texto "Nome minuto"', () => {
    const goals = goalsFromEvents(
      [ev({ minute: 54, playerName: 'Trincão' }), ev({ minute: 38, teamId: '212', playerName: 'Samu' }), ev({ minute: 23, extra: 2, playerName: 'L. Suárez' })],
      '228',
    );
    expect(goals.map((g) => [g.side, g.text])).toEqual([
      ['home', 'L. Suárez 23+2’'],
      ['away', 'Samu 38’'],
      ['home', 'Trincão 54’'],
    ]);
  });

  it('autogolo conta para a equipa contrária; penálti falhado, cartões e desempate ficam de fora', () => {
    const goals = goalsFromEvents(
      [
        ev({ minute: 5, teamId: '212', detail: 'Own Goal', playerName: 'Defesa' }),
        ev({ minute: 20, detail: 'Missed Penalty' }),
        ev({ minute: 30, type: 'card', detail: 'Yellow Card' }),
        ev({ minute: 120, comments: 'Penalty Shootout' }),
      ],
      '228',
    );
    expect(goals).toHaveLength(1);
    expect(goals[0]!.side).toBe('home');
  });
});

describe('liveFeed (Sumário ao vivo, Figma 06)', () => {
  const item = (over: Partial<EventItem>): EventItem => ({
    minute: 10,
    extra: null,
    teamId: '228',
    playerId: null,
    playerName: 'X',
    assistId: null,
    assistName: null,
    type: 'goal',
    detail: 'Normal Goal',
    comments: null,
    ...over,
  });
  const feed = (items: EventItem[]) => liveFeed(items, '228', 'home');

  it('por ordem cronológica (20/11), com o minuto e a coluna', () => {
    const f = feed([item({ minute: 23 }), item({ minute: 54, teamId: '217' }), item({ minute: 54, extra: null, type: 'card', detail: 'Yellow Card' })]);
    expect(f.map((e) => e.minute)).toEqual(['23’', '54’', '54’']);
    expect(f[1]).toMatchObject({ kind: 'goal', side: 'opponent' });
    expect(f[2]).toMatchObject({ kind: 'yellow', side: 'sporting' });
  });

  it('golo: "Assistência de {nome}" só com assistência; penálti e autogolo têm a sua linha', () => {
    expect(feed([item({ assistName: 'Pedro Gonçalves' })])[0]!.line).toBe('Assistência de Pedro Gonçalves');
    expect(feed([item({ detail: 'Penalty' })])[0]!.line).toBe('De penálti');
    expect(feed([item({ detail: 'Own Goal', teamId: '217' })])[0]).toMatchObject({ line: 'Autogolo', side: 'sporting' });
    expect(feed([item({})])[0]).not.toHaveProperty('line');
  });

  it('substituição: "Entra {quem entra}, sai {quem sai}", e só o que os dados têm', () => {
    expect(feed([item({ type: 'subst', playerName: 'Gyökeres', assistName: 'Giroud' })])[0]!.line).toBe('Entra Giroud, sai Gyökeres');
    expect(feed([item({ type: 'subst', playerName: null, assistName: 'Giroud' })])[0]!.line).toBe('Entra Giroud');
    expect(feed([item({ type: 'subst', playerName: 'Gyökeres', assistName: null })])[0]!.line).toBe('Sai Gyökeres');
    expect(feed([item({ type: 'subst', playerName: null, assistName: null })])[0]).not.toHaveProperty('line');
  });

  it('cartões e penálti falhado não inventam segunda linha; VAR dá a decisão', () => {
    expect(feed([item({ type: 'card', detail: 'Red Card' })])[0]).not.toHaveProperty('line');
    expect(feed([item({ detail: 'Missed Penalty' })])[0]).not.toHaveProperty('line');
    expect(feed([item({ type: 'var', detail: 'Goal Disallowed - offside' })])[0]!.line).toBe('Golo anulado');
  });
});

describe('liveFeed: chaves estáveis', () => {
  const it0 = (over: Partial<EventItem>): EventItem => ({
    minute: 10, extra: null, teamId: '228', playerId: null, playerName: 'A', assistId: null, assistName: null,
    type: 'card', detail: 'Yellow Card', comments: null, ...over,
  });
  it('um lance novo no topo não muda a chave dos outros; repetidos ganham sufixo', () => {
    const a = liveFeed([it0({}), it0({})], '228');
    const b = liveFeed([it0({}), it0({}), it0({ minute: 20 })], '228');
    expect(new Set(a.map((e) => e.key)).size).toBe(2);
    expect(b.map((e) => e.key)).toEqual(expect.arrayContaining(a.map((e) => e.key)));
  });
});
