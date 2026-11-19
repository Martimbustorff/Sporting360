// Estatísticas do jogo: função pura sobre `details/statistics` (Plano 2, liveTicker). Sem React nem Firestore.
import type { StatisticsDoc } from '@/data/schemas';

export const XG_KEY = 'xg';
export const POSSESSION_KEY = 'Ball Possession';

/** Chave da API (ou `xg`) e rótulo pt-PT, pela ordem do Figma 500:28650. */
export const STAT_ORDER = [
  { key: 'Ball Possession', label: 'Posse de bola (%)' },
  { key: 'xg', label: 'Golos esperados (xG)' },
  { key: 'Total Shots', label: 'Total de remates' },
  { key: 'Shots on Goal', label: 'Remates à baliza' },
  { key: 'Goalkeeper Saves', label: 'Defesas de guarda-redes' },
  { key: 'Corner Kicks', label: 'Cantos' },
  { key: 'Offsides', label: 'Foras de jogo' },
  { key: 'Fouls', label: 'Faltas' },
  { key: 'Yellow Cards', label: 'Cartão amarelo' },
  { key: 'Red Cards', label: 'Cartão vermelho' },
] as const;

export type StatRowData = { label: string; home: string; away: string };

/** "1,4" (uma casa, vírgula decimal); 0 ou ausente "0". */
function xgText(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v) || v === 0) return '0';
  return v.toFixed(1).replace('.', ',');
}

function itemText(key: string, v: string | number | null | undefined): string {
  if (v == null || v === '') return key === POSSESSION_KEY ? '0%' : '0';
  return String(v);
}

/**
 * Sempre as 10 linhas, pela ordem de `STAT_ORDER`. Casa e fora vêm do `teamId`, não da posição em `teams`.
 * Sem documento ou sem valor: "0" (posse "0%"). Posse e restantes valores tal como a API os dá.
 */
export function statRows(doc: StatisticsDoc | null, homeId: string, awayId: string): StatRowData[] {
  const items = (id: string) => doc?.teams.find((t) => t.teamId === id)?.items ?? {};
  const home = items(homeId);
  const away = items(awayId);
  return STAT_ORDER.map(({ key, label }) =>
    key === XG_KEY
      ? { label, home: xgText(doc?.xg?.home), away: xgText(doc?.xg?.away) }
      : { label, home: itemText(key, home[key]), away: itemText(key, away[key]) },
  );
}

export type StatPeriodKey = 'game' | 'first' | 'second';
export type StatPeriodOption = { key: StatPeriodKey; label: string; doc: StatisticsDoc };

/**
 * Jogo / 1.ª parte / 2.ª parte (Figma 4947:8240). Só há alternador se o documento tiver as duas partes em `periods`;
 * sem elas devolve null e o ecrã mostra apenas o jogo.
 */
export function statPeriods(doc: StatisticsDoc | null): StatPeriodOption[] | null {
  const first = doc?.periods?.first;
  const second = doc?.periods?.second;
  if (!doc || !first || !second) return null;
  return [
    { key: 'game', label: 'Jogo', doc },
    { key: 'first', label: '1.ª parte', doc: { teams: first.teams, xg: first.xg } },
    { key: 'second', label: '2.ª parte', doc: { teams: second.teams, xg: second.xg } },
  ];
}

/** "58%" e "1,4" para número; ilegível vale 0. */
export function statNumber(text: string): number {
  const n = Number(text.replace('%', '').replace(',', '.').trim());
  return Number.isFinite(n) ? n : 0;
}

export type StatBar = { grow: number; leader: boolean };

/**
 * Barras de uma estatística (Figma 4947:8252): cada lado cresce pelo seu valor e só a barra do valor maior é
 * `primaryOnDark`; a do menor é `surface20`. Empate (incluindo 0 contra 0) não tem líder: duas barras iguais.
 */
export function statBars(home: string, away: string): { home: StatBar; away: StatBar } {
  const h = Math.max(0, statNumber(home));
  const a = Math.max(0, statNumber(away));
  if (h === 0 && a === 0) return { home: { grow: 1, leader: false }, away: { grow: 1, leader: false } };
  return { home: { grow: h, leader: h > a }, away: { grow: a, leader: a > h } };
}
