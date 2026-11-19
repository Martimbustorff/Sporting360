import type { Firestore } from "firebase-admin/firestore";
import { gameStateOf } from "../data/gamesRepo";
import type { EventItem } from "../football/mapFixture";
import { mvpWindow } from "../game/windows";
import { FINAL_STATUSES, LIVE_STATUSES } from "../model/status";
import type { MatchDoc } from "../model/types";
import { sendOnce } from "./markers";
import { goalMessage, matchStartMessage, mvpOpenMessage } from "./messages";
import type { PushSender } from "./sender";

/** "Começou o jogo" só até este minuto: ligar o envio a meio do jogo não anuncia um início antigo. */
export const MATCH_START_MAX_ELAPSED = 15;
/** Golos com mais minutos de jogo do que isto já não saem (envio ligado a meio, lances atrasados). */
export const GOAL_MAX_AGE_MIN = 15;
/** Depois do apito final, golos ainda não enviados (descontos) saem durante este tempo. */
export const GOAL_FINAL_GRACE_MS = 10 * 60_000;

const sportingTeamId = (m: MatchDoc) => (m.sportingSide === "home" ? m.home.id : m.away.id);

/** No "Own Goal" da API-Football a equipa do lance é a que sofreu (como `scoringSide` da app). */
function scoredBySporting(m: MatchDoc, e: EventItem): boolean {
  const ownGoal = e.detail.trim().toLowerCase() === "own goal";
  return (e.teamId === sportingTeamId(m)) !== ownGoal;
}

function isScoredGoal(e: EventItem): boolean {
  if (e.type !== "goal") return false;
  if (e.detail.trim().toLowerCase() === "missed penalty") return false;
  return !/penalty shootout/i.test(e.comments ?? "");
}

/** Golos que contam para o Sporting (incluindo autogolos do adversário), por ordem de minuto. */
export function sportingGoals(m: MatchDoc, events: EventItem[]): EventItem[] {
  return events
    .filter((e) => isScoredGoal(e) && scoredBySporting(m, e))
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.minute - b.e.minute || (a.e.extra ?? 0) - (b.e.extra ?? 0) || a.i - b.i)
    .map(({ e }) => e);
}

/** Chave idempotente do golo: jogo, minuto (com descontos) e marcador. */
export function goalKey(matchId: string, e: EventItem): string {
  return `${matchId}_${e.minute}${e.extra ? "+" + e.extra : ""}_${e.playerId ?? "x"}`;
}

function goalsOpen(m: MatchDoc, now: Date): boolean {
  if (LIVE_STATUSES.has(m.status)) return true;
  if (!FINAL_STATUSES.has(m.status) || !m.finishedAt) return false;
  return now.getTime() - m.finishedAt.getTime() <= GOAL_FINAL_GRACE_MS;
}

/**
 * Início do jogo, golos do Sporting e abertura do MVP, a partir do estado guardado pelo ticker.
 * Decide pelo estado e não pela transição: re-syncs e ticks repetidos não duplicam (marcas em
 * `ingestState/match_{id}.push`). Só futebol do Sporting.
 */
export async function dispatchMatchPushes(
  db: Firestore,
  sender: PushSender,
  m: MatchDoc,
  events: EventItem[],
  now: Date,
): Promise<{ sent: string[]; failed: string[] }> {
  const out = { sent: [] as string[], failed: [] as string[] };
  if (m.sport !== "football") return out;
  const docPath = `ingestState/match_${m.id}`;
  const record = (label: string, r: "sent" | "skipped" | "failed") => {
    if (r === "sent") out.sent.push(label);
    if (r === "failed") out.failed.push(label);
  };

  if (m.status === "LIVE" && m.elapsed !== null && m.elapsed <= MATCH_START_MAX_ELAPSED) {
    record("matchStart", await sendOnce(db, docPath, ["push", "matchStartSentAt"], now, () => sender.toTopic("push_matchStart", matchStartMessage(m))));
  }

  if (goalsOpen(m, now)) {
    const goals = sportingGoals(m, events);
    if (goals.length > 0) {
      const marks = ((await db.doc(docPath).get()).get("push.goals") ?? {}) as Record<string, unknown>;
      // Nunca mais pushes de golo do que golos do Sporting no resultado (golo anulado, minuto corrigido).
      const budget = (m.score[m.sportingSide] ?? 0) - Object.keys(marks).length;
      const oldest = (m.elapsed ?? 0) - GOAL_MAX_AGE_MIN;
      // Os `budget` golos frescos sem marca mais recentes, por ordem: uma chave corrigida pela API ou um golo
      // anulado que fica nos lances nunca tomam o lugar do golo novo.
      const fresh = goals.filter((e) => !(goalKey(m.id, e) in marks) && e.minute >= oldest);
      const chosen = budget > 0 ? fresh.slice(-budget) : [];
      for (const e of chosen) {
        const key = goalKey(m.id, e);
        record(`goal:${key}`, await sendOnce(db, docPath, ["push", "goals", key], now, () => sender.toTopic("push_goals", goalMessage(m, e))));
      }
    }
  }

  if (mvpWindow(gameStateOf(m), now).state === "open") {
    record("mvpOpen", await sendOnce(db, docPath, ["push", "mvpOpenSentAt"], now, () => sender.toTopic("push_mvpOpen", mvpOpenMessage(m))));
  }
  return out;
}
