export const getCrashlytics = jest.fn(() => ({ __mock: 'crashlytics' }));
export const setCrashlyticsCollectionEnabled = jest.fn(() => Promise.resolve(null));
export const recordError = jest.fn();
export const log = jest.fn();
export const setUserId = jest.fn(() => Promise.resolve());
