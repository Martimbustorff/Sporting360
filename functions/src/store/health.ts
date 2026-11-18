import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";

/** `alerts`: avisos da execução (ex.: jogo sem resultado há 24 h) que saem como INGEST_ALERT, um por linha. */
type RunResult = { ok: true; count: number; remaining?: number | null; failed?: number; alerts?: string[] } | { ok: false; error: string };
type JobOutput = { count: number; remaining?: number | null; failed?: number; alerts?: string[] };
export interface RunOptions {
  expectNonZero?: boolean;
  minRemaining?: number;
}

/**
 * Regista o resultado de uma execução em `ingestHealth/{source}`. Os alertas saem como
 * `logger.error("INGEST_ALERT", ...)`; uma métrica de logs + política de alerta (Task 20) envia o email.
 * É o único sítio que emite INGEST_ALERT para falhas de execução: os jobs devolvem `failed`/`alerts` e
 * deixam o detalhe por item em `logger.warn`.
 */
export async function recordRun(db: Firestore, source: string, r: RunResult, o?: RunOptions): Promise<void> {
  const ref = db.doc(`ingestHealth/${source}`);
  const prev = await ref.get();
  const failures = (prev.get("consecutiveFailures") as number | undefined) ?? 0;

  const alerts: string[] = [];
  const data: Record<string, unknown> = { lastRunAt: FieldValue.serverTimestamp() };

  if (r.ok) {
    data.lastOkAt = FieldValue.serverTimestamp();
    data.lastCount = r.count;
    data.lastError = null;
    data.consecutiveFailures = 0;
    data.remaining = r.remaining ?? null;
    data.lastFailed = r.failed ?? 0;
    if (r.failed) alerts.push(`${r.failed} itens falharam nesta execução`);
    for (const a of r.alerts ?? []) alerts.push(a);
    if (o?.expectNonZero && r.count === 0) alerts.push("0 registos numa fonte que devia devolver dados");
    if (o?.minRemaining !== undefined && r.remaining !== null && r.remaining !== undefined && r.remaining < o.minRemaining) {
      alerts.push(`quota baixa: restam ${r.remaining} pedidos (mínimo ${o.minRemaining})`);
    }
  } else {
    data.lastError = r.error;
    data.consecutiveFailures = failures + 1;
    alerts.push(`falhou: ${r.error}`);
  }

  await ref.set(data, { merge: true });
  for (const reason of alerts) logger.error("INGEST_ALERT", { source, reason });
}

/** Corre `fn`, regista o resultado e nunca relança (o scheduler não deve entrar em retry). */
export async function runJob(
  db: Firestore,
  source: string,
  fn: () => Promise<JobOutput>,
  o?: RunOptions,
): Promise<void> {
  try {
    const out = await fn();
    await recordRun(db, source, { ok: true, count: out.count, remaining: out.remaining, failed: out.failed, alerts: out.alerts }, o);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    try {
      await recordRun(db, source, { ok: false, error });
    } catch (inner) {
      logger.error("INGEST_ALERT", { source, reason: `falha a registar saúde: ${String(inner)}`, error });
    }
  }
}
