// Server source: functions/src/time/periods.ts (periodKeys) and functions/src/model/seasons.ts
// (footballApiSeason). Parity is checked with the server's own test vectors
// (functions/test/unit/periods.test.ts, model.test.ts) in __tests__/lib/periods.test.ts.
// No imports: src/data/fixtures.ts imports this file and Node loads it directly (seed script).

const TZ = 'Europe/Lisbon';
/** Ranking season ("Época" of spec §6) starts in July. */
const RANKING_SEASON_START_MONTH = 7;
/** Football data season (API-Football, `competition.season`, `playerStats_{season}`) starts in August. */
const FOOTBALL_SEASON_START_MONTH = 8;

const pad = (n: number): string => String(n).padStart(2, '0');

function lisbonDate(at: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** Leaderboard keys: ISO week, month and July-June season, all in Lisbon time. */
export function periodKeys(at: Date): { week: string; month: string; season: string } {
  const { year, month, day } = lisbonDate(at);

  // ISO week: shift to the Thursday of this week, then count weeks from Jan 1.
  const d = new Date(Date.UTC(year, month - 1, day));
  const weekday = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + 4 - weekday);
  const isoYear = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(isoYear, 0, 1)) / 86_400_000 + 1) / 7);

  const startYear = month >= RANKING_SEASON_START_MONTH ? year : year - 1;
  return {
    week: `${isoYear}-W${pad(week)}`,
    month: `${year}-${pad(month)}`,
    season: `${startYear}-${startYear + 1}`,
  };
}

/** Football data season: start year, August to July, Lisbon time (same as the server's footballApiSeason). */
export function footballSeason(at: Date): string {
  const { year, month } = lisbonDate(at);
  return String(month >= FOOTBALL_SEASON_START_MONTH ? year : year - 1);
}
