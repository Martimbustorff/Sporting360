// Task 23: o crypto-js precisa de `globalThis.crypto.getRandomValues` para o sal do AES e lê-o UMA vez, quando o
// módulo carrega; o Hermes não o tem. Este módulo tem de ser importado antes de qualquer `crypto-js/*`
// (ver lib/gameboxCrypto.ts). Usa o gerador seguro do expo-crypto; não faz nada onde já existe (Jest, web).
import { getRandomValues } from 'expo-crypto';

type CryptoLike = { getRandomValues?: (a: Uint32Array) => Uint32Array };
const g = globalThis as { crypto?: CryptoLike };
if (typeof g.crypto?.getRandomValues !== 'function') {
  const polyfill = { getRandomValues: (a: Uint32Array) => getRandomValues(a) };
  g.crypto = g.crypto ? Object.assign(g.crypto, polyfill) : polyfill;
}

export {};
