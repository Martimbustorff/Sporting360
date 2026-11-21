// No Android o expo-widgets não tem a fábrica de atividades: o serviço nunca o pode carregar (rebentava ao abrir).
jest.mock('@react-native-firebase/crashlytics');
jest.mock('@/services/firebase', () => ({ db: jest.fn() }));
jest.mock('expo-widgets', () => {
  throw new Error('expo-widgets carregado no Android');
});

import { Platform } from 'react-native';
import * as svc from '@/services/liveActivity';

it('no Android não carrega o expo-widgets e não faz nada', async () => {
  Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true });
  expect(svc.sharedDir()).toBeNull();
  expect(svc.startIfMissing({ sport: 'football', status: 'LIVE', elapsed: 30 } as never, [], new Date())).toBe(false);
  expect(svc.watchPushToStart('u1')()).toBeUndefined();
  await svc.unregisterLiveActivity('u1');
});
