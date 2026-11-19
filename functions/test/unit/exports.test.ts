import {
  DEPLOY_CUTOVER_FUNCTIONS,
  DEPLOY_DATA_FUNCTIONS,
  DEPLOY_ENGINE_FUNCTIONS,
  DEPLOY_PUSH_FUNCTIONS,
  LEGACY_FUNCTIONS,
  V2027_FUNCTIONS,
  deployArg,
} from "../../scripts/deployLists";

// Segredos simulados: importar o index não pode depender de valores reais.
process.env.RAPIDAPI_KEY = "test-rapidapi";
process.env.VSPORTS_KEY = "test-vsports";
process.env.TWITTER_BEARER_TOKEN = "test-twitter";
process.env.GCLOUD_PROJECT ??= "demo-scp360";

type Endpoint = {
  region?: string[];
  scheduleTrigger?: { schedule: string; timeZone?: string };
  callableTrigger?: object;
  secretEnvironmentVariables?: { key: string }[];
};

const index = require("../../src/index") as Record<string, { __endpoint?: Endpoint }>;
const exported = Object.keys(index).sort();
const endpoint = (name: string): Endpoint => {
  const ep = index[name]?.__endpoint;
  if (!ep) throw new Error(`${name} não é uma function`);
  return ep;
};

const TRIGGERS = ["onGameboxDeleted"];
const PLAN3_CALLABLES = ["updateProfile", "deleteAccount", "linkProviderByEmail"];

const DEPLOYED = [...DEPLOY_DATA_FUNCTIONS, ...DEPLOY_CUTOVER_FUNCTIONS, ...DEPLOY_ENGINE_FUNCTIONS, ...DEPLOY_PUSH_FUNCTIONS] as string[];

describe("listas de publicação", () => {
  it("os exports do index são exatamente as quatro listas", () => {
    expect(exported).toEqual([...DEPLOYED].sort());
  });

  it("as três callables do Plano 3 estão exportadas e no motor", () => {
    for (const n of PLAN3_CALLABLES) {
      expect(exported).toContain(n);
      expect(DEPLOY_ENGINE_FUNCTIONS).toContain(n);
    }
  });

  it("tamanhos e nomes sem repetições", () => {
    expect(DEPLOY_DATA_FUNCTIONS).toHaveLength(12);
    expect(DEPLOY_CUTOVER_FUNCTIONS).toEqual(["legacyPredictionSettlement"]);
    expect(DEPLOY_ENGINE_FUNCTIONS).toEqual(["submitPrediction", "voteMvp", "mvpTallyAggregator", "settleScheduler", "updateProfile", "deleteAccount", "linkProviderByEmail", "createLoan", "claimLoan", "cancelLoan", "loansMaintenance", "onGameboxDeleted"]);
    expect(DEPLOY_PUSH_FUNCTIONS).toEqual(["predictionReminderPush"]);
    expect(LEGACY_FUNCTIONS).toHaveLength(13);
    expect(new Set(DEPLOYED).size).toBe(DEPLOYED.length);
    expect([...V2027_FUNCTIONS].sort()).toEqual([...DEPLOYED].sort());
  });

  it("nenhum nome novo coincide com uma function antiga", () => {
    const legacy = new Set<string>(LEGACY_FUNCTIONS);
    expect(DEPLOYED.filter((n) => legacy.has(n))).toEqual([]);
    expect(exported.filter((n) => legacy.has(n))).toEqual([]);
  });

  it("deployArg junta os nomes com o codebase v2027", () => {
    expect(deployArg(["a", "b"])).toBe("functions:v2027:a,functions:v2027:b");
    expect(deployArg(["a"])).toBe("functions:v2027:a");
    expect(() => deployArg([])).toThrow();
  });
});

describe("configuração de cada function exportada", () => {
  it.each(exported)("%s: região europe-west1", (name) => {
    expect(endpoint(name).region).toEqual(["europe-west1"]);
  });

  const scheduled = exported.filter((n) => endpoint(n).scheduleTrigger);
  it.each(scheduled)("%s: agendada com timeZone Europe/Lisbon", (name) => {
    expect(endpoint(name).scheduleTrigger?.timeZone).toBe("Europe/Lisbon");
  });

  it("as callables do motor são onCall e as restantes são agendadas ou gatilhos", () => {
    const callables = exported.filter((n) => endpoint(n).callableTrigger);
    expect(callables.sort()).toEqual(exported.filter((n) => ["submitPrediction", "voteMvp", ...PLAN3_CALLABLES, "createLoan", "claimLoan", "cancelLoan"].includes(n)).sort());
    expect(scheduled.length + callables.length + TRIGGERS.length).toBe(exported.length);
  });

  // Uma function que lê um segredo sem o declarar recebe um valor vazio em produção (C11).
  const SECRETS: Record<string, string[]> = {
    footballFixturesSync: ["RAPIDAPI_KEY"],
    footballPostMatchSync: ["RAPIDAPI_KEY"],
    footballLiveTicker: ["RAPIDAPI_KEY"],
    footballStandingsSync: ["RAPIDAPI_KEY"],
    footballSeasonSync: ["RAPIDAPI_KEY"],
    footballWeeklySync: ["RAPIDAPI_KEY"],
    footballPrematchSync: ["RAPIDAPI_KEY"],
    apiSportsSync: ["RAPIDAPI_KEY"],
    videosSync: ["VSPORTS_KEY"],
    tweetsSync: ["TWITTER_BEARER_TOKEN"],
    newsSync: [],
    freeSourcesSync: [],
    legacyPredictionSettlement: [],
    settleScheduler: [],
    mvpTallyAggregator: [],
    submitPrediction: [],
    voteMvp: [],
    updateProfile: [],
    deleteAccount: [],
    linkProviderByEmail: [],
    createLoan: [],
    claimLoan: [],
    cancelLoan: [],
    loansMaintenance: [],
    onGameboxDeleted: [],
    predictionReminderPush: [],
  };
  it("todas as functions publicadas têm a lista de segredos verificada", () => {
    expect(Object.keys(SECRETS).sort()).toEqual([...DEPLOYED].sort());
  });
  it.each(Object.entries(SECRETS))("%s: segredos %j", (name, secrets) => {
    expect((endpoint(name).secretEnvironmentVariables ?? []).map((s) => s.key).sort()).toEqual([...secrets].sort());
  });
});
