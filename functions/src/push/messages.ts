import { formatInTimeZone } from "date-fns-tz";
import type { Message } from "firebase-admin/messaging";
import type { EventItem } from "../football/mapFixture";
import type { MatchDoc } from "../model/types";
import { summarize } from "../news/newsSync";

/** Tópicos FCM, um por preferência do ecrã Notificações. O lembrete de prognóstico vai por token. */
export type PushTopic = "push_matchStart" | "push_goals" | "push_mvpOpen" | "push_news";
export const PUSH_TOPICS: readonly PushTopic[] = ["push_matchStart", "push_goals", "push_mvpOpen", "push_news"];

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
  return summarize(s.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim(), max);
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

function minuteLabel(e: EventItem): string {
  return e.extra ? `${e.minute}+${e.extra}'` : `${e.minute}'`;
}

function scorerLabel(e: EventItem): string {
  if (/own goal/i.test(e.detail)) return "Autogolo";
  return e.playerName?.trim() || "Golo";
}

export function matchStartMessage(m: MatchDoc): PushMessage {
  return msg("Começou o jogo", `${fixture(m)}. Acompanha ao vivo na S360.`, matchRoute(m));
}

export function goalMessage(m: MatchDoc, e: EventItem): PushMessage {
  const score = `${m.home.name} ${m.score.home ?? 0}-${m.score.away ?? 0} ${m.away.name}`;
  return msg("Golo do Sporting!", `${scorerLabel(e)} (${minuteLabel(e)}). ${score}`, matchRoute(m));
}

export function mvpOpenMessage(m: MatchDoc): PushMessage {
  return msg("A votação do MVP está aberta", `Escolhe o melhor do Sporting em ${fixture(m)}.`, `${matchRoute(m)}?tab=mvp`);
}

export function predictionReminderMessage(m: MatchDoc): PushMessage {
  const hour = formatInTimeZone(m.kickoff, "Europe/Lisbon", "HH:mm");
  return msg("Ainda não fizeste o teu prognóstico", `${fixture(m)} começa às ${hour}.`, `${matchRoute(m)}?tab=prognostico`);
}

export function newsMessage(n: { id: string; title: string; summary?: string | null }): PushMessage {
  const summary = n.summary?.trim();
  return msg(n.title, summary ? summary : "Lê a notícia na S360.", `/noticias?id=${encodeURIComponent(n.id)}`);
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
