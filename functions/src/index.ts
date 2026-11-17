import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { RAPIDAPI_KEY, VSPORTS_KEY, VSPORTS_SEASON_ID } from "./config/secrets";
import { syncCompetitions, syncStandings } from "./football/competitionSync";
import { LIVE_REQUEST_TIMEOUT_MS, liveTickerJob } from "./football/liveTicker";
import { syncPrematch } from "./football/prematchSync";
import { syncTeamDaily, syncTeamWeekly } from "./football/teamSync";
import { refreshRecent, syncFixtures, type FootballDeps } from "./football/fixturesSync";
import { settleDue } from "./scheduled/settle";
import { apiFootball } from "./sources/apiFootball";
import { vsports } from "./sources/vsports";
import { runJob } from "./store/health";
import { syncVideos } from "./videos/videosSync";

if (getApps().length === 0) initializeApp();
getFirestore().settings({ ignoreUndefinedProperties: true });

export { submitPrediction } from "./callables/submitPrediction";
export { voteMvp } from "./callables/voteMvp";

export const settleScheduler = onSchedule(
  { schedule: "every 10 minutes", region: "europe-west1", timeZone: "Europe/Lisbon", timeoutSeconds: 540, memory: "512MiB" },
  async () => {
    await settleDue(getFirestore(), new Date());
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
