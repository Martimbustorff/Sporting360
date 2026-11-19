// Ligações do clube. Sites: Figma 4922:5959 (5 linhas, na ordem do frame), URLs da V2 (constants/ClubSites.ts).
// A 5.ª linha "Gameback" entrou a 19/11 por decisão do Martim (frame 03).
export type ClubSite = { id: 'sporting' | 'minuto' | 'loja' | 'bilheteira' | 'gameback'; label: string; url: string };

export const CLUB_SITES: readonly ClubSite[] = [
  { id: 'sporting', label: 'Site do Sporting', url: 'https://www.sporting.pt/pt' },
  { id: 'minuto', label: 'Sporting num Minuto', url: 'https://sportingnumminuto.pt/pt' },
  { id: 'loja', label: 'Loja Verde', url: 'https://lojaverde.sporting.pt/pt' },
  { id: 'bilheteira', label: 'Bilheteira Online', url: 'https://tickets.sporting.pt/' },
  { id: 'gameback', label: 'Gameback', url: 'https://gamebox.sporting.pt/estadio/gameback' },
];

// Figma 450:5254 (lista por baixo do mapa). O Museu saiu da lista (decisão do Martim, 18/11).
export type StadiumLink = { id: 'loja' | 'bilheteira'; label: string; url: string };

export const STADIUM_LINKS: readonly StadiumLink[] = [
  { id: 'loja', label: 'Loja Verde', url: 'https://lojaverde.sporting.pt/pt' },
  { id: 'bilheteira', label: 'Bilheteira', url: 'https://tickets.sporting.pt/' },
];

const HTTPS_URL = /^https:\/\/[^\s/?#]+/i;

/** Só https abre; qualquer outro esquema (ou texto) é ignorado. */
export function isHttps(url: string | null | undefined): url is string {
  return typeof url === 'string' && HTTPS_URL.test(url);
}
