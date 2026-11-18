// Task 23: cifra da GameBox compatível com a V2 (crypto-js AES, formato OpenSSL "Salted__").
import { decryptGameboxNumber, encryptGameboxNumber } from '@/lib/gameboxCrypto';

// Vetor fixo gerado uma vez com a expressão da V2 (gamexmanagement.tsx:68-69):
// CryptoJS.AES.encrypt('u1_266571276572', 'SCP3#$)=:JI)!F5860_u1').toString()
const V2_VECTOR = 'U2FsdGVkX19laDa3sLpkDovA2F5m78U+DLt5cd1AaFo=';

describe('gameboxCrypto', () => {
  it('ida e volta devolve o número', () => {
    expect(decryptGameboxNumber(encryptGameboxNumber('266571276572', 'u1'), 'u1')).toBe('266571276572');
  });

  it('cifra o número sem espaços nas pontas, como a V2', () => {
    expect(decryptGameboxNumber(encryptGameboxNumber('  266571276572 ', 'u1'), 'u1')).toBe('266571276572');
  });

  it('uid errado devolve vazio', () => {
    expect(decryptGameboxNumber(encryptGameboxNumber('266571276572', 'u1'), 'u2')).toBe('');
  });

  it('o vetor da V2 decifra para o número', () => {
    expect(decryptGameboxNumber(V2_VECTOR, 'u1')).toBe('266571276572');
  });

  it('o texto cifrado pela app decifra com o algoritmo da V2 (decryptGameBox.ts)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const CryptoJS = require('crypto-js');
    const uuid = 'u1';
    const cipher = encryptGameboxNumber('266571276572', uuid);
    const v2 = CryptoJS.AES.decrypt(cipher, 'SCP3#$)=:JI)!F5860_' + uuid).toString(CryptoJS.enc.Utf8).replace(uuid + '_', '');
    expect(v2).toBe('266571276572');
    expect(cipher.startsWith('U2FsdGVkX1')).toBe(true);
  });

  it('vazio ou lixo devolve vazio, sem lançar', () => {
    expect(decryptGameboxNumber('', 'u1')).toBe('');
    expect(decryptGameboxNumber('não é base64', 'u1')).toBe('');
    expect(decryptGameboxNumber('U2FsdGVkX1', 'u1')).toBe('');
  });
});

describe('sem crypto.getRandomValues global (Hermes)', () => {
  it('cifra com o gerador do expo-crypto, instalado antes de o crypto-js carregar', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    const fill = jest.fn((a: Uint32Array) => {
      for (let i = 0; i < a.length; i++) a[i] = (i + 1) * 2654435761;
      return a;
    });
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
    try {
      jest.isolateModules(() => {
        jest.doMock('expo-crypto', () => ({ getRandomValues: fill }));
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const m = require('@/lib/gameboxCrypto') as typeof import('@/lib/gameboxCrypto');
        const c = m.encryptGameboxNumber('266571276572', 'u1');
        expect(fill).toHaveBeenCalled();
        expect(m.decryptGameboxNumber(c, 'u1')).toBe('266571276572');
      });
    } finally {
      if (original) Object.defineProperty(globalThis, 'crypto', original);
      jest.dontMock('expo-crypto');
    }
  });
});
