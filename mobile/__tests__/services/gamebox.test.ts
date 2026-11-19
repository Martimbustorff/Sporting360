// Task 23: gravar e apagar GameBox (coleção gamebox, só o dono pelas regras).
jest.mock('@react-native-firebase/firestore');
jest.mock('@react-native-firebase/crashlytics');
jest.mock('@/services/firebase', () => ({ db: jest.fn(() => ({ __mock: 'firestore' })) }));

import { deleteDoc, doc, setDoc, updateDoc } from '@react-native-firebase/firestore';
import { recordError } from '@react-native-firebase/crashlytics';
import { decryptGameboxNumber } from '@/lib/gameboxCrypto';
import type { GameboxInput } from '@/lib/gamebox';
import { deleteGamebox, GAMEBOX_SAVE_TIMEOUT_MS, reorderGameboxes, saveGamebox } from '@/services/gamebox';

const INPUT: GameboxInput = {
  number: '266571276572',
  name: 'João',
  stadium: { port: '5', sector: 'A27', line: '18', seat: '24' },
  pavilion: null,
};

beforeEach(() => jest.clearAllMocks());

describe('saveGamebox', () => {
  it('nova: documento com id gerado, campos da V2 e a ordem pedida', async () => {
    const id = await saveGamebox('u1', INPUT, undefined, 3);
    expect(id).toMatch(/^auto/);
    const [ref, data] = (setDoc as jest.Mock).mock.calls[0];
    expect(ref.path).toBe(`gamebox/${id}`);
    expect(data).toMatchObject({ userid: 'u1', order: 3, gameboxName: 'João', gameboxPort: '5' });
    expect(decryptGameboxNumber(data.gameboxNumber, 'u1')).toBe('266571276572');
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('existente: atualiza o documento, mantém a ordem e apaga o pavilhão retirado', async () => {
    const id = await saveGamebox('u1', INPUT, { id: 'g1', order: 2 });
    expect(id).toBe('g1');
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'gamebox/g1');
    const [ref, data] = (updateDoc as jest.Mock).mock.calls[0];
    expect(ref.path).toBe('gamebox/g1');
    expect(data).toMatchObject({ userid: 'u1', order: 2 });
    for (const k of ['pavilionPort', 'pavilionSector', 'pavilionLine', 'pavilionSeat']) {
      expect(data[k]).toEqual({ __kind: 'deleteField' });
    }
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('existente com pavilhão grava os campos do pavilhão', async () => {
    await saveGamebox('u1', { ...INPUT, pavilion: { port: '1', sector: 'A1', line: '5', seat: '5' } }, { id: 'g1', order: 1 });
    expect((updateDoc as jest.Mock).mock.calls[0][1]).toMatchObject({ pavilionPort: '1', pavilionSeat: '5' });
  });

  it('número inválido rejeita sem escrever', async () => {
    await expect(saveGamebox('u1', { ...INPUT, number: 'abc' })).rejects.toMatchObject({ saveCode: 'INVALID' });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('unavailable é OFFLINE sem id (a escrita não ficou na fila) e não vai ao Crashlytics', async () => {
    (setDoc as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'firestore/unavailable' }));
    const e = await saveGamebox('u1', INPUT).catch((x: unknown) => x);
    expect(e).toMatchObject({ saveCode: 'OFFLINE' });
    expect((e as { id?: string }).id).toBeUndefined();
    expect(recordError).not.toHaveBeenCalled();
  });

  it('tempo limite: OFFLINE com o id reservado; repetir faz setDoc completo no mesmo id, nunca updateDoc', async () => {
    jest.useFakeTimers();
    (setDoc as jest.Mock).mockReturnValueOnce(new Promise(() => {}));
    const p = saveGamebox('u1', INPUT, undefined, 2).catch((x: unknown) => x);
    jest.advanceTimersByTime(GAMEBOX_SAVE_TIMEOUT_MS);
    const e = (await p) as { saveCode: string; id?: string };
    jest.useRealTimers();
    expect(e.saveCode).toBe('OFFLINE');
    const firstRef = (setDoc as jest.Mock).mock.calls[0][0];
    expect(e.id).toBe(firstRef.id);

    const id = await saveGamebox('u1', INPUT, undefined, 2, e.id);
    expect(id).toBe(e.id);
    const [ref, data] = (setDoc as jest.Mock).mock.calls[1];
    expect(ref.path).toBe(`gamebox/${e.id}`);
    expect(Object.keys(data).sort()).toEqual(Object.keys((setDoc as jest.Mock).mock.calls[0][1]).sort());
    expect(data).toMatchObject({ userid: 'u1', order: 2, gameboxName: 'João' });
    expect(decryptGameboxNumber(data.gameboxNumber, 'u1')).toBe('266571276572');
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it.each(['firestore/permission-denied', 'internal'])('%s numa nova não devolve id para reutilizar', async (code) => {
    (setDoc as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('x'), { code }));
    const e = (await saveGamebox('u1', INPUT).catch((x: unknown) => x)) as { saveCode: string; id?: string };
    expect(['DENIED', 'UNKNOWN']).toContain(e.saveCode);
    expect(e.id).toBeUndefined();
    // A tentativa seguinte começa do zero: id novo, setDoc, sem updateDoc.
    const id = await saveGamebox('u1', INPUT, undefined, 1, e.id);
    expect(id).not.toBe((setDoc as jest.Mock).mock.calls[0][0].id);
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('escrita pendente passa a OFFLINE após o tempo limite', async () => {
    jest.useFakeTimers();
    (setDoc as jest.Mock).mockReturnValueOnce(new Promise(() => {}));
    const p = saveGamebox('u1', INPUT);
    const assertion = expect(p).rejects.toMatchObject({ saveCode: 'OFFLINE' });
    jest.advanceTimersByTime(GAMEBOX_SAVE_TIMEOUT_MS);
    await assertion;
    jest.useRealTimers();
  });

  it('erro desconhecido vai ao Crashlytics só com o código, nunca com o número', async () => {
    (updateDoc as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('falhou 266571276572'), { code: 'internal' }));
    await expect(saveGamebox('u1', INPUT, { id: 'g1', order: 1 })).rejects.toMatchObject({ saveCode: 'UNKNOWN' });
    expect(recordError).toHaveBeenCalledTimes(1);
    const reported = (recordError as jest.Mock).mock.calls[0][1] as Error;
    expect(reported.message).not.toContain('266571276572');
  });
});

describe('deleteGamebox', () => {
  it('apaga gamebox/{id}', async () => {
    await deleteGamebox('g1');
    expect((deleteDoc as jest.Mock).mock.calls[0][0].path).toBe('gamebox/g1');
  });

  it('permission-denied é DENIED', async () => {
    (deleteDoc as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'firestore/permission-denied' }));
    await expect(deleteGamebox('g1')).rejects.toMatchObject({ saveCode: 'DENIED' });
  });
});

describe('reorderGameboxes', () => {
  it('grava só o campo order (1..n) nos documentos que mudaram', async () => {
    await reorderGameboxes(['b', 'a', 'c'], { a: 1, b: 2, c: 3 });
    const calls = (updateDoc as jest.Mock).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls.map((c) => [c[0].path, c[1]])).toEqual([
      ['gamebox/b', { order: 1 }],
      ['gamebox/a', { order: 2 }],
    ]);
  });
  it('sem mudanças não escreve', async () => {
    await reorderGameboxes(['a', 'b'], { a: 1, b: 2 });
    expect(updateDoc).not.toHaveBeenCalled();
  });
  it('permission-denied é DENIED', async () => {
    (updateDoc as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'firestore/permission-denied' }));
    await expect(reorderGameboxes(['b', 'a'], { a: 1, b: 2 })).rejects.toMatchObject({ saveCode: 'DENIED' });
  });
});
