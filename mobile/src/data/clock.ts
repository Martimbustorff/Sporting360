import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** List queries are rebuilt at most once per 10-minute block of `now` (no resubscribe per render). */
export const BLOCK_MS = 600_000;

const floorTo = (ms: number, step: number) => new Date(Math.floor(ms / step) * step);

/**
 * Current time floored to `stepMs`. Re-renders at each step boundary (one timeout to the next boundary,
 * then every step) and when the app comes back to the foreground. Timers and the AppState
 * subscription are cleared on unmount.
 */
export function useNow(stepMs: number = BLOCK_MS): Date {
  const [now, setNow] = useState(() => floorTo(Date.now(), stepMs));

  useEffect(() => {
    // Same floored value keeps the same Date object, so no re-render (and no query rebuild).
    const tick = () =>
      setNow((prev) => {
        const next = floorTo(Date.now(), stepMs);
        return next.getTime() === prev.getTime() ? prev : next;
      });
    tick();
    let interval: ReturnType<typeof setInterval> | null = null;
    const first = setTimeout(() => {
      tick();
      interval = setInterval(tick, stepMs);
    }, stepMs - (Date.now() % stepMs));
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') tick();
    });
    return () => {
      clearTimeout(first);
      if (interval) clearInterval(interval);
      sub.remove();
    };
  }, [stepMs]);

  return now;
}
