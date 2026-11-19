// Tab MVP (Figma V7.1 4934:7087): selo "Melhor nota" e cor da caixa da nota. As notas comparam-se como aparecem no ecrã
// (uma casa decimal), para que dois jogadores com "8,6" no ecrã tenham ambos o selo.

/** Nota arredondada a uma casa decimal; null sem nota válida. */
export function shownRating(rating: number | null | undefined): number | null {
  if (rating === null || rating === undefined || !Number.isFinite(rating)) return null;
  return Math.round(rating * 10) / 10;
}

/** Ids com a nota máxima (empates incluídos); vazio quando ninguém tem nota. */
export function bestRatedIds(players: { id: string; rating: number | null }[]): Set<string> {
  let best: number | null = null;
  let ids: string[] = [];
  for (const p of players) {
    const r = shownRating(p.rating);
    if (r === null) continue;
    if (best === null || r > best) {
      best = r;
      ids = [p.id];
    } else if (r === best) {
      ids.push(p.id);
    }
  }
  return new Set(ids);
}

export type RatingTone = 'high' | 'mid' | 'low';

/** Caixa da nota: >= 8.0 primary, >= 7.0 surface-20, abaixo surface-10 (sobre a nota como aparece). */
export function ratingTone(rating: number): RatingTone {
  const r = shownRating(rating) ?? 0;
  if (r >= 8) return 'high';
  if (r >= 7) return 'mid';
  return 'low';
}

const POSITION_ABBR: Record<string, string> = {
  G: 'GR', Goalkeeper: 'GR',
  D: 'DEF', Defender: 'DEF',
  M: 'MED', Midfielder: 'MED',
  F: 'AV', Attacker: 'AV',
};

/** Posição abreviada ("GR", "DEF", "MED", "AV"); vazio sem posição ou desconhecida (nunca o texto inglês). */
export function positionAbbr(position: string | null | undefined): string {
  return (position && POSITION_ABBR[position]) || '';
}
