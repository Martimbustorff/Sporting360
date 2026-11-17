// "há X tempo" em pt-PT. Mês curto da tabela fixa (ruling R8), dia civil em Europe/Lisbon.
import { lisbonParts, MONTHS_SHORT, type LisbonParts } from './ptDate';

const MIN = 60_000;
const HOUR = 60 * MIN;
const dayNumber = (p: LisbonParts) => Math.floor(Date.UTC(p.year, p.month - 1, p.day) / 86_400_000);

export function relativeTime(date: Date, now: Date): string {
  const elapsed = now.getTime() - date.getTime();
  if (elapsed < MIN) return 'agora';
  if (elapsed < HOUR) return `há ${Math.floor(elapsed / MIN)} min`;
  if (elapsed < 24 * HOUR) {
    const h = Math.floor(elapsed / HOUR);
    return h === 1 ? 'há 1 hora' : `há ${h} horas`;
  }
  const p = lisbonParts(date);
  const days = Math.max(1, dayNumber(lisbonParts(now)) - dayNumber(p));
  if (days === 1) return 'ontem';
  if (days < 7) return `há ${days} dias`;
  return `${p.day} ${MONTHS_SHORT[p.month - 1]!.toLowerCase()}.`;
}
