import { logger } from "firebase-functions";
import { FieldPath, FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";

function nested(field: string[], value: unknown): Record<string, unknown> {
  return field.reduceRight<unknown>((acc, key) => ({ [key]: acc }), value) as Record<string, unknown>;
}

/**
 * Envia uma vez por marca. Reclama a marca numa transação, envia e só a liberta se o envio
 * falhar. Se a function morrer depois de enviar, a marca fica e o evento não se repete.
 */
export async function sendOnce(
  db: Firestore,
  docPath: string,
  field: string[],
  now: Date,
  send: () => Promise<void>,
): Promise<"sent" | "skipped" | "failed"> {
  const ref = db.doc(docPath);
  const path = new FieldPath(...field);
  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists && snap.get(path) != null) return false;
    tx.set(ref, nested(field, Timestamp.fromDate(now)), { merge: true });
    return true;
  });
  if (!claimed) return "skipped";
  try {
    await send();
    return "sent";
  } catch (e) {
    try {
      await ref.update(path, FieldValue.delete());
    } catch (release) {
      logger.warn("push: não foi possível libertar a marca", { docPath, error: String(release) });
    }
    logger.warn("push: envio falhou", { docPath, error: String(e) });
    return "failed";
  }
}
