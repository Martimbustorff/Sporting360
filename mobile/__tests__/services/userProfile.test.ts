jest.mock('@react-native-firebase/firestore');
jest.mock('@react-native-firebase/crashlytics');
jest.mock('@/services/firebase', () => ({ db: jest.fn(() => ({ __mock: 'firestore' })) }));

import { doc, setDoc } from '@react-native-firebase/firestore';
import { recordError } from '@react-native-firebase/crashlytics';
import { ProfileSaveError, SAVE_TIMEOUT_MS, updateMyProfileFields } from '@/services/userProfile';
import type { ProfilePatch } from '@/lib/profileFields';

beforeEach(() => jest.clearAllMocks());

it('grava só o pedido, em users/{uid}, com merge', async () => {
  await updateMyProfileFields('u1', { seasonSeat: 'A1' });
  expect(doc).toHaveBeenCalledWith(expect.anything(), 'users/u1');
  expect(setDoc).toHaveBeenCalledWith({ __kind: 'doc', path: 'users/u1' }, { seasonSeat: 'A1' }, { merge: true });
});

it.each(['displayName', 'nameChangedAt', 'email'])('recusa %s e não escreve', async (k) => {
  await expect(updateMyProfileFields('u1', { [k]: 'x' } as unknown as ProfilePatch)).rejects.toThrow('Campos não permitidos');
  expect(setDoc).not.toHaveBeenCalled();
});

it('recusa a mistura de chave permitida com proibida', async () => {
  await expect(
    updateMyProfileFields('u1', { seasonSeat: 'A', displayName: 'x' } as unknown as ProfilePatch),
  ).rejects.toThrow();
  expect(setDoc).not.toHaveBeenCalled();
});

it('pedido vazio não escreve', async () => {
  await updateMyProfileFields('u1', {});
  expect(setDoc).not.toHaveBeenCalled();
});

it('unavailable é OFFLINE e não vai ao Crashlytics', async () => {
  (setDoc as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'firestore/unavailable' }));
  await expect(updateMyProfileFields('u1', { seasonSeat: 'A' })).rejects.toMatchObject({ saveCode: 'OFFLINE' });
  expect(recordError).not.toHaveBeenCalled();
});

it('permission-denied é DENIED; outro erro é UNKNOWN e vai ao Crashlytics', async () => {
  (setDoc as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'firestore/permission-denied' }));
  await expect(updateMyProfileFields('u1', { seasonSeat: 'A' })).rejects.toMatchObject({ saveCode: 'DENIED' });
  (setDoc as jest.Mock).mockRejectedValueOnce(new Error('boom'));
  await expect(updateMyProfileFields('u1', { seasonSeat: 'A' })).rejects.toMatchObject({ saveCode: 'UNKNOWN' });
  expect(recordError).toHaveBeenCalledTimes(1);
});

it('escrita pendente (sem rede) passa a OFFLINE após o tempo limite', async () => {
  jest.useFakeTimers();
  try {
    (setDoc as jest.Mock).mockReturnValueOnce(new Promise(() => undefined));
    const p = updateMyProfileFields('u1', { seasonSeat: 'A' });
    const check = expect(p).rejects.toBeInstanceOf(ProfileSaveError);
    await jest.advanceTimersByTimeAsync(SAVE_TIMEOUT_MS);
    await check;
  } finally {
    jest.useRealTimers();
  }
});
