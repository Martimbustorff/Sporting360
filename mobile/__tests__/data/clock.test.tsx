// Fix round 1 (Task 5): relógio que anda para ecrãs que ficam montados (Home, Agenda).
import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { BLOCK_MS, useNow, useSecondNow } from '@/data/clock';

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

// Task 7 (carry da revisão da Task 5): o passo volta a marcar-se a si próprio, por isso um disparo
// adiantado (precisão dos temporizadores nativos) não adia a atualização um bloco inteiro.
it('um disparo adiantado volta a marcar o que falta, não um bloco inteiro', async () => {
  const { result } = await renderHook(() => useNow());
  // setSystemTime desloca o relógio e os temporizadores juntos: o primeiro passa a disparar 1 ms antes da fronteira.
  await act(async () => {
    jest.setSystemTime(T0 - 1);
  });
  await act(async () => {
    jest.advanceTimersByTime(7 * 60_000); // 12:09:59.999: ainda é o bloco das 12:00
  });
  expect(result.current.getTime()).toBe(at('2026-11-18T12:00:00Z'));
  await act(async () => {
    jest.advanceTimersByTime(1); // 12:10:00.000
  });
  expect(result.current.getTime()).toBe(at('2026-11-18T12:10:00Z'));
});

it('ao desmontar limpa o temporizador e a subscrição do AppState', async () => {
  const setT = jest.spyOn(global, 'setTimeout');
  const clearT = jest.spyOn(global, 'clearTimeout');
  const { unmount } = await renderHook(() => useNow());
  const first = setT.mock.results.find((r, i) => setT.mock.calls[i]?.[1] === 7 * 60_000)?.value;
  expect(first).toBeDefined();
  await act(async () => {
    jest.advanceTimersByTime(7 * 60_000); // dispara o primeiro e volta a marcar-se
  });
  const second = setT.mock.results.find((r, i) => setT.mock.calls[i]?.[1] === BLOCK_MS)?.value;
  expect(second).toBeDefined();
  await unmount();
  expect(remove).toHaveBeenCalledTimes(1);
  expect(clearT).toHaveBeenCalledWith(second);
});

it('desmontar antes da primeira fronteira limpa o temporizador e não marca mais nenhum', async () => {
  const setT = jest.spyOn(global, 'setTimeout');
  const ours = () => setT.mock.calls.filter((c) => c[1] === 7 * 60_000 || c[1] === BLOCK_MS).length;
  const { unmount } = await renderHook(() => useNow());
  expect(ours()).toBe(1);
  await unmount();
  await act(async () => {
    jest.advanceTimersByTime(2 * BLOCK_MS);
  });
  expect(ours()).toBe(1);
  expect(remove).toHaveBeenCalledTimes(1);
});

describe('useSecondNow', () => {
  const fallback = new Date('2026-11-18T12:00:00Z');

  it('desligado devolve o valor de reserva e não anda', async () => {
    const { result } = await renderHook(() => useSecondNow(false, fallback));
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(result.current).toBe(fallback);
  });

  it('ligado anda ao segundo; ao desligar volta à reserva e deixa de andar', async () => {
    const { result, rerender } = await renderHook(({ on }: { on: boolean }) => useSecondNow(on, fallback), { initialProps: { on: true } });
    expect(result.current.getTime()).toBe(T0);
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(result.current.getTime()).toBe(T0 + 3000);
    await rerender({ on: false });
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(result.current).toBe(fallback);
  });

  it('em segundo plano pára; ao voltar a active retoma logo', async () => {
    const { result } = await renderHook(() => useSecondNow(true, fallback));
    await act(async () => listener?.('background'));
    const frozen = result.current.getTime();
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(result.current.getTime()).toBe(frozen);
    await act(async () => listener?.('active'));
    expect(result.current.getTime()).toBe(T0 + 5000);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.getTime()).toBe(T0 + 6000);
  });

  it('limpa a subscrição do AppState ao desmontar', async () => {
    const view = await renderHook(() => useSecondNow(true, fallback));
    await view.unmount();
    expect(remove).toHaveBeenCalled();
  });
});
