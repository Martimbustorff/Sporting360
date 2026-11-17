/* eslint-disable no-console */
// Preenche uma época de futebol: jogos terminados, completos, com `force` (ignora os hashes guardados).
// Ferramenta manual; a chave vem só da variável de ambiente RAPIDAPI_KEY.
//
//   RAPIDAPI_KEY=... GOOGLE_CLOUD_PROJECT=scp360-37a74 npx tsx scripts/backfill-season.ts --season 2026 [--new-model-only] [--prefix _shadow_]
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { backfillFinished } from "../src/football/fixturesSync";
import { apiFootball } from "../src/sources/apiFootball";

const HELP = `Uso: npx tsx scripts/backfill-season.ts --season <ano> [opções]

  --season <ano>      ano de início da época (ex.: 2026)
  --new-model-only    escreve só o modelo novo (matches e details), não as coleções antigas
  --prefix <p>        prefixo das coleções antigas (ex.: _shadow_); omitido = coleções reais
  --help              esta ajuda

Precisa de RAPIDAPI_KEY no ambiente e de credenciais Firebase (GOOGLE_APPLICATION_CREDENTIALS
ou FIRESTORE_EMULATOR_HOST). Gasta 1 pedido por época mais 1 por cada 20 jogos terminados.`;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  if (process.argv.includes("--help")) return void console.log(HELP);
  const season = arg("--season");
  const key = process.env.RAPIDAPI_KEY;
  if (!season || !/^\d{4}$/.test(season) || !key) {
    console.error(HELP);
    process.exitCode = 1;
    return;
  }
  if (getApps().length === 0) initializeApp();
  const db = getFirestore();
  db.settings({ ignoreUndefinedProperties: true });
  const api = apiFootball({ key });
  const out = await backfillFinished(
    { db, api, now: () => new Date(), prefix: arg("--prefix") ?? "" },
    season,
    { newModelOnly: process.argv.includes("--new-model-only") },
  );
  console.log(`Época ${season}: ${out.count} jogos escritos; ${api.calls} pedidos; restam ${out.remaining ?? "?"}.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
