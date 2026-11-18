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
