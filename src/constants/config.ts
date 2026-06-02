// App configuration sourced from EXPO_PUBLIC_* environment variables (.env).
//
// SECURITY NOTE: EXPO_PUBLIC_* values are inlined into the JavaScript bundle
// at build time, so they are NOT secret in the distributed app — anyone can
// extract them from an APK/IPA. They live here (instead of being hardcoded in
// source) to keep secrets out of version control and to allow per-environment
// values and rotation. Truly secret credentials must stay server-side (e.g.
// behind a backend proxy), never in the client.

export const GRAPHQL_URL = process.env.EXPO_PUBLIC_GRAPHQL_URL ?? '';

export const STRAPI_TOKEN = process.env.EXPO_PUBLIC_STRAPI_TOKEN ?? '';

// Prefix combined with the user uuid to build the Gamebox AES passphrase.
//
// Kept as a source constant (not an env var) on purpose: it is a client-side
// obfuscation key that is shipped inside every build regardless, so moving it
// to .env adds no real secrecy — and its special characters (# $ ) !) are
// parsed inconsistently by dotenv, which would silently corrupt Gamebox
// decryption (the season-ticket QR used for stadium entry). Centralised here
// to remove the four duplicated copies that previously lived across screens.
export const GAMEBOX_PASSPHRASE_PREFIX = 'SCP3#$)=:JI)!F5860_';
