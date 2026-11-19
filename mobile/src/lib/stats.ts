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
  // Normalizado (valor / soma) para que pares fracionários (xG 0,3 contra 0,2) também enchem a linha.
  const total = h + a;
  return { home: { grow: h / total, leader: h > a }, away: { grow: a / total, leader: a > h } };
}

// Partes do jogo. A 1.ª parte é o instantâneo do intervalo (`firstHalf`); a 2.ª é total menos 1.ª, só nas contagens.
export type StatPart = 'total' | 'first' | 'second';
export type PartRow = StatRowData & { key: string };

/** O documento tem as estatísticas do intervalo (senão o seletor de partes esconde-se). */
export const hasHalves = (doc: StatisticsDoc | null | undefined): boolean => Array.isArray(doc?.firstHalf?.teams);

/** Percentagens e rácios (posse, precisão de passes): não se obtêm por subtração. */
export const isRatioStat = (key: string): boolean => key === POSSESSION_KEY || key.includes('%') || /accuracy/i.test(key);

/** Valor numérico de um item; nulo ou ausente conta 0 (a API dá `null` a um zero); texto ilegível dá null (ignora-se). */
function count(v: string | number | null | undefined): number | null {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** 2.ª parte: total menos 1.ª parte, por equipa e por contagem (nunca negativo); sem as percentagens. */
function secondHalfDoc(doc: StatisticsDoc): StatisticsDoc {
  const first = doc.firstHalf;
  const teams = doc.teams.map((t) => {
    const f = first?.teams.find((x) => x.teamId === t.teamId)?.items ?? {};
    const items: Record<string, number> = {};
    for (const [k, v] of Object.entries(t.items)) {
      if (isRatioStat(k)) continue;
      const total = count(v);
      const before = count(f[k]);
      if (total === null || before === null) continue;
      items[k] = Math.max(0, total - before);
    }
    return { teamId: t.teamId, items };
  });
  const sub = (a: number | null | undefined, b: number | null | undefined): number | null =>
    a == null ? null : Math.max(0, Math.round((a - (b ?? 0)) * 100) / 100);
  const xg = doc.xg ? { home: sub(doc.xg.home, first?.xg?.home), away: sub(doc.xg.away, first?.xg?.away) } : null;
  return { teams, xg } as StatisticsDoc;
}

/**
 * Linhas (com a chave) da parte escolhida. Sem `firstHalf` a parte não existe: usa-se o total. Na 2.ª parte as linhas de
 * percentagem (posse) ficam de fora; na 1.ª aparecem, porque no intervalo são valores exatos da 1.ª parte.
 */
export function partRows(doc: StatisticsDoc | null, part: StatPart, homeId: string, awayId: string): PartRow[] {
  const usable = part !== 'total' && doc && hasHalves(doc);
  const source: StatisticsDoc | null = !usable ? doc : part === 'first' ? (doc!.firstHalf as StatisticsDoc) : secondHalfDoc(doc!);
  const rows = statRows(source, homeId, awayId).map((r, i) => ({ ...r, key: STAT_ORDER[i]!.key as string }));
  return usable && part === 'second' ? rows.filter((r) => !isRatioStat(r.key)) : rows;
}
