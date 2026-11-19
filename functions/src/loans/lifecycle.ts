import { Timestamp, type Firestore, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { fromFirestore } from "../store/writer";
import type { MatchDoc } from "../model/types";
import { isLoanActive, type LoanDoc } from "./model";
import { loanExpiryOf } from "../callables/loans";

// Ciclo de vida dos empréstimos de GameBox (Plano 8). Nada aqui regista uid, email, nomes, ids de empréstimo ou números.

/**
 * Janela da manutenção: empréstimos com expiresAt nos últimos 24 h ou no futuro. Quem expirou há mais de um dia já
 * foi limpo por uma das ~144 execuções diárias; assim a consulta só tem um intervalo em `expiresAt` (índice de campo
 * único, sem índice composto) e o custo não cresce com o histórico. `cancelledAt` filtra-se em memória.
 */
export const MAINTENANCE_LOOKBACK_MS = 24 * 3600_000;

const secretRef = (db: Firestore, id: string) => db.doc(`loans/${id}/secret/number`);

/**
 * Cancela (cancelledAt = now, se ainda não estava) e apaga o número de cada empréstimo. Idempotente.
 * Só marca como cancelados os ativos; os já expirados ficam como estão, mas perdem o número se ainda o tivessem.
 */
async function cancelDocs(db: Firestore, docs: QueryDocumentSnapshot[], now: Date): Promise<number> {
  const byId = new Map(docs.map((d) => [d.id, d]));
  let cancelled = 0;
  const writer = db.bulkWriter();
  let failure: unknown;
  writer.onWriteError((e) => {
    failure ??= e;
    return false;
  });
  for (const d of byId.values()) {
    const l = d.data() as LoanDoc;
    if (l.cancelledAt === null && isLoanActive(l, now)) {
      void writer.update(d.ref, { cancelledAt: Timestamp.fromDate(now) }).catch(() => undefined);
      cancelled++;
    }
    void writer.delete(secretRef(db, d.id)).catch(() => undefined);
  }
  await writer.close();
  if (failure) throw new Error("loan cancel failed");
  return cancelled;
}

/** Cancela os empréstimos ativos de uma GameBox e apaga os números (GameBox apagada). */
export async function cancelLoansForGamebox(db: Firestore, gameboxId: string, now: Date): Promise<number> {
  const snap = await db.collection("loans").where("gameboxId", "==", gameboxId).where("cancelledAt", "==", null).get();
  return cancelDocs(db, snap.docs, now);
}

/** Cancela os empréstimos em que o uid é dono ou destinatário e apaga os números (apagar conta). Devolve os cancelados. */
export async function cancelLoansForUser(db: Firestore, uid: string, now: Date = new Date()): Promise<number> {
  const [owned, received] = await Promise.all([
    db.collection("loans").where("ownerUid", "==", uid).get(),
    db.collection("loans").where("recipientUid", "==", uid).get(),
  ]);
  return cancelDocs(db, [...owned.docs, ...received.docs], now);
}

/**
 * Relê o jogo de cada empréstimo não cancelado e atualiza `expiresAt`; apaga o número dos que deixaram de estar ativos.
 * Um empréstimo já expirado não é recalculado (um jogo remarcado depois não o ressuscita, o número já se foi). Se o jogo
 * já não existe, mantém-se a validade guardada. O documento do empréstimo nunca é apagado. Idempotente.
 */
export async function maintainLoans(db: Firestore, now: Date): Promise<{ count: number; failed: number }> {
  const from = Timestamp.fromMillis(now.getTime() - MAINTENANCE_LOOKBACK_MS);
  const snap = await db.collection("loans").where("expiresAt", ">", from).get();
  const matches = new Map<string, Promise<MatchDoc | null>>();
  const matchOf = (id: string) => {
    let p = matches.get(id);
    if (!p) {
      p = db.doc(`matches/${id}`).get().then((s) => (s.exists ? fromFirestore(s.data() as MatchDoc) : null));
      matches.set(id, p);
    }
    return p;
  };
  let changed = 0;
  let failed = 0;
  for (const d of snap.docs) {
    const l = d.data() as LoanDoc;
    if (l.cancelledAt !== null) continue;
    try {
      let expiresMs = l.expiresAt.toMillis();
      const update: Record<string, unknown> = {};
      if (expiresMs > now.getTime()) {
        const m = await matchOf(l.matchId);
        if (m) {
          const next = loanExpiryOf(m, now).getTime();
          if (next !== expiresMs) {
            expiresMs = next;
            update.expiresAt = Timestamp.fromMillis(next);
          }
        }
      }
      const dead = expiresMs <= now.getTime();
      const hasSecret = dead && (await secretRef(db, d.id).get()).exists;
      const batch = db.batch();
      if (Object.keys(update).length > 0) batch.update(d.ref, update);
      if (hasSecret) batch.delete(secretRef(db, d.id));
      if (Object.keys(update).length > 0 || hasSecret) {
        await batch.commit();
        changed++;
      }
    } catch {
      failed++;
    }
  }
  return { count: changed, failed };
}
