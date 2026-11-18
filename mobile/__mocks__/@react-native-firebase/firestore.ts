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
export const query = jest.fn((ref: unknown, ...constraints: unknown[]) => ({ __kind: 'query', ref, constraints }));
export const where = jest.fn((field: string, op: string, value: unknown) => ({ __kind: 'where', field, op, value }));
export const orderBy = jest.fn((field: string, dir?: string) => ({ __kind: 'orderBy', field, dir }));
export const limit = jest.fn((n: number) => ({ __kind: 'limit', n }));
export const documentId = jest.fn(() => ({ __kind: 'documentId' }));
export const getCountFromServer = jest.fn(() =>
  Promise.resolve({ data: () => ({ count: 0 }) }),
);
