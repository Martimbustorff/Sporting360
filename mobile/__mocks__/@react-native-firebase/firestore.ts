export const getFirestore = jest.fn(() => ({ __mock: 'firestore' }));
export const connectFirestoreEmulator = jest.fn();
// doc(db, path) devolve { path }; doc(collectionRef) devolve uma referência com id automático (como o SDK).
let autoId = 0;
export const doc = jest.fn((parent: unknown, path?: string) => {
  if (path === undefined && typeof parent === 'object' && parent !== null && 'path' in parent) {
    autoId += 1;
    const id = `auto${autoId}`;
    return { __kind: 'doc', path: `${(parent as { path: string }).path}/${id}`, id };
  }
  return { __kind: 'doc', path };
});
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
// Task 23 (F4): escrita e apagamento de documentos da coleção gamebox.
export const addDoc = jest.fn((ref: { path: string }) => Promise.resolve({ __kind: 'doc', path: `${ref.path}/added`, id: 'added' }));
export const updateDoc = jest.fn(() => Promise.resolve());
export const deleteDoc = jest.fn(() => Promise.resolve());
export const deleteField = jest.fn(() => ({ __kind: 'deleteField' }));
export class Timestamp {
  constructor(readonly seconds: number, readonly nanoseconds: number) {}
  static fromDate(d: Date): Timestamp {
    return new Timestamp(Math.floor(d.getTime() / 1000), (d.getTime() % 1000) * 1e6);
  }
  static fromMillis(ms: number): Timestamp {
    return Timestamp.fromDate(new Date(ms));
  }
  static now(): Timestamp {
    return Timestamp.fromDate(new Date());
  }
  toDate(): Date {
    return new Date(this.seconds * 1000 + this.nanoseconds / 1e6);
  }
  toMillis(): number {
    return this.toDate().getTime();
  }
}
