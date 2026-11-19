import type { EventItem } from "../../src/football/mapFixture";
import type { MatchDoc } from "../../src/model/types";
import {
  PUSH_TOPICS,
  cleanText,
  fcmMessage,
  goalMessage,
  matchStartMessage,
  mvpOpenMessage,
  newsMessage,
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

function goal(over: Partial<EventItem> = {}): EventItem {
  return {
    minute: 10,
    extra: null,
    teamId: "228",
    playerId: null,
    playerName: null,
    assistId: null,
    assistName: null,
    type: "goal",
    detail: "Normal Goal",
    comments: null,
    ...over,
  };
}

const DASHES = /[\u2013\u2014]/;

describe("push messages", () => {
  it("início do jogo", () =>
    expect(matchStartMessage(m)).toEqual({
      title: "Começou o jogo",
      body: "Sporting CP vs Benfica. Acompanha ao vivo na S360.",
      route: "/jogo/9002",
    }));

  it("golo com marcador e minuto", () =>
    expect(goalMessage(m, goal({ minute: 23, playerName: "Pedro Gonçalves" }))).toEqual({
      title: "Golo do Sporting!",
      body: "Pedro Gonçalves (23'). Sporting CP 2-1 Benfica",
      route: "/jogo/9002",
    }));

  it("golo nos descontos", () =>
    expect(goalMessage(m, goal({ minute: 90, extra: 4, playerName: "Gyökeres" })).body).toBe(
      "Gyökeres (90+4'). Sporting CP 2-1 Benfica",
    ));

  it("autogolo e marcador desconhecido", () => {
    expect(goalMessage(m, goal({ minute: 10, detail: "Own Goal", teamId: "211", playerName: "Otamendi" })).body).toBe(
      "Autogolo (10'). Sporting CP 2-1 Benfica",
    );
    expect(goalMessage(m, goal({ minute: 10, detail: "own goal", teamId: "211", playerName: "Otamendi" })).body).toBe(
      "Autogolo (10'). Sporting CP 2-1 Benfica",
    );
    expect(goalMessage(m, goal({ minute: 10, playerName: null })).body).toBe("Golo (10'). Sporting CP 2-1 Benfica");
  });

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

  it("notícia: título limpo e cortado, resumo ou texto de recurso", () => {
    const n = newsMessage({ id: "record-pt-abc", title: "Rúben \u2014 o regresso", summary: "x".repeat(300) });
    expect(n.title).toBe("Rúben - o regresso");
    expect(n.body.length).toBeLessThanOrEqual(141);
    expect(n.route).toBe("/noticias?id=record-pt-abc");
    expect(newsMessage({ id: "a", title: "T", summary: "" }).body).toBe("Lê a notícia na S360.");
    expect(newsMessage({ id: "a", title: "T", summary: null }).body).toBe("Lê a notícia na S360.");
    expect(newsMessage({ id: "a", title: "T" }).body).toBe("Lê a notícia na S360.");
    expect(newsMessage({ id: "a b/c", title: "T" }).route).toBe("/noticias?id=a%20b%2Fc");
    expect(newsMessage({ id: "a", title: "y".repeat(200) }).title.length).toBeLessThanOrEqual(101);
  });

  it("cleanText troca travessões e junta espaços", () => {
    expect(cleanText("  a \u2013 b\n\n c  ", 100)).toBe("a - b c");
  });

  it("nenhum texto tem travessões", () => {
    const all = [
      matchStartMessage(m),
      goalMessage(m, goal({ minute: 23, playerName: "Pedro \u2014 Gonçalves" })),
      goalMessage(m, goal({ minute: 10, detail: "Own Goal", teamId: "211" })),
      mvpOpenMessage(m),
      predictionReminderMessage(m),
      newsMessage({ id: "x", title: "A \u2013 B \u2014 C", summary: "d \u2014 e" }),
      matchStartMessage({ ...m, away: { id: "1", name: "Clube \u2013 Teste", logo: null } }),
    ];
    for (const msg of all) {
      expect(msg.title).not.toMatch(DASHES);
      expect(msg.body).not.toMatch(DASHES);
    }
  });

  it("payload FCM: só route em data, sem uid nem email", () => {
    const p = fcmMessage({ topic: "push_goals" }, matchStartMessage(m));
    expect(p).toMatchObject({
      topic: "push_goals",
      notification: { title: "Começou o jogo" },
      data: { route: "/jogo/9002" },
      android: { priority: "high" },
      apns: { payload: { aps: { sound: "default" } } },
    });
    expect(Object.keys(p.data!)).toEqual(["route"]);
    expect(Object.keys(fcmMessage({ token: "t1" }, matchStartMessage(m)))).toEqual(expect.arrayContaining(["token"]));
    expect(Object.keys(fcmMessage({ token: "t1" }, matchStartMessage(m)))).not.toContain("topic");
  });

  it("PUSH_TOPICS", () =>
    expect(PUSH_TOPICS).toEqual(["push_matchStart", "push_goals", "push_mvpOpen", "push_news"]));
});
