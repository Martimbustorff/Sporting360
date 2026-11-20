// Formações: funções puras sobre `details/lineups` e `details/players` (Plano 2, liveTicker). Sem React nem Firestore.
import type { LineupPlayer, PlayersDoc } from '@/data/schemas';

const POS_ORDER = ['G', 'D', 'M', 'F'] as const;

function parseGrid(grid: string | null): { row: number; col: number } | null {
  const m = grid ? /^(\d+):(\d+)$/.exec(grid.trim()) : null;
  return m ? { row: Number(m[1]), col: Number(m[2]) } : null;
}

/**
 * Linhas do onze, do guarda-redes para a frente. Com `grid` "linha:coluna" em todos agrupa por linha (asc) e ordena
 * por coluna; se faltar a algum, agrupa por `pos` na ordem G, D, M, F (pos desconhecida numa última linha).
 */
export function pitchRows(xi: LineupPlayer[]): LineupPlayer[][] {
  const grids = xi.map((p) => parseGrid(p.grid));
  if (grids.every((g) => g !== null)) {
    const byRow = new Map<number, { col: number; p: LineupPlayer }[]>();
    xi.forEach((p, i) => {
      const g = grids[i]!;
      byRow.set(g.row, [...(byRow.get(g.row) ?? []), { col: g.col, p }]);
    });
    return [...byRow.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, items]) => items.sort((a, b) => a.col - b.col).map((x) => x.p));
  }
  const known = new Set<string>(POS_ORDER);
  const rows = POS_ORDER.map((pos) => xi.filter((p) => p.pos === pos));
  rows.push(xi.filter((p) => !p.pos || !known.has(p.pos)));
  return rows.filter((r) => r.length > 0);
}

/** Nota do jogador com uma casa decimal e vírgula ("7,3"); null sem documento, jogador ou nota. */
export function ratingOf(players: PlayersDoc | null, playerId: string): string | null {
  if (!players) return null;
  for (const t of players.teams) {
    const line = t.players.find((p) => p.playerId === playerId);
    if (line) return line.rating == null || !Number.isFinite(line.rating) ? null : line.rating.toFixed(1).replace('.', ',');
  }
  return null;
}

/** Notas de todos os jogadores do documento, por `playerId`. */
export function ratingsMap(players: PlayersDoc | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of players?.teams ?? []) {
    for (const p of t.players) {
      const r = ratingOf(players, p.playerId);
      if (r) out[p.playerId] = r;
    }
  }
  return out;
}

/**
 * Apelido na camisola: tira as iniciais do formato da API ("G. Inácio" → "Inácio", "P. Gonçalves dos Santos" fica
 * com os apelidos todos); um nome completo sem iniciais fica com o último apelido.
 */
export function pitchName(name: string): string {
  const words = name.trim().split(/\s+/);
  const firstReal = words.findIndex((w) => !/^\p{L}\.$/u.test(w));
  if (firstReal > 0) return words.slice(firstReal).join(' ');
  return words[words.length - 1] ?? name;
}

/** Nota como número (7,25 vira 7.3 por arredondamento a uma casa); sem nota válida não há entrada. */
export function ratingNumbers(players: PlayersDoc | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of players?.teams ?? []) {
    for (const p of t.players) {
      if (p.rating != null && Number.isFinite(p.rating)) out[p.playerId] = Math.round(p.rating * 10) / 10;
    }
  }
  return out;
}

/** Fotos da API por `playerId` (campo `photo` do documento `players`). */
export function photosMap(players: PlayersDoc | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of players?.teams ?? []) for (const p of t.players) if (p.photo) out[p.playerId] = p.photo;
  return out;
}

/** Nota a partir da qual o selo fica a `primary` (Figma 4947:8598). */
export const TOP_RATING = 8;

/** Texto "entrou aos 67'" / "entrou aos 90+2'". */
export function enteredText(minute: number, extra: number | null): string {
  return `entrou aos ${minute}${extra ? `+${extra}` : ''}'`;
}

/**
 * Posição vertical de cada linha no relvado, de cima (avançados) para baixo (guarda-redes), em fração da altura.
 * 20/11 (Martim): os médios ficam na linha do meio-campo, o guarda-redes junto à baliza e a defesa à frente dele; antes
 * as linhas espalhavam-se pelo relvado todo e um 4-3-3 ficava com buracos. As linhas do meio centram-se em 0,5.
 */
export function pitchRowPositions(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [0.5];
  if (n === 2) return [0.5, 0.94];
  if (n === 3) return [0.2, 0.72, 0.94];
  const middle = n - 3;
  const step = Math.min(0.15, 0.36 / middle);
  const mids = Array.from({ length: middle }, (_, k) => 0.5 + (k - (middle - 1) / 2) * step);
  // Avançados acima do meio-campo, com pelo menos um passo de distância à linha de cima do meio.
  const top = Math.min(0.2, (mids[0] ?? 0.5) - step);
  return [top, ...mids.map((x) => x), 0.74, 0.94].slice(0, n);
}
