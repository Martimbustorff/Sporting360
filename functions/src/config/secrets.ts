import { defineSecret, defineString } from "firebase-functions/params";

// Valores lidos em runtime do Secret Manager; nunca no código nem no repositório.
export const RAPIDAPI_KEY = defineSecret("RAPIDAPI_KEY");
export const VSPORTS_KEY = defineSecret("VSPORTS_KEY");
export const TWITTER_BEARER_TOKEN = defineSecret("TWITTER_BEARER_TOKEN");

/** Prefixo das coleções legadas durante o ensaio em sombra (ex.: "_shadow_"); vazio em produção. */
export const LEGACY_COLLECTION_PREFIX = defineString("LEGACY_COLLECTION_PREFIX", { default: "" });

/** Override do id de época da VSports sem novo deploy; vazio = calculado. */
export const VSPORTS_SEASON_ID = defineString("VSPORTS_SEASON_ID", { default: "" });
