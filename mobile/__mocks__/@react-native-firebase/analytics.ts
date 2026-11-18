export const getAnalytics = jest.fn(() => ({ __mock: 'analytics' }));
export const setUserId = jest.fn(() => Promise.resolve());
export const setUserProperty = jest.fn(() => Promise.resolve());
export const logEvent = jest.fn(() => Promise.resolve());
export const setAnalyticsCollectionEnabled = jest.fn(() => Promise.resolve());
