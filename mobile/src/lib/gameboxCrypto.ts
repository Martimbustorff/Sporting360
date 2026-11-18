// Task 23: cifra do número da GameBox, igual à da V2 (gamexmanagement.tsx:68-69 e services/decryptGameBox.ts):
// crypto-js AES com passphrase 'SCP3#$)=:JI)!F5860_' + uid (formato OpenSSL "Salted__", o mesmo do
// react-native-crypto-js da V2), texto `${uid}_${número}`; a decifração tira o prefixo `${uid}_`.
// ATENÇÃO: é ofuscação herdada, não segurança. A passphrase está no código da app e o uid é conhecido; o
// número fica cifrado só para não aparecer em claro na consola nem em exportações. Mantém-se por
// compatibilidade com as GameBox já gravadas pela V2. Nunca enviar o número decifrado para logs,
// Crashlytics ou Analytics.
// Primeiro: o gerador seguro tem de existir antes de o crypto-js carregar (lib/secureRandom).
import '@/lib/secureRandom';
import AES from 'crypto-js/aes';
import Utf8 from 'crypto-js/enc-utf8';

const PASSPHRASE_PREFIX = 'SCP3#$)=:JI)!F5860_';

export function encryptGameboxNumber(number: string, uid: string): string {
  return AES.encrypt(String(`${uid}_${number.trim()}`), PASSPHRASE_PREFIX + uid).toString();
}

/** Vazio, texto inválido ou uid errado devolvem ''. Nunca lança. */
export function decryptGameboxNumber(cipher: string, uid: string): string {
  if (!cipher) return '';
  try {
    const plain = AES.decrypt(cipher, PASSPHRASE_PREFIX + uid).toString(Utf8);
    const prefix = `${uid}_`;
    // A V2 faz replace(uid + "_", ""); com o uid certo o texto começa sempre pelo prefixo.
    return plain.startsWith(prefix) ? plain.slice(prefix.length) : '';
  } catch {
    return '';
  }
}
