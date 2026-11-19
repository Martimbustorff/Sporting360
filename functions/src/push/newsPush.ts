import { formatInTimeZone } from "date-fns-tz";
import { logger } from "firebase-functions";
import { FieldPath, FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { newsMessage } from "./messages";
import type { PushSender } from "./sender";

/** No máximo 2 notícias por dia (dia de Lisboa). */
export const NEWS_DAILY_CAP = 2;
/** Só notícias publicadas há menos de 2 h. */
export const NEWS_MAX_AGE_MS = 2 * 60 * 60_000;
/** Pelo menos 3 h entre duas notícias. */
export const NEWS_MIN_GAP_MS = 3 * 60 * 60_000;
/** Sem envio entre as 22:00 e as 09:00 de Lisboa. */
export const NEWS_QUIET_FROM = 22;
export const NEWS_QUIET_TO = 9;

const TZ = "Europe/Lisbon";

interface NewsItem {
  id: string;
  title: string;
  summary: string | null;
  publishedAt: Date;
}

function toDate(v: unknown): Date | null {
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  return null;
}

/**
 * A notícia de futebol mais recente (menos de 2 h, ainda não enviada hoje) para `push_news`.
 * Cap, intervalo e id reclamados numa só transação em `ingestState/push_news_{dia}`; se o FCM
 * falhar, a reclamação é desfeita. 0 ou 1 envio por execução.
 */
export async function pushLatestNews(db: Firestore, sender: PushSender, now: Date): Promise<{ count: number }> {
  const hour = Number(formatInTimeZone(now, TZ, "H"));
  if (hour >= NEWS_QUIET_FROM || hour < NEWS_QUIET_TO) return { count: 0 };

  const snap = await db.collection("news").where("sport", "==", "football").orderBy("publishedAt", "desc").limit(10).get();
  const fresh: NewsItem[] = [];
  for (const d of snap.docs) {
    const publishedAt = toDate(d.get("publishedAt"));
    const title = d.get("title");
    if (!publishedAt || typeof title !== "string" || !title.trim()) continue;
    if (now.getTime() - publishedAt.getTime() > NEWS_MAX_AGE_MS || publishedAt.getTime() > now.getTime() + 5 * 60_000) continue;
    const summary = d.get("summary");
    fresh.push({ id: d.id, title, summary: typeof summary === "string" ? summary : null, publishedAt });
  }
  if (fresh.length === 0) return { count: 0 };

  const ref = db.doc(`ingestState/push_news_${formatInTimeZone(now, TZ, "yyyy-MM-dd")}`);
  const claim = await db.runTransaction(async (tx) => {
    const day = await tx.get(ref);
    const count = (day.get("count") as number | undefined) ?? 0;
    const lastAt = toDate(day.get("lastAt"));
    const sent = (day.get("sent") ?? {}) as Record<string, unknown>;
    if (count >= NEWS_DAILY_CAP) return null;
    if (lastAt && now.getTime() - lastAt.getTime() < NEWS_MIN_GAP_MS) return null;
    const pick = fresh.find((n) => !(n.id in sent));
    if (!pick) return null;
    tx.set(ref, { count: count + 1, lastAt: Timestamp.fromDate(now), sent: { [pick.id]: Timestamp.fromDate(now) } }, { merge: true });
    return { pick, lastAt };
  });
  if (!claim) return { count: 0 };

  try {
    await sender.toTopic("push_news", newsMessage(claim.pick));
    return { count: 1 };
  } catch (e) {
    logger.warn("push: notícia falhou", { newsId: claim.pick.id, error: String(e) });
    try {
      await ref.update(
        "count", FieldValue.increment(-1),
        "lastAt", claim.lastAt ? Timestamp.fromDate(claim.lastAt) : FieldValue.delete(),
        new FieldPath("sent", claim.pick.id), FieldValue.delete(),
      );
    } catch (release) {
      logger.warn("push: não foi possível libertar a marca da notícia", { error: String(release) });
    }
    return { count: 0 };
  }
}
