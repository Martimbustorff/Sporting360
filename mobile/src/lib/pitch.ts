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
