import * as fs from "fs";
import * as path from "path";
import { deleteApp, getApps } from "firebase-admin/app";
import type { Firestore } from "firebase-admin/firestore";
import { backfillFinished, listFootballWindow, refreshRecent, syncFixtures, type FootballDeps } from "../../src/football/fixturesSync";
import { apiFootball } from "../../src/sources/apiFootball";
import { runJob } from "../../src/store/health";
import { getMatch, saveMatch } from "../../src/store/writer";
import type { MatchDoc } from "../../src/model/types";
import { logger } from "firebase-functions";
import { clearAll, testDb } from "../helpers/emulatorDb";
import { fakeFetch } from "../helpers/fakeFetch";

const FIX = path.join(__dirname, "..", "fixtures", "api-football");
const load = (n: string) => JSON.parse(fs.readFileSync(path.join(FIX, n), "utf8"));
const NOW = new Date("2026-11-17T12:00:00Z");

let db: Firestore;
beforeAll(() => {
  db = testDb("fixtures-sync-test");
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});
beforeEach(async () => {
  await clearAll(db);
});

function deps(f: ReturnType<typeof fakeFetch>, now = NOW): FootballDeps {
  return { db, api: apiFootball({ key: "k", fetch: f }), now: () => now };
}
const SEASON = /fixtures\?team=228&season=2026$/;
const calendar = () => load("fixtures-team-season.json");

/** fixture completo FT com outro id (e a mesma equipa). */
function fullFt(id: number) {
  const f = load("fixture-ft.json").response[0];
  f.fixture.id = id;
  return f;
}
const envelope = (response: unknown[]) => ({ get: "fixtures", parameters: {}, errors: [], results: response.length, paging: { current: 1, total: 1 }, response });

async function seedFinal(id: number, finishedAt: Date) {
  const { mapFixture } = await import("../../src/football/mapFixture");
  const { match } = mapFixture(fullFt(id), { now: finishedAt, previous: null, observedLive: true });
  await saveMatch(db, { match, details: null, legacy: null });
}

describe("syncFixtures", () => {
  it("1 chamada por época; um matches e um games por fixture, com os campos do contrato", async () => {
    const f = fakeFetch([[SEASON, "api-football/fixtures-team-season.json"]]);
    const r = await syncFixtures(deps(f));
    expect(f.calls).toHaveLength(1);
    expect(r.count).toBe(4);
    expect((await db.collection("matches").get()).size).toBe(4);
    expect((await db.collection("games").get()).size).toBe(4);
    const g = (await db.doc("games/1500003").get()).data()!;
    expect(g).toMatchObject({
      api: "1500003",
      scorehome: "0",
      scoreaway: "0",
      competition: "Primeira Liga",
      season: "2026",
      channel: "",
      elapsedTime: "0",
      isActive: false,
      startTime: "2026-11-22T20:00:00.000Z",
      _ingest: "v2027",
    });
    expect(g.teamhome).toMatchObject({ name: "Sporting CP", api: "228" });
    expect((await db.doc("matches/1500003").get()).exists).toBe(true);
    // o calendário não traz lances
    expect((await db.collection("summaries").get()).size).toBe(0);
    expect((await db.doc("matches/1500003/details/events").get()).exists).toBe(false);
  });

  it("adiamento: segunda execução com PST e nova data atualiza status, kickoff, timestamp e startTime", async () => {
    const moved = calendar();
    const pst = moved.response[1];
    pst.fixture.date = "2026-11-16T20:00:00+00:00";
    pst.fixture.timestamp += 86400;
    const f = fakeFetch([[SEASON, (_u, n) => (n === 0 ? calendar() : moved)]]);
    await syncFixtures(deps(f));
    await syncFixtures(deps(f));
    const m = await getMatch(db, "1500002");
    expect(m?.status).toBe("PST");
    expect(m?.kickoff).toEqual(new Date("2026-11-16T20:00:00Z"));
    const g = (await db.doc("games/1500002").get()).data()!;
    expect(g.startTime).toBe("2026-11-16T20:00:00.000Z");
    expect(g.timestamp.toDate()).toEqual(new Date("2026-11-16T20:00:00Z"));
  });

  it("fixture já FT visto pela primeira vez aqui: finishedAtSource estimated", async () => {
    await syncFixtures(deps(fakeFetch([[SEASON, "api-football/fixtures-team-season.json"]])));
    const m = await getMatch(db, "1500001");
    expect(m?.status).toBe("FT");
    expect(m?.finishedAtSource).toBe("estimated");
    expect(m?.finishedAt).toBeInstanceOf(Date);
  });

  it("C6: jogo guardado como LIVE/HT não é tocado (o ticker é o dono), nem matches nem games", async () => {
    // 1 h depois do kickoff do 1500002 (15/11 20:00): dentro da janela do ticker
    const live = new Date("2026-11-15T21:00:00Z");
    await syncFixtures(deps(fakeFetch([[SEASON, "api-football/fixtures-team-season.json"]]), live));
    await db.doc("matches/1500002").set({ status: "LIVE", statusRaw: "2H", elapsed: 70, score: { home: 2, away: 1 } }, { merge: true });
    await db.doc("games/1500002").set({ scorehome: "2", scoreaway: "1", isActive: true }, { merge: true });
    const before = (await db.doc("matches/1500002").get()).get("updatedAt");
    const r = await syncFixtures(deps(fakeFetch([[SEASON, "api-football/fixtures-team-season.json"]]), live));
    expect(r.count).toBe(3);
    const m = (await db.doc("matches/1500002").get()).data()!;
    expect(m.status).toBe("LIVE");
    expect(m.score.home).toBe(2);
    expect(m.updatedAt.isEqual(before)).toBe(true);
    expect((await db.doc("games/1500002").get()).get("scorehome")).toBe("2");
    // HT também
    await db.doc("matches/1500002").set({ status: "HT" }, { merge: true });
    await syncFixtures(deps(fakeFetch([[SEASON, "api-football/fixtures-team-season.json"]]), live));
    expect((await db.doc("matches/1500002").get()).get("status")).toBe("HT");
  });

  it("LIVE preso: com o kickoff há mais de 6 h (fora da janela do ticker) o calendário corrige-o", async () => {
    await syncFixtures(deps(fakeFetch([[SEASON, "api-football/fixtures-team-season.json"]])));
    // como o ticker o deixaria (via saveMatch, que atualiza os hashes)
    const stuck = (await getMatch(db, "1500002"))!;
    await saveMatch(db, { match: { ...stuck, status: "LIVE", statusRaw: "2H", elapsed: 70 } });
    expect((await db.doc("matches/1500002").get()).get("status")).toBe("LIVE");
    // NOW = 17/11 12:00, kickoff 15/11 20:00 (40 h): o ticker já não o vê
    const r = await syncFixtures(deps(fakeFetch([[SEASON, "api-football/fixtures-team-season.json"]])));
    expect(r.count).toBe(4);
    expect((await db.doc("matches/1500002").get()).get("status")).toBe("PST");
  });

  describe("posse do ticker (corrida calendário × ticker)", () => {
    const withStatus = (id: number, short: string, elapsed: number | null, goals: { home: number | null; away: number | null }) => {
      const c = calendar();
      const f = c.response.find((x: { fixture: { id: number } }) => x.fixture.id === id);
      f.fixture.status = { long: short, short, elapsed, extra: null };
      f.goals = goals;
      return c;
    };
    /** Grava como o ticker (saveMatch atualiza os hashes). */
    const asTicker = async (id: string, over: Partial<MatchDoc>) => {
      const m = (await getMatch(db, id))!;
      await saveMatch(db, { match: { ...m, ...over }, details: null, legacy: { games: { [id]: { isActive: over.status === "LIVE" } } as never } });
    };
    const updatedAt = async (id: string) => (await db.doc(`matches/${id}`).get()).get("updatedAt");

    it("FT do ticker no postmatch + instantâneo antigo \"2H\" do calendário: fica FT (nem matches nem games)", async () => {
      await syncFixtures(deps(fakeFetch([[SEASON, "api-football/fixtures-team-season.json"]])));
      const clock = new Date("2026-11-08T21:55:00Z");
      await asTicker("1500001", { status: "FT", statusRaw: "FT", finishedAt: new Date(clock.getTime() - 5 * 60_000), finishedAtSource: "observed" });
      const before = await updatedAt("1500001");
      const r = await syncFixtures(deps(fakeFetch([[SEASON, withStatus(1500001, "2H", 70, { home: 1, away: 1 })]]), clock));
      const m = (await getMatch(db, "1500001"))!;
      expect(m.status).toBe("FT");
      expect(m.finishedAtSource).toBe("observed");
      expect((await updatedAt("1500001")).isEqual(before)).toBe(true);
      expect((await db.doc("games/1500001").get()).get("isActive")).toBe(false);
      expect(r.alerts).toBeUndefined();
    });

    it("FT guardado fora das janelas do ticker + calendário \"2H\": não regride e alerta pelo runJob", async () => {
      const alert = jest.spyOn(logger, "error").mockImplementation(() => undefined);
      jest.spyOn(logger, "warn").mockImplementation(() => undefined);
      await syncFixtures(deps(fakeFetch([[SEASON, "api-football/fixtures-team-season.json"]])));
      const before = await getMatch(db, "1500001");
      const r = await syncFixtures(deps(fakeFetch([[SEASON, withStatus(1500001, "2H", 70, { home: 1, away: 1 })]])));
      expect(r.alerts).toHaveLength(1);
      expect(r.count).toBe(3);
      const m = (await getMatch(db, "1500001"))!;
      expect(m.status).toBe("FT");
      expect(m.finishedAt).toEqual(before!.finishedAt);
      expect(m.score.home).toBe(2);
      expect((await db.doc("games/1500001").get()).get("isActive")).toBe(false);

      await runJob(db, "football_fixtures", () => syncFixtures(deps(fakeFetch([[SEASON, withStatus(1500001, "NS", null, { home: null, away: null })]]))));
      expect((await getMatch(db, "1500001"))!.status).toBe("FT");
      expect(alert).toHaveBeenCalledTimes(1);
      expect(alert).toHaveBeenCalledWith("INGEST_ALERT", expect.objectContaining({ source: "football_fixtures", reason: expect.stringContaining("1500001") }));
      jest.restoreAllMocks();
    });

    it("LIVE do ticker dentro da janela + calendário ainda NS (corrida no kickoff): fica LIVE", async () => {
      const clock = new Date("2026-11-22T20:10:00Z");
      await syncFixtures(deps(fakeFetch([[SEASON, "api-football/fixtures-team-season.json"]]), new Date("2026-11-20T12:00:00Z")));
      await asTicker("1500003", { status: "LIVE", statusRaw: "1H", elapsed: 10 });
      const before = await updatedAt("1500003");
      await syncFixtures(deps(fakeFetch([[SEASON, "api-football/fixtures-team-season.json"]]), clock));
      expect((await getMatch(db, "1500003"))!.status).toBe("LIVE");
      expect((await updatedAt("1500003")).isEqual(before)).toBe(true);
      expect((await db.doc("games/1500003").get()).get("isActive")).toBe(true);
    });

    it("NS guardado na janela de prematch (e no atraso de início): o calendário salta-o", async () => {
      await syncFixtures(deps(fakeFetch([[SEASON, "api-football/fixtures-team-season.json"]]), new Date("2026-11-20T12:00:00Z")));
      const before = await updatedAt("1500003");
      const moved = () => {
        const c = calendar();
        c.response[2].fixture.referee = "Outro Árbitro";
        return c;
      };
      for (const at of ["2026-11-22T19:00:00Z", "2026-11-22T20:05:00Z"]) {
        await syncFixtures(deps(fakeFetch([[SEASON, moved()]]), new Date(at)));
        expect((await updatedAt("1500003")).isEqual(before)).toBe(true);
      }
      // dois dias antes está idle: o calendário escreve
      await syncFixtures(deps(fakeFetch([[SEASON, moved()]]), new Date("2026-11-20T13:00:00Z")));
      expect((await updatedAt("1500003")).isEqual(before)).toBe(false);
    });
  });

  it("um fixture com data inválida não aborta o lote", async () => {
    const bad = calendar();
    bad.response[2].fixture.timestamp = null;
    bad.response[2].fixture.date = "lixo";
    const r = await syncFixtures(deps(fakeFetch([[SEASON, bad]])));
    expect(r.count).toBe(3);
    expect((await db.collection("matches").get()).size).toBe(3);
    expect((await db.doc("matches/1500003").get()).exists).toBe(false);
    expect(r.failed).toBe(1);
  });

  it("failed chega ao runJob: a saúde regista lastFailed e sai um INGEST_ALERT", async () => {
    const alert = jest.spyOn(logger, "error").mockImplementation(() => undefined);
    jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    const bad = calendar();
    bad.response[2].fixture.timestamp = null;
    bad.response[2].fixture.date = "lixo";
    await runJob(db, "football_fixtures", () => syncFixtures(deps(fakeFetch([[SEASON, bad]]))));
    expect((await db.doc("ingestHealth/football_fixtures").get()).data()).toMatchObject({ lastFailed: 1, consecutiveFailures: 0 });
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith("INGEST_ALERT", expect.objectContaining({ source: "football_fixtures" }));
    jest.restoreAllMocks();
  });

  it("falha da API: consecutiveFailures 1 e nenhum matches apagado", async () => {
    await syncFixtures(deps(fakeFetch([[SEASON, "api-football/fixtures-team-season.json"]])));
    const f = fakeFetch([[SEASON, { status: 500, body: "erro" }]]);
    await runJob(db, "football_fixtures", () => syncFixtures(deps(f)));
    expect((await db.doc("ingestHealth/football_fixtures").get()).get("consecutiveFailures")).toBe(1);
    expect((await db.collection("matches").get()).size).toBe(4);
  });

  it("devolve remaining da quota", async () => {
    const f = fakeFetch([[SEASON, { status: 200, body: calendar(), headers: { "x-ratelimit-requests-remaining": "321" } }]]);
    expect((await syncFixtures(deps(f))).remaining).toBe(321);
  });
});

describe("refreshRecent", () => {
  it("dois FT nas últimas 36 h: uma chamada fixtures?ids=a-b e escreve summaries, stastistics, lineups, players", async () => {
    await seedFinal(1500011, new Date(NOW.getTime() - 5 * 3_600_000));
    await seedFinal(1500012, new Date(NOW.getTime() - 20 * 3_600_000));
    await seedFinal(1500013, new Date(NOW.getTime() - 40 * 3_600_000)); // fora da janela
    const f = fakeFetch([[/fixtures\?ids=/, envelope([fullFt(1500011), fullFt(1500012)])]]);
    const r = await refreshRecent(deps(f), { finishedWithinMs: 36 * 3_600_000 });
    expect(r.count).toBe(2);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]).toContain("ids=1500011-1500012");
    expect((await db.collection("summaries").get()).size).toBeGreaterThan(0);
    expect((await db.collection("stastistics").get()).size).toBeGreaterThan(0);
    expect((await db.collection("lineups").get()).size).toBeGreaterThan(0);
    expect((await db.collection("players").get()).size).toBeGreaterThan(0);
    expect((await db.doc("matches/1500011/details/events").get()).exists).toBe(true);
    expect((await db.doc("matches/1500012/details/players").get()).exists).toBe(true);
  });

  it("mais de 20 jogos: lotes de 20", async () => {
    for (let i = 0; i < 21; i++) await seedFinal(1600000 + i, new Date(NOW.getTime() - 3_600_000));
    const f = fakeFetch([[/fixtures\?ids=/, (url) => envelope(decodeURIComponent(url.split("ids=")[1]).split("-").map((id) => fullFt(Number(id))))]]);
    const r = await refreshRecent(deps(f), { finishedWithinMs: 36 * 3_600_000 });
    expect(r.count).toBe(21);
    expect(f.calls).toHaveLength(2);
  });

  it("um jogo inválido conta em failed (e o resto escreve-se)", async () => {
    jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    await seedFinal(1500011, new Date(NOW.getTime() - 5 * 3_600_000));
    await seedFinal(1500012, new Date(NOW.getTime() - 6 * 3_600_000));
    const bad = fullFt(1500012);
    bad.fixture.timestamp = null;
    bad.fixture.date = "lixo";
    const r = await refreshRecent(deps(fakeFetch([[/fixtures\?ids=/, envelope([fullFt(1500011), bad])]])), { finishedWithinMs: 36 * 3_600_000 });
    expect(r).toMatchObject({ count: 1, failed: 1 });
    jest.restoreAllMocks();
  });

  it("sem jogos na janela não chama a API", async () => {
    const f = fakeFetch([]);
    expect((await refreshRecent(deps(f), { finishedWithinMs: 36 * 3_600_000 })).count).toBe(0);
    expect(f.calls).toHaveLength(0);
  });
});

describe("backfillFinished", () => {
  const routes = (): Array<[RegExp, never]> =>
    [
      [SEASON, envelope([fullFt(1500021), fullFt(1500022)]) as never],
      [/fixtures\?ids=/, envelope([fullFt(1500021), fullFt(1500022)]) as never],
    ];

  it("newModelOnly: escreve o modelo novo e nenhuma coleção antiga", async () => {
    const r = await backfillFinished(deps(fakeFetch(routes())), "2026", { newModelOnly: true });
    expect(r.count).toBe(2);
    expect(r.failed).toBe(0);
    expect((await db.doc("matches/1500021/details/events").get()).exists).toBe(true);
    for (const c of ["games", "summaries", "stastistics", "lineups", "players"]) {
      expect((await db.collection(c).get()).size).toBe(0);
    }
  });

  it("sem newModelOnly escreve também as coleções antigas, e usa force (repõe o que foi apagado)", async () => {
    await backfillFinished(deps(fakeFetch(routes())), "2026", { newModelOnly: false });
    expect((await db.doc("games/1500021").get()).exists).toBe(true);
    await db.doc("games/1500021").delete();
    await backfillFinished(deps(fakeFetch(routes())), "2026", { newModelOnly: false });
    expect((await db.doc("games/1500021").get()).exists).toBe(true);
  });
});

describe("listFootballWindow", () => {
  it("devolve só futebol com kickoff na janela, por ordem", async () => {
    await syncFixtures(deps(fakeFetch([[SEASON, "api-football/fixtures-team-season.json"]])));
    await db.doc("matches/outro").set({ id: "outro", sport: "handball", kickoff: new Date("2026-11-20T10:00:00Z") });
    const list: MatchDoc[] = await listFootballWindow(db, new Date("2026-11-14T00:00:00Z"), new Date("2026-11-25T00:00:00Z"));
    expect(list.map((m) => m.id)).toEqual(["1500002", "1500003"]);
    expect(list[0].kickoff).toBeInstanceOf(Date);
  });
});
