// Firestore-shaped seed data for the emulator (scripts/seed-emulator.mjs) and for tests.
// Plain data, no TS-only runtime syntax, so Node can load it directly. The only import is
// ../lib/periods.ts, written with its extension because Node needs the explicit path
// (tsconfig has allowImportingTsExtensions); that file has no imports of its own.
// View-model fixtures for the gallery (Task 8) live in galleryFixtures.ts, not here.
import { periodKeys } from '../lib/periods.ts';

export { periodKeys };

export const PROJECT_ID = 'scp360-37a74';
export const SPORTING_TEAM_ID = '228';

export const TEST_USER = {
  uid: 'seed-user-1',
  email: 'teste@s360.local',
  password: 'teste1234',
  name: 'Teste Leão',
} as const;

export interface SeedDoc {
  path: string;
  data: Record<string, unknown>;
}

const DAY = 86_400_000;

const BOARD_ENTRIES = [
  { uid: TEST_USER.uid, displayName: TEST_USER.name, points: 12 },
  { uid: 'seed-user-2', displayName: 'Ana Silva', points: 18 },
  { uid: 'seed-user-3', displayName: 'Rui Costa', points: 15 },
  { uid: 'seed-user-4', displayName: `Sportinguista #${'seed-user-4'.slice(-4)}`, points: 9 },
  { uid: 'seed-user-5', displayName: 'Inês Pereira', points: 3 },
  // Fictional names only (store screenshots): same "Nome I." shape as the server rule, never a real user or email.
  { uid: 'seed-user-6', displayName: 'Marta F.', points: 21 },
  { uid: 'seed-user-7', displayName: 'Diogo L.', points: 17 },
  { uid: 'seed-user-8', displayName: 'Sofia R.', points: 14 },
  { uid: 'seed-user-9', displayName: 'Tomás B.', points: 11 },
  { uid: 'seed-user-10', displayName: 'Carolina M.', points: 8 },
] as const;

const NO_PAIR = { home: null, away: null, halftime: null, extratime: null, penalty: null };
const crest = (id: string) => `https://media.api-sports.io/football/teams/${id}.png`;
const VIDEO_BASE = 'https://sporting.vsports.pt/embd/100020/m/19776/scp';

function player(playerId: string, name: string, number: number, position: string, rating: number | null, extra: Record<string, unknown> = {}) {
  return {
    playerId, name, photo: null, number, position, minutes: 82, rating, goals: 0, assists: 0, saves: 0,
    passesAccuracy: 85, tackles: 1, foulsCommitted: 1, cardsYellow: 0, cardsRed: 0, substitute: false, ...extra,
  };
}

/** Game states beyond NS and FT: LIVE minute 82 (MVP window open), HT, PST, CANC, futsal NS, prematch. */
function stateFixtures(now: Date, base: Record<string, unknown>): SeedDoc[] {
  const docs: SeedDoc[] = [];
  const at = (ms: number) => new Date(now.getTime() + ms);
  const live = {
    ...base,
    id: '9002',
    competition: { ...(base.competition as object), round: 'Regular Season - 13', roundLabel: 'J13' },
    home: { id: SPORTING_TEAM_ID, name: 'Sporting CP', logo: crest(SPORTING_TEAM_ID) },
    away: { id: '228000', name: 'SC Braga', logo: crest('217') },
    kickoff: at(-82 * 60_000),
    status: 'LIVE',
    statusRaw: '2H',
    elapsed: 82,
    score: { ...NO_PAIR, home: 2, away: 1, halftime: { home: 1, away: 0 } },
    source: { provider: 'api-football', id: '9002' },
  };
  docs.push({ path: 'matches/9002', data: live });
  docs.push({
    path: 'matches/9002/details/players',
    data: {
      teams: [
        {
          teamId: SPORTING_TEAM_ID,
          players: [
            player('1001', 'Jogador Um', 9, 'F', 8.1, { goals: 1 }),
            player('1002', 'Jogador Dois', 8, 'M', 7.4, { goals: 1, assists: 1 }),
            player('1003', 'Jogador Três', 4, 'D', 6.9, { cardsYellow: 1 }),
            player('1004', 'Jogador Quatro', 1, 'G', 7.0, { saves: 3 }),
          ],
        },
      ],
    },
  });
  // MVP tallies of the LIVE game (votes of other fans; the aggregator also writes `updatedAt`).
  docs.push({
    path: 'mvpTallies/9002',
    data: { gameId: '9002', counts: { '1001': 5, '1002': 3, '1003': 1, '1004': 1 }, total: 10, updatedAt: now },
  });
  docs.push({
    path: 'matches/9002/details/events',
    data: {
      items: [
        { minute: 12, extra: null, teamId: SPORTING_TEAM_ID, playerId: '1001', playerName: 'Jogador Um', assistId: '1002', assistName: 'Jogador Dois', type: 'goal', detail: 'Normal Goal', comments: null },
        { minute: 55, extra: null, teamId: '228000', playerId: '2001', playerName: 'Avançado Braga', assistId: null, assistName: null, type: 'goal', detail: 'Normal Goal', comments: null },
        { minute: 70, extra: null, teamId: SPORTING_TEAM_ID, playerId: '1002', playerName: 'Jogador Dois', assistId: null, assistName: null, type: 'goal', detail: 'Normal Goal', comments: null },
      ],
    },
  });
  docs.push({
    path: 'matches/9002/details/lineups',
    data: {
      teams: [
        {
          teamId: SPORTING_TEAM_ID,
          formation: '4-2-3-1',
          coach: { id: '5001', name: 'Treinador Sporting', photo: null },
          startXI: [
            { playerId: '1004', name: 'Jogador Quatro', number: 1, pos: 'G', grid: '1:1' },
            { playerId: '1003', name: 'Jogador Três', number: 4, pos: 'D', grid: '2:1' },
            { playerId: '1002', name: 'Jogador Dois', number: 8, pos: 'M', grid: '3:1' },
            { playerId: '1001', name: 'Jogador Um', number: 9, pos: 'F', grid: '5:1' },
          ],
          substitutes: [{ playerId: '1005', name: 'Suplente Cinco', number: 20, pos: 'M', grid: null }],
        },
        {
          teamId: '228000',
          formation: '4-3-3',
          coach: null,
          startXI: [{ playerId: '2001', name: 'Avançado Braga', number: 9, pos: 'F', grid: '5:1' }],
          substitutes: [],
        },
      ],
    },
  });
  docs.push({
    path: 'matches/9002/details/statistics',
    data: {
      teams: [
        { teamId: SPORTING_TEAM_ID, items: { 'Ball Possession': '58%', 'Total Shots': 14, 'Corner Kicks': 6 } },
        { teamId: '228000', items: { 'Ball Possession': '42%', 'Total Shots': 7, 'Corner Kicks': 2 } },
      ],
      xg: { home: 1.8, away: 0.9 },
    },
  });

  docs.push({
    path: 'matches/9003',
    data: {
      ...live,
      id: '9003',
      competition: { ...live.competition, round: 'Regular Season - 14', roundLabel: 'J14' },
      home: { id: '214', name: 'Vitória SC', logo: crest('214') },
      away: { id: SPORTING_TEAM_ID, name: 'Sporting CP', logo: crest(SPORTING_TEAM_ID) },
      sportingSide: 'away',
      kickoff: at(-50 * 60_000),
      status: 'HT',
      statusRaw: 'HT',
      elapsed: 45,
      score: { ...NO_PAIR, home: 0, away: 1, halftime: { home: 0, away: 1 } },
      source: { provider: 'api-football', id: '9003' },
    },
  });
  docs.push({
    path: 'matches/9004',
    data: {
      ...live,
      id: '9004',
      competition: { ...live.competition, round: 'Regular Season - 15', roundLabel: 'J15' },
      kickoff: at(6 * DAY),
      status: 'PST',
      statusRaw: 'PST',
      elapsed: null,
      score: NO_PAIR,
      source: { provider: 'api-football', id: '9004' },
    },
  });
  docs.push({
    path: 'matches/9005',
    data: {
      ...live,
      id: '9005',
      competition: { ...live.competition, round: 'Regular Season - 10', roundLabel: 'J10' },
      kickoff: at(-12 * DAY),
      status: 'CANC',
      statusRaw: 'CANC',
      elapsed: null,
      score: NO_PAIR,
      source: { provider: 'api-football', id: '9005' },
    },
  });

  // Prematch of the upcoming football game; no lineups yet.
  docs.push({
    path: 'matches/9001/details/prematch',
    data: {
      fetchedAt: now,
      advice: 'Combinação dupla: Sporting CP ou empate',
      winner: { id: SPORTING_TEAM_ID, name: 'Sporting CP', comment: 'Vitória ou empate' },
      percent: { home: 55, draw: 25, away: 20 },
      form: { home: 'WWDWW', away: 'WLWDL' },
      last5: {
        home: { played: 5, form: 'WWDWW', att: '82%', def: '34%', goalsFor: 11, goalsAgainst: 3 },
        away: { played: 5, form: 'WLWDL', att: '61%', def: '58%', goalsFor: 7, goalsAgainst: 6 },
      },
      h2h: [
        { id: '8800', kickoff: new Date(now.getTime() - 200 * DAY), home: { id: '211', name: 'Benfica', logo: null }, away: { id: SPORTING_TEAM_ID, name: 'Sporting CP', logo: null }, score: { home: 1, away: 2 } },
      ],
    },
  });

  // Futsal: Sporting game with the provider attribution the screen must show.
  docs.push({
    path: 'matches/9101',
    data: {
      ...base,
      id: '9101',
      sport: 'futsal',
      competition: { key: 'futsal_1_2026', id: '1', name: 'Liga Placard Futsal', type: 'league', season: '2026', round: 'Jornada 8', roundLabel: 'J8' },
      home: { id: 'f-sporting', name: 'Sporting CP', logo: null },
      away: { id: 'f-benfica', name: 'SL Benfica', logo: null },
      sportingSide: 'home',
      kickoff: at(3 * DAY),
      status: 'NS',
      statusRaw: 'NS',
      score: NO_PAIR,
      venue: { id: null, name: 'Pavilhão João Rocha', city: 'Lisboa' },
      source: { provider: 'sporting-pt', id: '9101', attribution: 'Fonte: sporting.pt' },
    },
  });
  return docs;
}

function standingRow(rank: number, teamId: string, name: string, points: number, played: number, form: string, description: string | null = null) {
  const win = Math.floor(points / 3);
  return {
    rank, teamId, name, logo: crest(teamId), points, played, win, draw: points - win * 3, lose: played - win - (points - win * 3),
    goalsFor: win * 2 + 3, goalsAgainst: played, goalsDiff: win * 2 + 3 - played, form, description,
  };
}

function tie(id: string, stage: string, home: [string, string], away: [string, string], legs: { matchId: string; homeId: string; kickoff: string; status: string; home: number | null; away: number | null }[], winnerTeamId: string | null, sportingInvolved: boolean) {
  const done = legs.every((l) => l.home !== null);
  return {
    id, stage,
    home: { id: home[0], name: home[1], logo: crest(home[0]) },
    away: { id: away[0], name: away[1], logo: crest(away[0]) },
    legs: legs.map((l) => ({ matchId: l.matchId, homeId: l.homeId, kickoff: l.kickoff, status: l.status, score: { home: l.home, away: l.away, penaltyHome: null, penaltyAway: null } })),
    aggregate: done ? { home: legs.reduce((a, l) => a + (l.homeId === home[0] ? l.home! : l.away!), 0), away: legs.reduce((a, l) => a + (l.homeId === away[0] ? l.home! : l.away!), 0) } : null,
    winnerTeamId, sportingInvolved,
  };
}

/** Liga (table), Taça de Portugal (bracket), Liga dos Campeões (both, primary bracket). */
function competitionFixtures(now: Date): SeedDoc[] {
  const docs: SeedDoc[] = [];
  const iso = (d: number) => new Date(now.getTime() + d * DAY).toISOString();
  const liga = 'football_94_2026';
  const taca = 'football_96_2026';
  const ucl = 'football_2_2026';
  docs.push({ path: `competitions/${liga}`, data: { sport: 'football', leagueId: '94', name: 'Liga Portugal', type: 'league', logo: null, view: { primary: 'table', hasTable: true, hasBracket: false, currentStage: null } } });
  docs.push({ path: `competitions/${taca}`, data: { sport: 'football', leagueId: '96', name: 'Taça de Portugal', type: 'cup', logo: null, view: { primary: 'bracket', hasTable: false, hasBracket: true, currentStage: 'Quartos de final' } } });
  docs.push({ path: `competitions/${ucl}`, data: { sport: 'football', leagueId: '2', name: 'Liga dos Campeões', type: 'europe', logo: null, view: { primary: 'bracket', hasTable: true, hasBracket: true, currentStage: 'Oitavos de final' } } });

  const ligaRows = [
    standingRow(1, SPORTING_TEAM_ID, 'Sporting CP', 31, 12, 'WWWDW', 'Champions League'),
    standingRow(2, '212', 'FC Porto', 28, 12, 'WWLWW', 'Champions League'),
    standingRow(3, '211', 'Benfica', 26, 12, 'WDWWL', 'Europa League'),
    standingRow(4, '217', 'SC Braga', 22, 12, 'LWWDW', 'Europa League'),
    standingRow(5, '214', 'Vitória SC', 19, 12, 'DLWDW'),
    standingRow(6, '9100', 'Sporting Clube de Portugal B (nome longo para provar o corte)', 7, 12, 'LLDLL', 'Relegation'),
  ];
  docs.push({ path: `competitions/${liga}/data/standings`, data: { groups: [{ name: 'Liga Portugal', rows: ligaRows }] } });
  docs.push({ path: `competitions/${liga}/data/rounds`, data: { items: [{ raw: 'Regular Season - 12', label: 'J12' }, { raw: 'Regular Season - 13', label: 'J13' }], current: 'Regular Season - 12' } });
  docs.push({ path: `competitions/${liga}/data/fixtures`, data: { items: [] } });

  const L = (matchId: string, homeId: string, d: number, status: string, h: number | null, a: number | null) => ({ matchId, homeId, kickoff: iso(d), status, home: h, away: a });
  docs.push({
    path: `competitions/${taca}/data/bracket`,
    data: {
      stages: [
        { label: 'Oitavos de final', raw: 'Round of 16', ties: [tie('t1', 'Round of 16', [SPORTING_TEAM_ID, 'Sporting CP'], ['9200', 'Equipa da III Divisão'], [L('9300', SPORTING_TEAM_ID, -20, 'FT', 3, 0)], SPORTING_TEAM_ID, true), tie('t2', 'Round of 16', ['212', 'FC Porto'], ['211', 'Benfica'], [L('9301', '212', -20, 'FT', 1, 1)], null, false)] },
        { label: 'Quartos de final', raw: 'Quarter-finals', ties: [tie('t3', 'Quarter-finals', [SPORTING_TEAM_ID, 'Sporting CP'], ['217', 'SC Braga'], [L('9302', SPORTING_TEAM_ID, 20, 'NS', null, null)], null, true)] },
      ],
    },
  });
  docs.push({ path: `competitions/${taca}/data/rounds`, data: { items: [{ raw: 'Round of 16', label: 'Oitavos' }], current: 'Quarter-finals' } });

  docs.push({
    path: `competitions/${ucl}/data/standings`,
    data: { groups: [{ name: 'Fase de liga', rows: [standingRow(1, '40', 'Liverpool', 21, 8, 'WWWWW', 'Round of 16'), standingRow(2, SPORTING_TEAM_ID, 'Sporting CP', 17, 8, 'WWDWL', 'Round of 16')] }] },
  });
  docs.push({
    path: `competitions/${ucl}/data/bracket`,
    data: {
      stages: [
        { label: 'Oitavos de final', raw: 'Round of 16', ties: [tie('u1', 'Round of 16', [SPORTING_TEAM_ID, 'Sporting CP'], ['40', 'Liverpool'], [L('9400', SPORTING_TEAM_ID, 25, 'NS', null, null), L('9401', '40', 32, 'NS', null, null)], null, true)] },
      ],
    },
  });
  docs.push({ path: `competitions/${ucl}/data/rounds`, data: { items: [], current: null } });
  for (const key of [liga, taca, ucl]) {
    docs.push({ path: `competitions/${key}/data/topscorers`, data: { items: [{ playerId: '1001', name: 'Jogador Um', photo: null, teamId: SPORTING_TEAM_ID, teamName: 'Sporting CP', teamLogo: crest(SPORTING_TEAM_ID), value: 9 }] } });
  }
  docs.push({ path: 'venues/1', data: { name: 'Estádio José Alvalade', city: 'Lisboa', address: 'Rua Professor Fernando da Fonseca', capacity: 50095, surface: 'grass', image: null } });
  return docs;
}

/** teams/football_228/data/*: squad, coach, injuries, transfers, trophies, sidelined, stats. */
function teamFixtures(): SeedDoc[] {
  const base = 'teams/football_228/data';
  return [
    { path: `${base}/squad`, data: { players: [
      { id: '1001', name: 'Jogador Um', age: 27, number: 9, position: 'Attacker', photo: null },
      { id: '1002', name: 'Jogador Dois', age: 25, number: 8, position: 'Midfielder', photo: null },
      { id: '1003', name: 'Jogador Três', age: 29, number: 4, position: 'Defender', photo: null },
      { id: '1004', name: 'Jogador Quatro', age: 31, number: 1, position: 'Goalkeeper', photo: null },
    ] } },
    { path: `${base}/coach`, data: { id: '5001', name: 'Treinador Sporting', age: 50, nationality: 'Portugal', photo: null, since: '2025-06-01' } },
    { path: `${base}/injuries`, data: { items: [{ playerId: '1003', name: 'Jogador Três', photo: null, type: 'Missing Fixture', reason: 'Knee Injury', fixtureId: null, date: '2026-11-10' }] } },
    { path: `${base}/transfers`, data: { items: [{ playerId: '1005', name: 'Suplente Cinco', date: '2026-07-01', type: 'Free', direction: 'in', in: { id: SPORTING_TEAM_ID, name: 'Sporting CP', logo: null }, out: { id: '300', name: 'Outro Clube', logo: null } }] } },
    { path: `${base}/trophies`, data: { byPlayer: { '1001': [{ league: 'Liga Portugal', country: 'Portugal', season: '2024/2025', place: 'Winner' }] }, coach: [{ league: 'Liga Portugal', country: 'Portugal', season: '2024/2025', place: 'Winner' }] } },
    { path: `${base}/sidelined`, data: { byPlayer: { '1003': [{ type: 'Knee Injury', start: '2026-11-10', end: null }] } } },
    { path: `${base}/playerStats_2026`, data: { players: [
      { id: '1001', name: 'Jogador Um', photo: null, appearances: 12, minutes: 980, goals: 9, assists: 2, rating: 7.6, yellow: 1, red: 0 },
      { id: '1002', name: 'Jogador Dois', photo: null, appearances: 12, minutes: 1010, goals: 3, assists: 7, rating: 7.4, yellow: 2, red: 0 },
    ] } },
    { path: `${base}/teamStats_94_2026`, data: {
      form: 'WWWDW',
      goals: { for: { total: { home: 20, away: 14, total: 34 }, minute: { '0-15': { total: 4, percentage: '11.76%' } } }, against: { total: { home: 3, away: 5, total: 8 }, minute: { '0-15': { total: 1, percentage: '12.50%' } } } },
      fixtures: { played: { home: 6, away: 6, total: 12 }, wins: { home: 6, away: 4, total: 10 } },
      cleanSheet: { home: 4, away: 3, total: 7 },
      failedToScore: { home: 0, away: 1, total: 1 },
    } },
  ];
}

/** News of three sports and the videos of the finished game (real VSports embed shape). */
function contentFixtures(now: Date): SeedDoc[] {
  const docs: SeedDoc[] = [];
  const news: [string, string, string][] = [
    ['n1', 'football', 'Sporting vence no Dragão e isola-se na liderança'],
    ['n2', 'basketball', 'Basquetebol: vitória clara na Luz'],
    ['n3', 'futsal', 'Futsal: Sporting prepara o dérbi'],
  ];
  news.forEach(([id, sport, title], i) => {
    docs.push({
      path: `news/${id}`,
      data: { id, title, image: null, summary: `${title}.`, source: 'sporting.pt', url: `https://www.sporting.pt/pt/noticias/${id}`, sport, publishedAt: new Date(now.getTime() - (i + 1) * 3_600_000), content: 'Corpo do artigo.' },
    });
  });
  const vids: [string, string, string, string | null, string, number][] = [
    ['v1', 'Golo de Jogador Um', 'golo', "12'", '3a1b2c3d4e5f60718293a4b5c6d7e8f9', 100],
    ['v2', 'Golo de Jogador Dois', 'golo', "67'", '4b2c3d4e5f60718293a4b5c6d7e8f9a0', 90],
    ['v3', 'Resumo do jogo', 'resumo', null, '5c3d4e5f60718293a4b5c6d7e8f9a0b1', 60],
  ];
  for (const [id, title, type, minute, hash, mins] of vids) {
    docs.push({
      path: `matches/9000/videos/${id}`,
      data: { id, title, minute, type, thumbnail: null, embedSrc: `${VIDEO_BASE}/${hash}?autostart=false`, publishedAt: new Date(now.getTime() - 5 * DAY + mins * 60_000) },
    });
  }
  return docs;
}

export function buildFixtures(now: Date = new Date()): SeedDoc[] {
  const docs: SeedDoc[] = [];
  const keys = periodKeys(now);

  docs.push({
    path: 'config/app',
    data: {
      minVersion: { ios: '7.0.0', android: '7.0.0' },
      storeUrls: {
        ios: 'https://apps.apple.com/app/id0000000000',
        android: 'https://play.google.com/store/apps/details?id=com.sporting360.app',
      },
      texts: {
        updateRequiredTitle: 'Atualização obrigatória',
        updateRequiredBody: 'Há uma versão nova da S360. Atualiza a app para continuar.',
        updateButton: 'Atualizar',
      },
      features: { comunidadeLeonina: false },
      comunidadeLeonina: [],
      updatedAt: now,
    },
  });

  // Private user + the public profile the app reads (the profile never holds an email).
  docs.push({
    path: `users/${TEST_USER.uid}`,
    data: { name: TEST_USER.name, email: TEST_USER.email },
  });
  for (const e of BOARD_ENTRIES) {
    docs.push({
      path: `publicProfiles/${e.uid}`,
      data: { displayName: e.displayName, avatarId: null, updatedAt: now },
    });
  }

  // Matches in the Plan 2 model: one upcoming, one finished.
  const team = (id: string, name: string) => ({ id, name, logo: null });
  const upcoming = {
    id: '9001',
    sport: 'football',
    competition: {
      key: 'football_94_2026',
      id: '94',
      name: 'Liga Portugal',
      type: 'league',
      season: '2026',
      round: 'Regular Season - 12',
      roundLabel: 'J12',
    },
    home: team(SPORTING_TEAM_ID, 'Sporting CP'),
    away: team('211', 'Benfica'),
    sportingSide: 'home',
    kickoff: new Date(now.getTime() + 2 * DAY),
    status: 'NS',
    statusRaw: 'NS',
    elapsed: null,
    elapsedExtra: null,
    score: { home: null, away: null, halftime: null, extratime: null, penalty: null },
    finishedAt: null,
    finishedAtSource: null,
    venue: { id: '1', name: 'Estádio José Alvalade', city: 'Lisboa' },
    referee: null,
    source: { provider: 'api-football', id: '9001' },
  };
  const finishedKickoff = new Date(now.getTime() - 5 * DAY);
  const finished = {
    ...upcoming,
    id: '9000',
    competition: { ...upcoming.competition, round: 'Regular Season - 11', roundLabel: 'J11' },
    home: team('212', 'FC Porto'),
    away: team(SPORTING_TEAM_ID, 'Sporting CP'),
    sportingSide: 'away',
    kickoff: finishedKickoff,
    status: 'FT',
    statusRaw: 'FT',
    elapsed: 90,
    score: {
      home: 1,
      away: 2,
      halftime: { home: 0, away: 1 },
      extratime: null,
      penalty: null,
    },
    finishedAt: new Date(finishedKickoff.getTime() + 110 * 60_000),
    finishedAtSource: 'estimated',
    venue: { id: '2', name: 'Estádio do Dragão', city: 'Porto' },
    source: { provider: 'api-football', id: '9000' },
  };
  docs.push({ path: 'matches/9001', data: upcoming });
  docs.push({ path: 'matches/9000', data: finished });
  docs.push(...stateFixtures(now, upcoming));
  docs.push(...competitionFixtures(now));
  docs.push(...teamFixtures());
  docs.push(...contentFixtures(now));
  docs.push({
    path: 'matches/9000/details/players',
    data: {
      teams: [
        {
          teamId: SPORTING_TEAM_ID,
          players: [
            { playerId: '1001', name: 'Jogador Um', photo: null, number: 9, position: 'F', minutes: 90, rating: 8.1, goals: 1, assists: 0, saves: 0, passesAccuracy: 84, tackles: 1, foulsCommitted: 2, cardsYellow: 0, cardsRed: 0, substitute: false },
            { playerId: '1002', name: 'Jogador Dois', photo: null, number: 8, position: 'M', minutes: 90, rating: 7.4, goals: 1, assists: 1, saves: 0, passesAccuracy: 91, tackles: 3, foulsCommitted: 1, cardsYellow: 1, cardsRed: 0, substitute: false },
          ],
        },
      ],
    },
  });

  // Engine data: prediction, vote and settlement of the finished match (read by direct path).
  docs.push({
    path: `matchPredictions/9000_${TEST_USER.uid}`,
    data: { gameId: '9000', userId: TEST_USER.uid, home: 1, away: 2, createdAt: finishedKickoff, source: 'v2027' },
  });
  docs.push({
    path: `mvpVotes/9000_${TEST_USER.uid}`,
    data: { gameId: '9000', userId: TEST_USER.uid, playerId: '1002', createdAt: finishedKickoff, source: 'v2027' },
  });
  docs.push({
    path: 'settlements/9000',
    data: { settledAt: now, finalHome: 1, finalAway: 2, officialMvp: ['1002'] },
  });

  // Points the server wrote when it settled 9000: exact result and the right MVP (Perfil "Meu jogo" and its history).
  const gameDate = finishedKickoff;
  for (const [type, points] of [
    ['prediction_participation', 1],
    ['prediction_exact', 5],
    ['mvp_participation', 1],
    ['mvp_correct', 3],
  ] as const) {
    docs.push({
      path: `pointEvents/${TEST_USER.uid}_9000_${type}`,
      data: { uid: TEST_USER.uid, gameId: '9000', type, points, gameDate },
    });
  }

  // MVP tally of the finished game: closed, voted by the test user, settled (official MVP 1002). Percentages need it.
  docs.push({
    path: 'mvpTallies/9000',
    data: { gameId: '9000', counts: { '1001': 14, '1002': 22, '1003': 3, '1004': 1 }, total: 40, updatedAt: now },
  });

  // Leaderboards: only the entries exist, the parent docs `leaderboards/{kind}_{key}` do not.
  const kinds = [
    ['week', keys.week],
    ['month', keys.month],
    ['season', keys.season],
  ] as const;
  for (const [kind, key] of kinds) {
    for (const e of BOARD_ENTRIES) {
      docs.push({
        path: `leaderboards/${kind}_${key}/entries/${e.uid}`,
        data: { uid: e.uid, displayName: e.displayName, points: e.points, updatedAt: now },
      });
    }
  }

  return docs;
}
