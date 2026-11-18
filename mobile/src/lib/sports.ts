// Modalidades do Sporting na app, pela ordem dos filtros (Agenda, Notícias, Perfil).
import type { Sport } from '@/data/schemas';

export const SPORTS: readonly { key: Sport; label: string }[] = [
  { key: 'football', label: 'Futebol' },
  { key: 'futsal', label: 'Futsal' },
  { key: 'handball', label: 'Andebol' },
  { key: 'roller_hockey', label: 'Hóquei em patins' },
  { key: 'volleyball', label: 'Voleibol' },
  { key: 'basketball', label: 'Basquetebol' },
];

export function sportLabel(s: Sport): string {
  return SPORTS.find((x) => x.key === s)?.label ?? s;
}
