// Plano 8, Task 7: referrer da instalação (Play Store) lido uma só vez; só Android; nunca regista o id.
const mockFlags: Record<string, boolean | number> = {};
jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn((opts?: { id?: string }) => ({
    getBoolean: (k: string) => mockFlags[`${opts?.id ?? 'default'}:${k}`],
    getNumber: (k: string) => mockFlags[`${opts?.id ?? 'default'}:${k}`],
    set: (k: string, v: boolean | number) => {
      mockFlags[`${opts?.id ?? 'default'}:${k}`] = v;
    },
  })),
}));
const mockReferrer = jest.fn();
jest.mock('expo-application', () => ({ getInstallReferrerAsync: () => mockReferrer() }));

import { Platform } from 'react-native';
import { readLoanReferrerOnce } from '@/lib/installReferrer';

const ID = 'AbCdEfGhIjKlMnOpQrSt_-'; // 22 caracteres base64url
const setOS = (os: 'android' | 'ios') => Object.defineProperty(Platform, 'OS', { value: os, configurable: true });

beforeEach(() => {
  for (const k of Object.keys(mockFlags)) delete mockFlags[k];
  mockReferrer.mockReset();
  setOS('android');
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('readLoanReferrerOnce', () => {
  it('referrer válido: devolve o id e na segunda chamada devolve null', async () => {
    mockReferrer.mockResolvedValue(`loan=${ID}`);
    expect(await readLoanReferrerOnce()).toBe(ID);
    expect(await readLoanReferrerOnce()).toBeNull();
    expect(mockReferrer).toHaveBeenCalledTimes(1);
  });

  it('o id convive com outros parâmetros do referrer', async () => {
    mockReferrer.mockResolvedValue(`utm_source=share&loan=${ID}&x=1`);
    expect(await readLoanReferrerOnce()).toBe(ID);
  });

  it('sem loan: null e fica marcado como lido', async () => {
    mockReferrer.mockResolvedValue('utm_source=share&utm_campaign=game_1001');
    expect(await readLoanReferrerOnce()).toBeNull();
    mockReferrer.mockResolvedValue(`loan=${ID}`);
    expect(await readLoanReferrerOnce()).toBeNull();
  });

  it.each(['loan=curto', `loan=${ID}x`, 'loan=../../etc/passwd-----', 'loan=', 'loan=%00%01', '', `xloan=${ID}`])('lixo %j: null', async (junk) => {
    mockReferrer.mockResolvedValue(junk);
    expect(await readLoanReferrerOnce()).toBeNull();
  });

  it('erro da API: null, sem rebentar e sem marcar como lido (tenta outra vez no arranque seguinte)', async () => {
    mockReferrer.mockRejectedValueOnce(new Error('SERVICE_UNAVAILABLE'));
    expect(await readLoanReferrerOnce()).toBeNull();
    mockReferrer.mockResolvedValue(`loan=${ID}`);
    expect(await readLoanReferrerOnce()).toBe(ID);
  });

  it('depois de 3 falhas da API desiste: marca como lido e deixa de chamar a API', async () => {
    mockReferrer.mockRejectedValue(new Error('FEATURE_NOT_SUPPORTED'));
    for (let i = 0; i < 3; i++) expect(await readLoanReferrerOnce()).toBeNull();
    expect(mockReferrer).toHaveBeenCalledTimes(3);
    mockReferrer.mockResolvedValue(`loan=${ID}`);
    expect(await readLoanReferrerOnce()).toBeNull();
    expect(mockReferrer).toHaveBeenCalledTimes(3);
  });

  it('iOS: null sem chamar a API', async () => {
    setOS('ios');
    mockReferrer.mockResolvedValue(`loan=${ID}`);
    expect(await readLoanReferrerOnce()).toBeNull();
    expect(mockReferrer).not.toHaveBeenCalled();
  });

  it('nunca regista o id', async () => {
    mockReferrer.mockResolvedValue(`loan=${ID}`);
    await readLoanReferrerOnce();
    const logged = [console.log, console.warn].flatMap((f) => (f as jest.Mock).mock.calls.flat().map(String));
    expect(logged.join(' ')).not.toContain(ID);
  });
});
