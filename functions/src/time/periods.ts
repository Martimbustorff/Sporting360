import { getISOWeek, getISOWeekYear } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const TZ = "Europe/Lisbon";
const SEASON_START_MONTH = 7; // julho

const pad = (n: number): string => String(n).padStart(2, "0");

export function periodKeys(at: Date): { week: string; month: string; season: string } {
  const z = toZonedTime(at, TZ);
  const year = z.getFullYear();
  const month = z.getMonth() + 1;
  const startYear = month >= SEASON_START_MONTH ? year : year - 1;
  return {
    week: `${getISOWeekYear(z)}-W${pad(getISOWeek(z))}`,
    month: `${year}-${pad(month)}`,
    season: `${startYear}-${startYear + 1}`,
  };
}
