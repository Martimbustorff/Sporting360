// Task 23: modelo da GameBox (documentos da V2, campos novos do pavilhão, GameBox "Principal" em users/{uid}).
import {
  fromGameboxDoc,
  gameboxLabel,
  legacyGameboxFromUser,
  normalizeGameboxNumber,
  readStoredGameboxNumber,
  resolveGameboxList,
  toGameboxDoc,
  type GameboxInput,
} from '@/lib/gamebox';
import { decryptGameboxNumber, encryptGameboxNumber } from '@/lib/gameboxCrypto';
import type { GameboxDoc } from '@/data/schemas';

const V2_VECTOR = 'U2FsdGVkX19laDa3sLpkDovA2F5m78U+DLt5cd1AaFo=';
const STADIUM = { port: '5', sector: 'A27', line: '18', seat: '24' };

describe('normalizeGameboxNumber', () => {
  it('tira espaços', () => {
    expect(normalizeGameboxNumber(' 2665 7127 6572 ')).toBe('266571276572');
  });
  it('recusa letras', () => {
    expect(normalizeGameboxNumber('abc')).toBeNull();
    expect(normalizeGameboxNumber('2665a7127')).toBeNull();
  });
  it('aceita 6 a 20 algarismos', () => {
    expect(normalizeGameboxNumber('12345')).toBeNull();
    expect(normalizeGameboxNumber('123456')).toBe('123456');
    expect(normalizeGameboxNumber('1'.repeat(20))).toBe('1'.repeat(20));
    expect(normalizeGameboxNumber('1'.repeat(21))).toBeNull();
    expect(normalizeGameboxNumber('')).toBeNull();
  });
});

describe('toGameboxDoc', () => {
  const input: GameboxInput = { number: '266571276572', name: 'João', stadium: STADIUM, pavilion: null };

  it('sem pavilhão tem só os campos da V2, com o número cifrado', () => {
    const d = toGameboxDoc('u1', input, 2);
    expect(Object.keys(d).sort()).toEqual(
      ['gameboxLine', 'gameboxName', 'gameboxNumber', 'gameboxPort', 'gameboxSeat', 'gameboxSector', 'order', 'userid'].sort(),
    );
    expect(Object.keys(d).some((k) => k.startsWith('pavilion'))).toBe(false);
    expect(d).toMatchObject({ gameboxName: 'João', gameboxPort: '5', gameboxSector: 'A27', gameboxLine: '18', gameboxSeat: '24', userid: 'u1', order: 2 });
    expect(d.gameboxNumber).not.toContain('266571276572');
    expect(decryptGameboxNumber(d.gameboxNumber, 'u1')).toBe('266571276572');
  });

  it('com pavilhão acrescenta os quatro campos novos', () => {
    const d = toGameboxDoc('u1', { ...input, pavilion: { port: '1', sector: 'A1', line: '5', seat: '5' } }, 1);
    expect(d).toMatchObject({ pavilionPort: '1', pavilionSector: 'A1', pavilionLine: '5', pavilionSeat: '5' });
  });

  it('limpa espaços e grava nome vazio quando vem vazio (a etiqueta "Gamebox N" é só da interface)', () => {
    const d = toGameboxDoc('u1', { number: ' 2665 7127 6572 ', name: '  ', stadium: { port: ' 5 ', sector: '', line: '', seat: '' }, pavilion: null }, 3);
    expect(d.gameboxName).toBe('');
    expect(d.gameboxPort).toBe('5');
    expect(decryptGameboxNumber(d.gameboxNumber, 'u1')).toBe('266571276572');
  });

  it('número inválido lança e nunca cifra lixo', () => {
    expect(() => toGameboxDoc('u1', { ...input, number: 'abc' }, 1)).toThrow();
  });
});

describe('fromGameboxDoc', () => {
  const base: GameboxDoc & { id: string } = {
    id: 'g1',
    userid: 'u1',
    gameboxNumber: V2_VECTOR,
    gameboxName: 'João',
    gameboxPort: '5',
    gameboxSector: 'A27',
    gameboxLine: '18',
    gameboxSeat: '24',
    order: 1,
    default: false,
  };

  it('decifra o número da V2 e não tem pavilhão', () => {
    expect(fromGameboxDoc(base, 'u1')).toEqual({
      id: 'g1',
      number: '266571276572',
      name: 'João',
      stadium: STADIUM,
      pavilion: null,
      order: 1,
    });
  });

  it('lê o pavilhão quando existe', () => {
    const v = fromGameboxDoc({ ...base, pavilionPort: '1', pavilionSector: 'A1' }, 'u1');
    expect(v.pavilion).toEqual({ port: '1', sector: 'A1', line: '', seat: '' });
  });

  it('número em claro (cópia antiga da V2 a partir do perfil) lê-se como está', () => {
    expect(fromGameboxDoc({ ...base, gameboxNumber: ' 266571276572' }, 'u1').number).toBe('266571276572');
  });

  it('número de outro uid fica vazio', () => {
    expect(fromGameboxDoc({ ...base, gameboxNumber: encryptGameboxNumber('123456', 'u2') }, 'u1').number).toBe('');
  });

  it('campos em falta ficam vazios', () => {
    const v = fromGameboxDoc({ id: 'g2', userid: 'u1', gameboxNumber: V2_VECTOR, gameboxName: '', order: 0, default: false }, 'u1');
    expect(v.stadium).toEqual({ port: '', sector: '', line: '', seat: '' });
  });
});

describe('readStoredGameboxNumber', () => {
  it('cifrado, em claro, numérico ou ausente', () => {
    expect(readStoredGameboxNumber(V2_VECTOR, 'u1')).toBe('266571276572');
    expect(readStoredGameboxNumber('266571276572', 'u1')).toBe('266571276572');
    expect(readStoredGameboxNumber(266571276572, 'u1')).toBe('266571276572');
    expect(readStoredGameboxNumber(undefined, 'u1')).toBe('');
    expect(readStoredGameboxNumber('', 'u1')).toBe('');
  });

  it('número antigo em claro com espaços por dentro: tira os espaços', () => {
    expect(readStoredGameboxNumber('2665 7127 6572', 'u1')).toBe('266571276572');
    expect(readStoredGameboxNumber(' 266 571\t276572 ', 'u1')).toBe('266571276572');
    expect(legacyGameboxFromUser({ gameboxNumber: '2665 7127 6572' }, 'u1')?.number).toBe('266571276572');
  });
});

describe('legacyGameboxFromUser', () => {
  it('GameBox só no perfil (cifrada) vira "Principal"', () => {
    expect(legacyGameboxFromUser({ gameboxNumber: V2_VECTOR }, 'u1')).toEqual({
      number: '266571276572',
      name: 'Principal',
      stadium: { port: '', sector: '', line: '', seat: '' },
      pavilion: null,
    });
  });

  it('em claro, com nome e lugar guardados no perfil', () => {
    const v = legacyGameboxFromUser(
      { gameboxNumber: '266571276572', gameboxName: 'Casa', gameboxPort: 5, gameboxSector: 'A27', gameboxLine: '18', gameboxSeat: '24' },
      'u1',
    );
    expect(v).toEqual({ number: '266571276572', name: 'Casa', stadium: STADIUM, pavilion: null });
  });

  it('sem número, número ilegível ou de outro uid: nada', () => {
    expect(legacyGameboxFromUser({}, 'u1')).toBeNull();
    expect(legacyGameboxFromUser({ gameboxNumber: '' }, 'u1')).toBeNull();
    expect(legacyGameboxFromUser({ gameboxNumber: encryptGameboxNumber('123456', 'u2') }, 'u1')).toBeNull();
  });
});

describe('resolveGameboxList', () => {
  const doc = { id: 'g1', userid: 'u1', gameboxNumber: V2_VECTOR, gameboxName: '', order: 1 } as GameboxDoc & { id: string };
  const ready = <T,>(data: T) => ({ status: 'ready' as const, data });
  it('a carregar, sem uid ou com documentos vazios e perfil a carregar', () => {
    expect(resolveGameboxList({ status: 'loading' }, ready({}), 'u1').status).toBe('loading');
    expect(resolveGameboxList(ready([doc]), ready({}), null).status).toBe('loading');
    expect(resolveGameboxList(ready([]), { status: 'loading' }, 'u1').status).toBe('loading');
  });
  it('erro de leitura da lista', () => {
    expect(resolveGameboxList({ status: 'error', error: new Error('x') }, ready({}), 'u1').status).toBe('error');
  });
  it('com documentos ignora o perfil; sem documentos usa o "Principal" do perfil', () => {
    expect(resolveGameboxList(ready([doc]), ready({ gameboxNumber: V2_VECTOR }), 'u1')).toMatchObject({ status: 'ready', list: [doc], legacy: null });
    expect(resolveGameboxList(ready([]), ready({ gameboxNumber: V2_VECTOR }), 'u1')).toMatchObject({
      status: 'ready',
      list: [],
      legacy: { name: 'Principal', number: '266571276572' },
    });
    expect(resolveGameboxList(ready([]), { status: 'error', error: new Error('x') }, 'u1')).toMatchObject({ status: 'ready', legacy: null });
  });
});

describe('gameboxLabel', () => {
  it('usa o nome ou "Gamebox N"', () => {
    expect(gameboxLabel('João', 0)).toBe('João');
    expect(gameboxLabel('', 1)).toBe('Gamebox 2');
    expect(gameboxLabel('   ', 0)).toBe('Gamebox 1');
  });
});
