const LISBON = "Europe/Lisbon";

function lisbonYearMonth(at: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: LISBON, year: "numeric", month: "numeric" }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get("year"), month: get("month") };
}

/** Ano de início da época (agosto é o primeiro mês), em hora de Lisboa. */
export function footballApiSeason(now: Date): string {
  const { year, month } = lisbonYearMonth(now);
  return String(month >= 8 ? year : year - 1);
}

/**
 * Épocas a pedir: a corrente e o ano civil; de maio a julho também a seguinte
 * (calendário novo publicado antes de agosto). Sem repetidos.
 */
export function seasonsToFetch(now: Date): string[] {
  const { year, month } = lisbonYearMonth(now);
  const current = Number(footballApiSeason(now));
  const list = [current, year];
  if (month >= 5 && month <= 7) list.push(current + 1);
  return [...new Set(list)].map(String);
}

/** Época das APIs API-Sports não-futebol: "year" → "2026", "span" → "2026-2027". */
export function apiSportsSeason(format: "year" | "span", now: Date): string {
  const start = Number(footballApiSeason(now));
  return format === "year" ? String(start) : `${start}-${start + 1}`;
}
