import { formatInTimeZone } from "date-fns-tz";
import type { Message } from "firebase-admin/messaging";
import type { MatchDoc } from "../model/types";
import { summarize } from "../news/newsSync";

/** Tópico FCM da abertura do MVP. O lembrete de prognóstico vai por token. */
export type PushTopic = "push_mvpOpen";
export const PUSH_TOPICS: readonly PushTopic[] = ["push_mvpOpen"];

/** Conteúdo de uma notificação. `route` é o único dado que segue no payload. */
export interface PushMessage {
  title: string;
  body: string;
  route: string;
}

const TITLE_MAX = 100;
const BODY_MAX = 140;

/** Troca travessões e meias-riscas por hífen, junta espaços e corta em `max`. */
export function cleanText(s: string, max: number): string {
  return summarize(s.replace(/[\u2013\u2014]/g, "-").replace(/\s+/g, " ").trim(), max);
}

function msg(title: string, body: string, route: string): PushMessage {
  return { title: cleanText(title, TITLE_MAX), body: cleanText(body, BODY_MAX), route };
}

function fixture(m: MatchDoc): string {
  return `${m.home.name} vs ${m.away.name}`;
}

function matchRoute(m: MatchDoc): string {
  return `/jogo/${encodeURIComponent(m.id)}`;
}

export function mvpOpenMessage(m: MatchDoc): PushMessage {
  return msg("A votação do MVP está aberta", `Escolhe o melhor do Sporting em ${fixture(m)}.`, `${matchRoute(m)}?tab=mvp`);
}

export function predictionReminderMessage(m: MatchDoc): PushMessage {
  const hour = formatInTimeZone(m.kickoff, "Europe/Lisbon", "HH:mm");
  return msg("Ainda não fizeste o teu prognóstico", `${fixture(m)} começa às ${hour}.`, `${matchRoute(m)}?tab=prognostico`);
}

/** Mensagem FCM para um tópico ou um token. Em `data` só segue `route`: nunca email, nome ou uid. */
export function fcmMessage(target: { topic: PushTopic } | { token: string }, msg: PushMessage): Message {
  return {
    ...target,
    notification: { title: msg.title, body: msg.body },
    data: { route: msg.route },
    android: { priority: "high", notification: { sound: "default" } },
    apns: { payload: { aps: { sound: "default" } } },
  };
}
