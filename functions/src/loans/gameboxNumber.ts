import { createDecipheriv, createHash } from "node:crypto";
import { normalizeGameboxNumber } from "./number";

// Número guardado em `gamebox/{id}.gameboxNumber`: cifra da V2 (crypto-js AES, passphrase com o uid, formato OpenSSL
// "Salted__", texto `${uid}_${número}`). O sal é aleatório, por isso duas gravações do mesmo número dão textos diferentes:
// para saber se o número mudou é preciso decifrar. Nunca se regista o número nem o texto cifrado.
const PASSPHRASE_PREFIX = "SCP3#$)=:JI)!F5860_";

function evpBytesToKey(pass: Buffer, salt: Buffer, keyLen: number, ivLen: number): { key: Buffer; iv: Buffer } {
  const out: Buffer[] = [];
  let prev = Buffer.alloc(0);
  let len = 0;
  while (len < keyLen + ivLen) {
    prev = createHash("md5").update(Buffer.concat([prev, pass, salt])).digest();
    out.push(prev);
    len += prev.length;
  }
  const all = Buffer.concat(out);
  return { key: all.subarray(0, keyLen), iv: all.subarray(keyLen, keyLen + ivLen) };
}

/** Número em texto de uma GameBox (cifrado pela V2 ou em claro). Ilegível ou de outro uid: "". Nunca lança. */
export function readGameboxNumber(stored: unknown, uid: string): string {
  if (typeof stored !== "string" && typeof stored !== "number") return "";
  const s = String(stored).trim();
  if (s === "") return "";
  const plain = normalizeGameboxNumber(s);
  if (plain) return plain;
  try {
    const raw = Buffer.from(s, "base64");
    if (raw.subarray(0, 8).toString("latin1") !== "Salted__" || raw.length < 32) return "";
    const { key, iv } = evpBytesToKey(Buffer.from(PASSPHRASE_PREFIX + uid, "utf8"), raw.subarray(8, 16), 32, 16);
    const d = createDecipheriv("aes-256-cbc", key, iv);
    const text = Buffer.concat([d.update(raw.subarray(16)), d.final()]).toString("utf8");
    const prefix = `${uid}_`;
    return text.startsWith(prefix) ? (normalizeGameboxNumber(text.slice(prefix.length)) ?? "") : "";
  } catch {
    return "";
  }
}
