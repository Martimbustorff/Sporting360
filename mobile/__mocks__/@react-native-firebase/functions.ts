export const getFunctions = jest.fn((_app?: unknown, region?: string) => ({ __mock: 'functions', region }));
export const connectFunctionsEmulator = jest.fn();
export const httpsCallable = jest.fn();
