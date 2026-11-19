// Task 23: modelo da GameBox. Documentos `gamebox/{auto}` no formato da V2 (gameboxNumber cifrado, gameboxName,
// gameboxPort, gameboxSector, gameboxLine, gameboxSeat, userid, order) e os campos novos do pavilhão
// (pavilionPort, pavilionSector, pavilionLine, pavilionSeat, só quando há pavilhão).
// Também lê a GameBox antiga que a V2 guardava só em users/{uid}.gameboxNumber (cifrada ou em claro,
// v2src utils/returnDefaultGamebox.ts e home.tsx:157-168): mostra-se como "Principal". Nunca se altera users/{uid}.
import type { Loadable } from '@/data/hooks';
import type { GameboxDoc, UserDoc } from '@/data/schemas';
import { decryptGameboxNumber, encryptGameboxNumber } from '@/lib/gameboxCrypto';

export type Seat = { port: string; sector: string; line: string; seat: string };
export type GameboxInput = { number: string; name: string; stadium: Seat; pavilion: Seat | null };
export type GameboxView = GameboxInput & { id: string; order: number };

export const EMPTY_SEAT: Seat = { port: '', sector: '', line: '', seat: '' };

/** Recintos fixos dos lugares da V2 (`gameboxPort...` estádio, `pavilion*` pavilhão); os nomes vêm do Figma 450:5419. */
export const VENUE_NAMES = { stadium: 'José Alvalade', pavilion: 'João Rocha' } as const;

/** Id de rota do formulário: `nova` ou um id de documento do Firestore (ids automáticos: 20 letras e algarismos). */
export function isGameboxRouteId(v: string | undefined | null): v is string {
  return typeof v === 'string' && (v === 'nova' || /^[A-Za-z0-9]{1,64}$/.test(v));
}
export const GAMEBOX_NUMBER_MIN = 6;
export const GAMEBOX_NUMBER_MAX = 20;

/** Tira os espaços; 6 a 20 algarismos, senão null. */
export function normalizeGameboxNumber(raw: string): string | null {
  const n = raw.replace(/\s+/g, '');
  const re = new RegExp(`^\\d{${GAMEBOX_NUMBER_MIN},${GAMEBOX_NUMBER_MAX}}$`);
  return re.test(n) ? n : null;
}

/** Erro do campo do número para o formulário (null se válido ou ainda vazio). */
export function gameboxNumberError(raw: string): 'digits' | 'length' | null {
  const n = raw.replace(/\s+/g, '');
  if (n === '') return null;
  if (!/^\d+$/.test(n)) return 'digits';
  return normalizeGameboxNumber(n) ? null : 'length';
}

/** Lugar sem nenhum campo preenchido. */
export function isEmptySeat(s: Seat): boolean {
  return !s.port.trim() && !s.sector.trim() && !s.line.trim() && !s.seat.trim();
}

/** Nome a mostrar: o guardado ou "GameBox N" (N a partir de 1). */
export function gameboxLabel(name: string, index: number): string {
  return name.trim() || `GameBox ${index + 1}`;
}

const trimSeat = (s: Seat): Seat => ({ port: s.port.trim(), sector: s.sector.trim(), line: s.line.trim(), seat: s.seat.trim() });

export type GameboxWrite = {
  gameboxNumber: string;
  gameboxName: string;
  gameboxPort: string;
  gameboxSector: string;
  gameboxLine: string;
  gameboxSeat: string;
  userid: string;
  order: number;
  pavilionPort?: string;
  pavilionSector?: string;
  pavilionLine?: string;
  pavilionSeat?: string;
};

/** Documento a gravar. Lança se o número não for válido (nunca se cifra lixo). */
export function toGameboxDoc(uid: string, input: GameboxInput, order: number): GameboxWrite {
  const number = normalizeGameboxNumber(input.number);
  if (!number) throw new Error('INVALID_GAMEBOX_NUMBER');
  const st = trimSeat(input.stadium);
  const d: GameboxWrite = {
    gameboxNumber: encryptGameboxNumber(number, uid),
    // Vazio grava-se vazio (como a V2 faz); "GameBox N" é só a etiqueta mostrada (gameboxLabel).
    gameboxName: input.name.trim(),
    gameboxPort: st.port,
    gameboxSector: st.sector,
    gameboxLine: st.line,
    gameboxSeat: st.seat,
    userid: uid,
    order,
  };
  if (input.pavilion && !isEmptySeat(input.pavilion)) {
    const pv = trimSeat(input.pavilion);
    d.pavilionPort = pv.port;
    d.pavilionSector = pv.sector;
    d.pavilionLine = pv.line;
    d.pavilionSeat = pv.seat;
  }
  return d;
}

/**
 * Número guardado (gamebox ou users): cifrado pela V2, ou em claro (a V2 antiga copiava o do perfil sem cifrar).
 * Ilegível ou de outro uid: ''.
 */
export function readStoredGameboxNumber(stored: string | number | undefined | null, uid: string): string {
  if (stored === undefined || stored === null) return '';
  const s = String(stored).trim();
  if (s === '') return '';
  // Números antigos em claro podem ter espaços por dentro ("2665 7127 6572").
  const plain = s.replace(/\s+/g, '');
  if (/^\d+$/.test(plain)) return plain;
  return decryptGameboxNumber(s, uid);
}

const text = (v: unknown): string => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');

export function fromGameboxDoc(doc: GameboxDoc & { id: string }, uid: string): GameboxView {
  const pavilion: Seat = {
    port: text(doc.pavilionPort),
    sector: text(doc.pavilionSector),
    line: text(doc.pavilionLine),
    seat: text(doc.pavilionSeat),
  };
  return {
    id: doc.id,
    number: readStoredGameboxNumber(doc.gameboxNumber, uid),
    name: doc.gameboxName,
    stadium: { port: text(doc.gameboxPort), sector: text(doc.gameboxSector), line: text(doc.gameboxLine), seat: text(doc.gameboxSeat) },
    pavilion: isEmptySeat(pavilion) ? null : pavilion,
    order: doc.order,
  };
}

/** GameBox antiga do perfil da V2 ("Principal"), ou null se não houver número legível. */
export function legacyGameboxFromUser(user: Partial<UserDoc>, uid: string): GameboxInput | null {
  const number = readStoredGameboxNumber(user.gameboxNumber, uid);
  if (!normalizeGameboxNumber(number)) return null;
  return {
    number,
    name: text(user.gameboxName).trim() || 'Principal',
    stadium: { port: text(user.gameboxPort), sector: text(user.gameboxSector), line: text(user.gameboxLine), seat: text(user.gameboxSeat) },
    pavilion: null,
  };
}

type GameboxItem = GameboxDoc & { id: string };
export type GameboxListState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; list: GameboxItem[]; legacy: GameboxInput | null; fromCache: boolean };

/**
 * Regra única da lista e da folha da Home (F26 revisto): sem documentos e com número em users/{uid}.gameboxNumber,
 * a GameBox antiga aparece como "Principal". Sem documentos espera-se pelo perfil antes de dar o vazio.
 */
export function resolveGameboxList(
  boxes: Loadable<GameboxItem[]>,
  user: Loadable<UserDoc>,
  uid: string | null,
): GameboxListState {
  if (!uid || boxes.status === 'loading') return { status: 'loading' };
  if (boxes.status !== 'ready') return { status: 'error' };
  const fromCache = boxes.fromCache === true;
  if (boxes.data.length > 0) return { status: 'ready', list: boxes.data, legacy: null, fromCache };
  if (user.status === 'loading') return { status: 'loading' };
  const legacy = user.status === 'ready' ? legacyGameboxFromUser(user.data, uid) : null;
  return { status: 'ready', list: [], legacy, fromCache };
}

/** Recinto do bilhete: o futebol joga-se no Estádio, as restantes modalidades no Pavilhão. Sem jogo, Estádio. */
export type TicketVenue = 'stadium' | 'pavilion';
export const ticketVenue = (sport: string | null | undefined): TicketVenue => (!sport || sport === 'football' ? 'stadium' : 'pavilion');

/** Lugar guardado para o recinto; o Pavilhão por preencher dá um lugar vazio (nunca o do Estádio). */
export const ticketSeat = (g: Pick<GameboxInput, 'stadium' | 'pavilion'>, venue: TicketVenue): Seat =>
  venue === 'stadium' ? g.stadium : (g.pavilion ?? EMPTY_SEAT);

/** "2665 7127 6572": o número em grupos de quatro, só para mostrar. */
export const groupGameboxNumber = (n: string): string => n.replace(/(\d{4})(?=\d)/g, '$1 ');
