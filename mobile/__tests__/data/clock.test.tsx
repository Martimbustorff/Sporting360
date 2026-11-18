// Fix round 1 (Task 5): relógio que anda para ecrãs que ficam montados (Home, Agenda).
import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { BLOCK_MS, useNow } from '@/data/clock';

const T0 = new Date('2026-11-18T12:03:00Z').getTime(); // 3 min depois do bloco das 12:00

let listener: ((s: AppStateStatus) => void) | null;
let remove: jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(T0);
  listener = null;
  remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, fn) => {
    listener = fn as (s: AppStateStatus) => void;
    return { remove } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const at = (iso: string) => new Date(iso).getTime();

it('devolve a hora arredondada ao passo (10 min por omissão)', async () => {
  const { result } = await renderHook(() => useNow());
  expect(BLOCK_MS).toBe(600_000);
  expect(result.current.getTime()).toBe(at('2026-11-18T12:00:00Z'));
});

it('passa a fronteira do passo e atualiza, depois a cada passo', async () => {
  const { result } = await renderHook(() => useNow());
  const before = result.current;
  await act(async () => {
    jest.advanceTimersByTime(6 * 60_000); // 12:09
  });
  expect(result.current).toBe(before); // mesmo objeto: sem re-render inútil
  await act(async () => {
    jest.advanceTimersByTime(60_000); // 12:10
  });
  expect(result.current.getTime()).toBe(at('2026-11-18T12:10:00Z'));
  await act(async () => {
    jest.advanceTimersByTime(BLOCK_MS); // 12:20
  });
  expect(result.current.getTime()).toBe(at('2026-11-18T12:20:00Z'));
});

it('aceita outro passo', async () => {
  const { result } = await renderHook(() => useNow(60_000));
  expect(result.current.getTime()).toBe(at('2026-11-18T12:03:00Z'));
  await act(async () => {
    jest.advanceTimersByTime(60_000);
  });
  expect(result.current.getTime()).toBe(at('2026-11-18T12:04:00Z'));
});

it("atualiza quando a app volta a 'active' (timers parados em segundo plano)", async () => {
  const { result } = await renderHook(() => useNow());
  jest.setSystemTime(at('2026-11-18T15:42:00Z')); // o relógio andou sem os timers dispararem
  await act(async () => {
    listener?.('background');
  });
  expect(result.current.getTime()).toBe(at('2026-11-18T12:00:00Z'));
  await act(async () => {
    listener?.('active');
  });
  expect(result.current.getTime()).toBe(at('2026-11-18T15:40:00Z'));
});

it('ao desmontar limpa os timers e a subscrição do AppState', async () => {
  const setT = jest.spyOn(global, 'setTimeout');
  const setI = jest.spyOn(global, 'setInterval');
  const clearT = jest.spyOn(global, 'clearTimeout');
  const clearI = jest.spyOn(global, 'clearInterval');
  const { unmount } = await renderHook(() => useNow());
  const first = setT.mock.results.find((r, i) => setT.mock.calls[i]?.[1] === 7 * 60_000)?.value;
  expect(first).toBeDefined();
  await act(async () => {
    jest.advanceTimersByTime(7 * 60_000); // dispara o primeiro timeout e arranca o intervalo
  });
  const interval = setI.mock.results.find((r, i) => setI.mock.calls[i]?.[1] === BLOCK_MS)?.value;
  expect(interval).toBeDefined();
  await unmount();
  expect(remove).toHaveBeenCalledTimes(1);
  expect(clearT).toHaveBeenCalledWith(first);
  expect(clearI).toHaveBeenCalledWith(interval);
});

it('desmontar antes da primeira fronteira limpa o timeout e não deixa intervalo', async () => {
  const setI = jest.spyOn(global, 'setInterval');
  const { unmount } = await renderHook(() => useNow());
  await unmount();
  await act(async () => {
    jest.advanceTimersByTime(2 * BLOCK_MS);
  });
  expect(setI.mock.calls.some((c) => c[1] === BLOCK_MS)).toBe(false);
  expect(remove).toHaveBeenCalledTimes(1);
});
