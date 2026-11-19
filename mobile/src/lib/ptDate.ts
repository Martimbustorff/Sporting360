// Datas pt-PT com tabela fixa (ruling R8): os motores Intl (Node, Hermes) divergem nos meses curtos.
// Intl só é usado para hora/minuto e dia civil no fuso Europe/Lisbon.
export const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const;
export const MONTHS_LONG = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
] as const;
export const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'] as const;

const TZ = 'Europe/Lisbon';
const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export type LisbonParts = { year: number; month: number; day: number; hour: number; minute: number };

export function lisbonParts(d: Date): LisbonParts {
  const out: Record<string, number> = {};
  for (const p of fmt.formatToParts(d)) if (p.type !== 'literal') out[p.type] = Number(p.value);
  return { year: out.year ?? 0, month: out.month ?? 1, day: out.day ?? 1, hour: out.hour ?? 0, minute: out.minute ?? 0 };
}

const dayNumber = (p: LisbonParts) => Math.floor(Date.UTC(p.year, p.month - 1, p.day) / 86_400_000);
// 0 = segunda ... 6 = domingo
const weekIndex = (n: number) => (new Date(n * 86_400_000).getUTCDay() + 6) % 7;

export function formatTime(d: Date): string {
  const p = lisbonParts(d);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/** "Domingo, 13" na mesma semana (segunda a domingo) que `now`; caso contrário "14 Set". */
export function formatKickoffDate(d: Date, now: Date = new Date()): string {
  const p = lisbonParts(d);
  const n = dayNumber(p);
  const nowN = dayNumber(lisbonParts(now));
  const sameWeek = n - weekIndex(n) === nowN - weekIndex(nowN);
  if (sameWeek) return `${WEEKDAYS[new Date(n * 86_400_000).getUTCDay()]}, ${p.day}`;
  return `${p.day} ${MONTHS_SHORT[p.month - 1]}`;
}

/** "16 abril": data absoluta (cartão partilhado, que dura mais do que a semana do jogo). */
export function formatDayMonth(d: Date): string {
  const p = lisbonParts(d);
  return `${p.day} ${MONTHS_LONG[p.month - 1]}`;
}

/** "SÁB 21 DEZ": dia da semana e mês abreviados, dia civil em Lisboa (cartão do próximo jogo, Figma 4920:5101). */
export function formatCardDate(d: Date): string {
  const p = lisbonParts(d);
  const weekday = (WEEKDAYS[new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()] ?? '').slice(0, 3);
  return `${weekday} ${p.day} ${MONTHS_SHORT[p.month - 1]}`.toUpperCase();
}
