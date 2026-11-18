// Mock em memória de expo-secure-store. `__reset()` limpa entre testes.
const store = new Map<string, string>();
export const getItemAsync = jest.fn(async (k: string) => store.get(k) ?? null);
export const setItemAsync = jest.fn(async (k: string, v: string) => {
  store.set(k, v);
});
export const deleteItemAsync = jest.fn(async (k: string) => {
  store.delete(k);
});
export const __reset = () => store.clear();
