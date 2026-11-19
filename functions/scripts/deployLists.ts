// Listas de publicação do Plano 2 (Task 20). Os comandos da Task 21 são gerados com `deployArg`;
// `test/unit/exports.test.ts` garante que estas listas batem certo com os exports de `src/index.ts`.

/** Functions de dados (ingestão). Publicadas primeiro em sombra (`LEGACY_COLLECTION_PREFIX=_shadow_`). */
export const DEPLOY_DATA_FUNCTIONS = [
  "footballFixturesSync",
  "footballPostMatchSync",
  "footballLiveTicker",
  "footballStandingsSync",
  "footballSeasonSync",
  "footballWeeklySync",
  "footballPrematchSync",
  "videosSync",
  "newsSync",
  "tweetsSync",
  "apiSportsSync",
  "freeSourcesSync",
] as const;

/** Liquidação antiga dos palpites da V2: só no corte, no mesmo passo em que se apaga `predictionsSettlementScheduler`. */
export const DEPLOY_CUTOVER_FUNCTIONS = ["legacyPredictionSettlement"] as const;

/** Motor de pontos do Plano 1 e callables do Plano 3. Publicados depois das regras. */
export const DEPLOY_ENGINE_FUNCTIONS = [
  "submitPrediction",
  "voteMvp",
  "mvpTallyAggregator",
  "settleScheduler",
  "updateProfile",
  "deleteAccount",
  "linkProviderByEmail",
  "createLoan",
  "claimLoan",
  "cancelLoan",
  "loansMaintenance",
  "onGameboxDeleted",
] as const;

/** Push do Plano 6 que não existiam antes (o ticker e o newsSync já estão nas listas de dados). */
export const DEPLOY_PUSH_FUNCTIONS = ["predictionReminderPush"] as const;

/** Functions antigas da V2 (codebase por omissão, `us-central1`), apagadas por nome no corte. */
export const LEGACY_FUNCTIONS = [
  "gamesSheduler",
  "liveMatchUpdater",
  "summarySheduler",
  "statisticsSheduler",
  "newsSheduler",
  "twitterScheduler",
  "videosSheduler",
  "PlayersSheduler",
  "lineupsheduler",
  "standingsSheduler",
  "predictionsSettlementScheduler",
  "games",
  "backfill",
] as const;

export const LEGACY_REGION = "us-central1";
export const V2027_REGION = "europe-west1";
export const V2027_CODEBASE = "v2027";

/** Todas as functions do codebase v2027. */
export const V2027_FUNCTIONS: readonly string[] = [
  ...DEPLOY_DATA_FUNCTIONS,
  ...DEPLOY_CUTOVER_FUNCTIONS,
  ...DEPLOY_ENGINE_FUNCTIONS,
  ...DEPLOY_PUSH_FUNCTIONS,
];

/** Argumento de `firebase deploy --only`: `functions:v2027:a,functions:v2027:b`. Nunca vazio. */
export function deployArg(names: readonly string[]): string {
  if (names.length === 0) throw new Error("deployArg: lista vazia (publicaria o codebase inteiro)");
  return names.map((n) => `functions:${V2027_CODEBASE}:${n}`).join(",");
}

// `npx tsx scripts/deployLists.ts` imprime os argumentos dos passos da Task 21.
if (require.main === module) {
  /* eslint-disable no-console */
  console.log(`dados (sombra):        ${deployArg(DEPLOY_DATA_FUNCTIONS)}`);
  console.log(`corte:                 ${deployArg([...DEPLOY_DATA_FUNCTIONS, ...DEPLOY_CUTOVER_FUNCTIONS])}`);
  console.log(`motor:                 ${deployArg(DEPLOY_ENGINE_FUNCTIONS)}`);
  console.log(`push:                  ${deployArg(DEPLOY_PUSH_FUNCTIONS)}`);
  console.log(`apagar (${LEGACY_REGION}): ${LEGACY_FUNCTIONS.join(" ")}`);
}
