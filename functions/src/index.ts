import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { LEGACY_COLLECTION_PREFIX, NEWS_LEGACY_CONTENT, PUSH_ENABLED, RAPIDAPI_KEY, TWITTER_BEARER_TOKEN, VSPORTS_KEY, VSPORTS_SEASON_ID } from "./config/secrets";
import { syncCompetitions, syncStandings } from "./football/competitionSync";
import { LIVE_REQUEST_TIMEOUT_MS, liveTickerJob } from "./football/liveTicker";
import { syncPrematch } from "./football/prematchSync";
import { syncTeamDaily, syncTeamWeekly } from "./football/teamSync";
import { refreshRecent, syncFixtures, type FootballDeps } from "./football/fixturesSync";
import { runApiSportsJob } from "./modalities/apiSportsSync";
import { syncFreeSources } from "./modalities/freeSourcesSync";
import { syncNews } from "./news/newsSync";
import { runPredictionReminder } from "./push/predictionReminder";
import { fcmSender } from "./push/sender";
import { syncTweets } from "./social/tweetsSync";
import { settleLegacyPredictionsIfProduction } from "./legacy/predictionSettlement";
import { settleRun } from "./scheduled/settle";
import { aggregateMvpTallies } from "./scheduled/mvpTallyAggregator";
import { apiFootball } from "./sources/apiFootball";
import { apiSports } from "./sources/apiSports";
import { twitter } from "./sources/twitter";
import { vsports } from "./sources/vsports";
import { runJob } from "./store/health";
import { syncVideos } from "./videos/videosSync";

if (getApps().length === 0) initializeApp();
getFirestore().settings({ ignoreUndefinedProperties: true });

export { submitPrediction } from "./callables/submitPrediction";
export { voteMvp } from "./callables/voteMvp";
export { updateProfile } from "./callables/updateProfile";
export { deleteAccount } from "./callables/deleteAccount";
export { linkProviderByEmail } from "./callables/linkProviderByEmail";

export const settleScheduler = onSchedule(
  { schedule: "every 10 minutes", region: "europe-west1", timeZone: "Europe/Lisbon", timeoutSeconds: 540, memory: "512MiB" },
  async () => {
    await runJob(getFirestore(), "settle", () => settleRun(getFirestore(), new Date()));
  },
);

// Lembrete de prognóstico (Plano 6): 2 h antes do kickoff, por token, só a quem ainda não prognosticou.
// Com PUSH_ENABLED falso sai logo, sem ler nem escrever nada.
export const predictionReminderPush = onSchedule(
  {
    schedule: "every 5 minutes",
    region: "europe-west1",
    timeZone: "Europe/Lisbon",
    timeoutSeconds: 300,
    maxInstances: 1,
    concurrency: 1,
    retryCount: 0,
  },
  async () => {
    if (!PUSH_ENABLED.value()) return;
    const db = getFirestore();
    await runJob(db, "push_prediction_reminder", () => runPredictionReminder(db, fcmSender(getMessaging()), new Date()));
  },
);

// Contagem do MVP: soma os shards de `mvpTallies/{gameId}/shards` no documento pai que a app lê.
// Único escritor do pai; maxInstances 1 + concurrency 1 para duas execuções nunca se sobreporem.
export const mvpTallyAggregator = onSchedule(
  {
    schedule: "every 1 minutes",
    region: "europe-west1",
    timeZone: "Europe/Lisbon",
    timeoutSeconds: 60,
    maxInstances: 1,
    concurrency: 1,
    retryCount: 0,
  },
  async () => {
    await runJob(getFirestore(), "mvp_tally", () => aggregateMvpTallies(getFirestore(), new Date()));
  },
);

const footballDeps = (): FootballDeps => ({
  db: getFirestore(),
  api: apiFootball({ key: RAPIDAPI_KEY.value() }),
  now: () => new Date(),
});

export const footballFixturesSync = onSchedule(
  { schedule: "every 3 hours", region: "europe-west1", timeZone: "Europe/Lisbon", timeoutSeconds: 300, secrets: [RAPIDAPI_KEY] },
  async () => {
    await runJob(getFirestore(), "football_fixtures", () => syncFixtures(footballDeps()), { expectNonZero: true, minRemaining: 500 });
  },
);

export const footballPostMatchSync = onSchedule(
  { schedule: "0 9 * * *", region: "europe-west1", timeZone: "Europe/Lisbon", timeoutSeconds: 300, secrets: [RAPIDAPI_KEY] },
  async () => {
    await runJob(getFirestore(), "football_postmatch", () => refreshRecent(footballDeps()), { minRemaining: 500 });
  },
);

// Classificações e, na mesma execução, rondas, calendário e tops de cada competição. Dois runJob
// separados: cada fonte regista a sua saúde e a falha de uma não esconde a outra.
export const footballStandingsSync = onSchedule(
  { schedule: "every 6 hours", region: "europe-west1", timeZone: "Europe/Lisbon", timeoutSeconds: 540, secrets: [RAPIDAPI_KEY] },
  async () => {
    await runJob(getFirestore(), "football_standings", () => syncStandings(footballDeps()), { minRemaining: 500 });
    await runJob(getFirestore(), "football_competitions", () => syncCompetitions(footballDeps()), { minRemaining: 500 });
  },
);

// Task 9 já corre syncCompetitions de 6 em 6 horas: aqui só a equipa.
export const footballSeasonSync = onSchedule(
  { schedule: "0 5 * * *", region: "europe-west1", timeZone: "Europe/Lisbon", timeoutSeconds: 300, secrets: [RAPIDAPI_KEY] },
  async () => {
    await runJob(getFirestore(), "football_team_daily", () => syncTeamDaily(footballDeps()), { expectNonZero: true, minRemaining: 500 });
  },
);

export const footballWeeklySync = onSchedule(
  { schedule: "30 5 * * 1", region: "europe-west1", timeZone: "Europe/Lisbon", timeoutSeconds: 300, secrets: [RAPIDAPI_KEY] },
  async () => {
    await runJob(getFirestore(), "football_team_weekly", () => syncTeamWeekly(footballDeps()), { minRemaining: 500 });
  },
);

export const footballPrematchSync = onSchedule(
  { schedule: "every 6 hours", region: "europe-west1", timeZone: "Europe/Lisbon", timeoutSeconds: 300, secrets: [RAPIDAPI_KEY] },
  async () => {
    await runJob(getFirestore(), "football_prematch", () => syncPrematch(footballDeps()), { minRemaining: 500 });
  },
);

// Ticker ao vivo: cada minuto lê a janela de jogos; só pede à API com um jogo em prematch/live/postmatch
// (até 4 pedidos por minuto, de 15 em 15 s, com jogo a decorrer). Sem retry: o minuto seguinte é o retry.
// concurrency 1 + maxInstances 1: duas invocações nunca correm ao mesmo tempo (a seguinte é recusada,
// não fica em paralelo); pedidos com timeout de 5 s para cada tick acabar antes do minuto seguinte.
export const footballLiveTicker = onSchedule(
  {
    schedule: "every 1 minutes",
    region: "europe-west1",
    timeZone: "Europe/Lisbon",
    timeoutSeconds: 75,
    maxInstances: 1,
    concurrency: 1,
    retryCount: 0,
    secrets: [RAPIDAPI_KEY],
  },
  async () => {
    await liveTickerJob(
      {
        ...footballDeps(),
        api: apiFootball({ key: RAPIDAPI_KEY.value(), timeoutMs: LIVE_REQUEST_TIMEOUT_MS }),
        sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
        // Push de MVP só com PUSH_ENABLED (desligado até ao lançamento da V7.1).
        push: PUSH_ENABLED.value() ? fcmSender(getMessaging()) : undefined,
      },
      { minRemaining: 500 },
    );
  },
);

// Vídeos da VSports (golos, resumo, flash interviews): 5 em 5 min; a própria função decide se há jogo
// a seguir (sem jogo nas últimas 48 h faz 0 chamadas). A VSports não tem quota: sem `remaining`.
export const videosSync = onSchedule(
  { schedule: "every 5 minutes", region: "europe-west1", timeZone: "Europe/Lisbon", timeoutSeconds: 120, secrets: [VSPORTS_KEY] },
  async () => {
    const override = Number.parseInt(VSPORTS_SEASON_ID.value(), 10);
    await runJob(getFirestore(), "videos", () =>
      syncVideos({
        db: getFirestore(),
        vs: vsports({ key: VSPORTS_KEY.value() }),
        now: () => new Date(),
        seasonId: Number.isFinite(override) ? override : undefined,
      }),
    );
  },
);

// Notícias RSS (sem segredo): cada fonte regista a sua saúde em `ingestHealth/news_{nome}`.
export const newsSync = onSchedule(
  { schedule: "every 15 minutes", region: "europe-west1", timeZone: "Europe/Lisbon", timeoutSeconds: 120 },
  async () => {
    await runJob(getFirestore(), "news", () => syncNews({ db: getFirestore(), fetch, now: () => new Date(), writeLegacyContent: NEWS_LEGACY_CONTENT.value() }));
  },
);

// Tweets das contas do Sporting, de 10 em 10 horas (quota da API do Twitter).
export const tweetsSync = onSchedule(
  { schedule: "0 */10 * * *", region: "europe-west1", timeZone: "Europe/Lisbon", timeoutSeconds: 120, secrets: [TWITTER_BEARER_TOKEN] },
  async () => {
    await runJob(getFirestore(), "tweets", () => syncTweets({ db: getFirestore(), tw: twitter({ token: TWITTER_BEARER_TOKEN.value() }) }));
  },
);

// Liquidação antiga dos palpites da V2 (resultado exato, +3) até ao cutover. Só corre em produção
// (LEGACY_COLLECTION_PREFIX vazio); em modo sombra não escreve nada.
export const legacyPredictionSettlement = onSchedule(
  { schedule: "every 5 minutes", region: "europe-west1", timeZone: "Europe/Lisbon", timeoutSeconds: 300 },
  async () => {
    await runJob(getFirestore(), "legacy_prediction_settlement", async () => {
      const out = await settleLegacyPredictionsIfProduction(getFirestore(), new Date(), LEGACY_COLLECTION_PREFIX.value());
      return { count: out?.predictions ?? 0 };
    });
  },
);

// Andebol, voleibol e basquetebol (API-Sports, 100 pedidos/dia por modalidade no plano gratuito). Corre de 10 em 10
// min mas cada modalidade só pede à API com jogo em [início - 15 min, início + 3 h] ou sem execução há 3 h; as
// modalidades desligadas (ids por confirmar, ver sourcesConfig) não fazem pedidos. Orçamento: ver Task 16.
export const apiSportsSync = onSchedule(
  { schedule: "every 10 minutes", region: "europe-west1", timeZone: "Europe/Lisbon", timeoutSeconds: 120, secrets: [RAPIDAPI_KEY] },
  async () => {
    const key = RAPIDAPI_KEY.value();
    await runApiSportsJob(getFirestore(), {
      db: getFirestore(),
      clients: { handball: apiSports({ sport: "handball", key }), volleyball: apiSports({ sport: "volleyball", key }), basketball: apiSports({ sport: "basketball", key }) },
      now: () => new Date(),
    });
  },
);

// Futsal (futsalportugal.com) e hóquei em patins (hp.fpp.pt com recurso no hoqueipatins.pt; Liga dos Campeões WSE pelo
// hoqueipatins, com a fonte indicada na app). Sem segredo. Corre de 15 em 15 min mas cada competição só pede às fontes
// em janela de jogo ([início - 15 min, início + 3 h]) ou de 6 em 6 h; depois de uma falha fora de janela espera 1 h.
// Cada URL no máximo uma vez por execução. Reconciliação e alertas: ver modalities/freeSourcesSync.ts.
export const freeSourcesSync = onSchedule(
  { schedule: "every 15 minutes", region: "europe-west1", timeZone: "Europe/Lisbon", timeoutSeconds: 300 },
  async () => {
    await runJob(getFirestore(), "free_sources", () => syncFreeSources({ db: getFirestore(), fetch, now: () => new Date() }));
  },
);
