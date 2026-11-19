import type { Firestore } from "firebase-admin/firestore";
import { gameStateOf } from "../data/gamesRepo";
import type { EventItem } from "../football/mapFixture";
import { mvpWindow } from "../game/windows";
import type { MatchDoc } from "../model/types";
import { sendOnce } from "./markers";
import { mvpOpenMessage } from "./messages";
import type { PushSender } from "./sender";

/**
 * Abertura do MVP, a partir do estado guardado pelo ticker. Início do jogo e golos não têm push (decisão
 * 2026-11-19: só ações na app). Decide pelo estado e não pela transição: re-syncs e ticks repetidos não duplicam
 * (marca em `ingestState/match_{id}.push`). Só futebol do Sporting.
 */
export async function dispatchMatchPushes(
  db: Firestore,
  sender: PushSender,
  m: MatchDoc,
  _events: EventItem[],
  now: Date,
): Promise<{ sent: string[]; failed: string[] }> {
  const out = { sent: [] as string[], failed: [] as string[] };
  if (m.sport !== "football") return out;
  const docPath = `ingestState/match_${m.id}`;
  const record = (label: string, r: "sent" | "skipped" | "failed") => {
    if (r === "sent") out.sent.push(label);
    if (r === "failed") out.failed.push(label);
  };

  if (mvpWindow(gameStateOf(m), now).state === "open") {
    record("mvpOpen", await sendOnce(db, docPath, ["push", "mvpOpenSentAt"], now, () => sender.toTopic("push_mvpOpen", mvpOpenMessage(m))));
  }
  return out;
}
