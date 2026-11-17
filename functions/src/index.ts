import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { RAPIDAPI_KEY } from "./config/secrets";
import { syncCompetitions, syncStandings } from "./football/competitionSync";
import { liveTickerJob } from "./football/liveTicker";
import { syncPrematch } from "./football/prematchSync";
import { syncTeamDaily, syncTeamWeekly } from "./football/teamSync";
import { refreshRecent, syncFixtures, type FootballDeps } from "./football/fixturesSync";
import { settleDue } from "./scheduled/settle";
import { apiFootball } from "./sources/apiFootball";
import { runJob } from "./store/health";

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
export const footballLiveTicker = onSchedule(
  {
    schedule: "every 1 minutes",
    region: "europe-west1",
    timeZone: "Europe/Lisbon",
    timeoutSeconds: 75,
    maxInstances: 1,
    retryCount: 0,
    secrets: [RAPIDAPI_KEY],
  },
  async () => {
    await liveTickerJob({ ...footballDeps(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) }, { minRemaining: 500 });
  },
);
