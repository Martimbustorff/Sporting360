// Firestore-shaped seed data for the emulator (scripts/seed-emulator.mjs) and for tests.
// Plain data only: no imports, no TS-only runtime syntax, so Node can load it directly.
// View-model fixtures for the gallery (Task 8) live in galleryFixtures.ts, not here.

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

const pad = (n: number): string => String(n).padStart(2, '0');

/** Same keys as functions/src/time/periods.ts (Europe/Lisbon, season starts in July). */
export function periodKeys(at: Date): { week: string; month: string; season: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const year = get('year');
  const month = get('month');
  const day = get('day');

  // ISO week: shift to the Thursday of this week, then count weeks from Jan 1.
  const d = new Date(Date.UTC(year, month - 1, day));
  const weekday = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + 4 - weekday);
  const isoYear = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(isoYear, 0, 1)) / 86_400_000 + 1) / 7);

  const startYear = month >= 7 ? year : year - 1;
  return {
    week: `${isoYear}-W${pad(week)}`,
    month: `${year}-${pad(month)}`,
    season: `${startYear}-${startYear + 1}`,
  };
}

const DAY = 86_400_000;

const BOARD_ENTRIES = [
  { uid: TEST_USER.uid, displayName: TEST_USER.name, points: 12 },
  { uid: 'seed-user-2', displayName: 'Ana Silva', points: 18 },
  { uid: 'seed-user-3', displayName: 'Rui Costa', points: 15 },
  { uid: 'seed-user-4', displayName: `Sportinguista #${'seed-user-4'.slice(-4)}`, points: 9 },
  { uid: 'seed-user-5', displayName: 'Inês Pereira', points: 3 },
] as const;

export function buildFixtures(now: Date = new Date()): SeedDoc[] {
  const docs: SeedDoc[] = [];
  const keys = periodKeys(now);

  docs.push({
    path: 'config/app',
    data: {
      minVersion: { ios: '2.0.0', android: '2.0.0' },
      storeUrls: {
        ios: 'https://apps.apple.com/app/id0000000000',
        android: 'https://play.google.com/store/apps/details?id=com.sporting360.app',
      },
      texts: {
        updateRequiredTitle: 'Atualização obrigatória',
        updateRequiredBody: 'Há uma versão nova da S360. Atualiza a app para continuar.',
        updateButton: 'Atualizar',
      },
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
