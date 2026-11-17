export const getFirestore = jest.fn(() => ({ __mock: 'firestore' }));
export const connectFirestoreEmulator = jest.fn();
export const doc = jest.fn((_db: unknown, path: string) => ({ __kind: 'doc', path }));
export const collection = jest.fn((_db: unknown, path: string) => ({ __kind: 'collection', path }));
// Tests drive snapshots by grabbing the callbacks passed to this mock.
export const onSnapshot = jest.fn(
  (_ref: unknown, _next: unknown, _error?: unknown) => jest.fn(),
);
export const setDoc = jest.fn(() => Promise.resolve());
export const serverTimestamp = jest.fn(() => ({ __kind: 'serverTimestamp' }));
export const getDoc = jest.fn(() => Promise.resolve({ exists: () => false, data: () => undefined }));
