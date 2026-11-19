import type { MatchDoc } from "../../src/model/types";
import {
  PUSH_TOPICS,
  cleanText,
  fcmMessage,
  mvpOpenMessage,
  predictionReminderMessage,
} from "../../src/push/messages";

const m: MatchDoc = {
  id: "9002",
  sport: "football",
  competition: { key: "liga", id: "94", name: "Liga Portugal", type: "league", season: "2026", round: null, roundLabel: null },
  home: { id: "228", name: "Sporting CP", logo: null },
  away: { id: "211", name: "Benfica", logo: null },
  sportingSide: "home",
  kickoff: new Date("2026-11-15T20:30:00Z"),
  status: "LIVE",
  statusRaw: "1H",
  elapsed: 30,
  elapsedExtra: null,
  score: { home: 2, away: 1, halftime: null, extratime: null, penalty: null },
  finishedAt: null,
  finishedAtSource: null,
  referee: null,
  source: { provider: "api-football", id: "9002" },
};

const DASHES = /[\u2013\u2014]/;

describe("push messages", () => {
  it("MVP", () =>
    expect(mvpOpenMessage(m)).toEqual({
      title: "A votação do MVP está aberta",
      body: "Escolhe o melhor do Sporting em Sporting CP vs Benfica.",
      route: "/jogo/9002?tab=mvp",
    }));

  it("lembrete com a hora de Lisboa", () => {
    expect(predictionReminderMessage(m)).toEqual({
      title: "Ainda não fizeste o teu prognóstico",
      body: "Sporting CP vs Benfica começa às 20:30.",
      route: "/jogo/9002?tab=prognostico",
    });
    // Hora de verão: 19:45 UTC em julho são 20:45 em Lisboa.
    expect(predictionReminderMessage({ ...m, kickoff: new Date("2026-07-15T19:45:00Z") }).body).toBe(
      "Sporting CP vs Benfica começa às 20:45.",
    );
  });

  it("cleanText troca travessões e junta espaços", () => {
    expect(cleanText("  a \u2013 b\n\n c  ", 100)).toBe("a - b c");
    expect(cleanText("x".repeat(300), 140).length).toBeLessThanOrEqual(141);
  });

  it("nenhum texto tem travessões", () => {
    const all = [
      mvpOpenMessage(m),
      mvpOpenMessage({ ...m, away: { id: "1", name: "Clube \u2013 Teste", logo: null } }),
      predictionReminderMessage(m),
      predictionReminderMessage({ ...m, home: { id: "1", name: "A \u2014 B", logo: null } }),
    ];
    for (const msg of all) {
      expect(msg.title).not.toMatch(DASHES);
      expect(msg.body).not.toMatch(DASHES);
    }
  });

  it("payload FCM: só route em data, sem uid nem email", () => {
    const p = fcmMessage({ topic: "push_mvpOpen" }, mvpOpenMessage(m));
    expect(p).toMatchObject({
      topic: "push_mvpOpen",
      notification: { title: "A votação do MVP está aberta" },
      data: { route: "/jogo/9002?tab=mvp" },
      android: { priority: "high" },
      apns: { payload: { aps: { sound: "default" } } },
    });
    expect(Object.keys(p.data!)).toEqual(["route"]);
    expect(Object.keys(fcmMessage({ token: "t1" }, predictionReminderMessage(m)))).toEqual(expect.arrayContaining(["token"]));
    expect(Object.keys(fcmMessage({ token: "t1" }, predictionReminderMessage(m)))).not.toContain("topic");
  });

  it("PUSH_TOPICS: só a abertura do MVP", () => expect(PUSH_TOPICS).toEqual(["push_mvpOpen"]));
});
