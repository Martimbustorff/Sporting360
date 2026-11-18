import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** List queries are rebuilt at most once per 10-minute block of `now` (no resubscribe per render). */
export const BLOCK_MS = 600_000;

const floorTo = (ms: number, step: number) => new Date(Math.floor(ms / step) * step);

/**
 * Current time floored to `stepMs`. Re-renders at each step boundary and when the app comes back
 * to the foreground. The timeout reschedules itself from the real clock after every fire, so a
 * timer that fires early (native timers are not exact) aims at the boundary it missed instead of
 * waiting a whole step. The timer and the AppState subscription are cleared on unmount.
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
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Always the time left to the next boundary, between 1 and stepMs.
    const schedule = () => {
      timer = setTimeout(() => {
        tick();
        schedule();
      }, stepMs - (Date.now() % stepMs));
    };
    tick();
    schedule();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') tick();
    });
    return () => {
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [stepMs]);

  return now;
}
