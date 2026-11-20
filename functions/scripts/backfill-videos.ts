/* eslint-disable no-console */
// Preenche os vídeos da VSports dos jogos já jogados (a função de 5 em 5 min só olha às últimas 48 h).
// Ferramenta manual; a chave vem só da variável de ambiente VSPORTS_KEY. A VSports não tem quota.
//
//   VSPORTS_KEY=... GOOGLE_CLOUD_PROJECT=scp360-37a74 npx tsx scripts/backfill-videos.ts [--days 120]
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { vsports } from "../src/sources/vsports";
import { syncVideos } from "../src/videos/videosSync";

async function main(): Promise<void> {
  const i = process.argv.indexOf("--days");
  const days = i >= 0 ? Number(process.argv[i + 1]) : 120;
  const key = process.env.VSPORTS_KEY;
  if (!key || !Number.isFinite(days) || days <= 0) {
    console.error("Uso: VSPORTS_KEY=... GOOGLE_CLOUD_PROJECT=<projeto> npx tsx scripts/backfill-videos.ts [--days 120]");
    process.exitCode = 1;
    return;
  }
  if (getApps().length === 0) initializeApp();
  const db = getFirestore();
  db.settings({ ignoreUndefinedProperties: true });
  const out = await syncVideos({ db, vs: vsports({ key }), now: () => new Date(), backMs: days * 24 * 3_600_000 });
  console.log(`Vídeos: ${out.count} gravados; ${out.failed} chamadas falharam.`);
}

main().catch((e) => {
  console.error(String((e as Error).message ?? e));
  process.exitCode = 1;
});
