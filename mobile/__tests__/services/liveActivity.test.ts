// Plano 10, ponto 2: jogo no ecrã de bloqueio (só iPhone).
jest.mock('@react-native-firebase/crashlytics');
jest.mock('@/services/firebase', () => ({ db: jest.fn(() => ({ __mock: 'db' })) }));
const mockSetDoc = jest.fn((..._a: unknown[]) => Promise.resolve());
const mockDeleteDoc = jest.fn((..._a: unknown[]) => Promise.resolve());
jest.mock('@react-native-firebase/firestore', () => ({
  doc: (_db: unknown, path: string) => ({ path }),
  setDoc: (...a: unknown[]) => mockSetDoc(...a),
  deleteDoc: (...a: unknown[]) => mockDeleteDoc(...a),
  serverTimestamp: () => 'TS',
}));
jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: () => ({}),
  getToken: () => Promise.resolve('fcm-1'),
}));

import { Platform } from 'react-native';
import * as widgets from 'expo-widgets';
import type * as WidgetsMock from '../../__mocks__/expo-widgets';
const { __activities, __pushToStart } = widgets as unknown as typeof WidgetsMock;
import type { Match } from '@/data/schemas';
import { sharedDir, startIfMissing, unregisterLiveActivity, watchActivities, watchPushToStart } from '@/services/liveActivity';

const flush = () => new Promise((r) => setTimeout(r, 0));
const live = (over: Partial<Match> = {}): Match =>
  ({
    id: 'g1',
    sport: 'football',
    competition: { key: 'k', id: '94', name: 'Liga Portugal', type: 'league', season: '2026', round: 'Regular Season - 12', roundLabel: null },
    home: { id: '228', name: 'Sporting CP', logo: null },
    away: { id: '212', name: 'FC Porto', logo: null },
    sportingSide: 'home',
    kickoff: new Date(),
    status: 'LIVE',
    statusRaw: '1H',
    elapsed: 20,
    elapsedExtra: null,
    score: { home: 1, away: 0, halftime: null, extratime: null, penalty: null },
    finishedAt: null,
    ...over,
  }) as Match;

beforeAll(() => {
  Object.defineProperty(Platform, 'OS', { get: () => 'ios', configurable: true });
  Object.defineProperty(Platform, 'Version', { get: () => '18.2', configurable: true });
});

beforeEach(() => {
  mockSetDoc.mockClear();
  mockDeleteDoc.mockClear();
  __activities.length = 0;
});

it('iOS antes do 16.1: nada', () => {
  Object.defineProperty(Platform, 'Version', { get: () => '15.4', configurable: true });
  expect(startIfMissing(live(), [], new Date())).toBe(false);
  Object.defineProperty(Platform, 'Version', { get: () => '18.2', configurable: true });
});

it('pasta partilhada sem a barra final', () => expect(sharedDir()).toBe('file:///group/ExpoWidgets'));

it('grava o token de push-to-start no dispositivo, com a pasta dos emblemas', async () => {
  const stop = watchPushToStart('u1');
  __pushToStart.listeners.forEach((l) => l({ activityPushToStartToken: 'pts-1' }));
  await flush();
  expect(mockSetDoc).toHaveBeenCalledWith(
    { path: 'users/u1/liveActivityDevices/fcm-1' },
    { fcmToken: 'fcm-1', pushToStartToken: 'pts-1', dir: 'file:///group/ExpoWidgets', updatedAt: 'TS' },
  );
  stop();
  expect(__pushToStart.listeners).toHaveLength(0);
});

it('arranca localmente só com o jogo a meio e sem atividade', () => {
  expect(startIfMissing(live({ elapsed: 1 }), [], new Date())).toBe(false);
  expect(startIfMissing(live({ status: 'NS', elapsed: null } as Partial<Match>), [], new Date())).toBe(false);
  expect(startIfMissing(live(), [], new Date())).toBe(true);
  expect(__activities[0]).toMatchObject({ url: 's360://jogo/g1', props: { matchId: 'g1', homeScore: 1, homeCrest: 'file:///group/ExpoWidgets/crest_228.png' } });
  expect(startIfMissing(live(), [], new Date())).toBe(false);
});

it('grava o token de cada atividade com o jogo', async () => {
  __activities.push({ id: 'a1', props: {}, token: 'act-tok' });
  const stop = watchActivities('u1', 'g1');
  await flush();
  await flush();
  expect(mockSetDoc).toHaveBeenCalledWith(
    { path: 'users/u1/liveActivities/a1' },
    { matchId: 'g1', activityToken: 'act-tok', fcmToken: 'fcm-1', dir: 'file:///group/ExpoWidgets', updatedAt: 'TS' },
  );
  stop();
});

it('ao sair da conta apaga o dispositivo', async () => {
  await unregisterLiveActivity('u1');
  expect(mockDeleteDoc).toHaveBeenCalledWith({ path: 'users/u1/liveActivityDevices/fcm-1' });
});
