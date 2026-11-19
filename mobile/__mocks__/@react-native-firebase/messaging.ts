// Mock do @react-native-firebase/messaging (API modular). Os testes trocam os valores com mockResolvedValue.
export const AuthorizationStatus = {
  NOT_DETERMINED: -1,
  DENIED: 0,
  AUTHORIZED: 1,
  PROVISIONAL: 2,
  EPHEMERAL: 3,
} as const;
export const getMessaging = jest.fn(() => ({ __mock: 'messaging' }));
export const getToken = jest.fn(() => Promise.resolve('tok-1'));
export const deleteToken = jest.fn(() => Promise.resolve());
export const requestPermission = jest.fn(() => Promise.resolve(AuthorizationStatus.AUTHORIZED));
export const hasPermission = jest.fn(() => Promise.resolve(AuthorizationStatus.AUTHORIZED));
export const subscribeToTopic = jest.fn(() => Promise.resolve());
export const unsubscribeFromTopic = jest.fn(() => Promise.resolve());
export const onTokenRefresh = jest.fn((_m: unknown, _listener: (token: string) => void) => jest.fn());
export const onNotificationOpenedApp = jest.fn((_m: unknown, _listener: (msg: unknown) => void) => jest.fn());
export const getInitialNotification = jest.fn(() => Promise.resolve(null as unknown));
export const onMessage = jest.fn((_m: unknown, _listener: (msg: unknown) => void) => jest.fn());
