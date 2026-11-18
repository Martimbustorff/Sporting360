// Texto da contagem decrescente ("Fecha em 2 h 15 min"). Arredonda sempre para baixo.
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function countdownText(ms: number): string {
  if (ms >= DAY) return `${Math.floor(ms / DAY)} d ${Math.floor((ms % DAY) / HOUR)} h`;
  if (ms >= HOUR) return `${Math.floor(ms / HOUR)} h ${Math.floor((ms % HOUR) / MIN)} min`;
  if (ms >= MIN) return `${Math.floor(ms / MIN)} min`;
  return 'menos de 1 min';
}
