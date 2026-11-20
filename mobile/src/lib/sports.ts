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

/**
 * Modalidades com jogos no Calendário. 20/11 (Martim): andebol, voleibol e basquetebol ficam escondidos até haver
 * fonte de dados (o plano gratuito da API-Sports não dá a época atual). Voltar a pôr aqui quando houver jogos.
 */
export const AGENDA_SPORTS: readonly { key: Sport; label: string }[] = SPORTS.filter((s) =>
  (['football', 'futsal', 'roller_hockey'] as Sport[]).includes(s.key),
);
