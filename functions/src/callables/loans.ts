import { logger } from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import { isLoanActive, loanExpiryOf, newLoanId, SEAT_FIELDS, type LoanDoc, type LoanSeat } from "../loans/model";
import { normalizeGameboxNumber } from "../loans/number";
import { publicName } from "../data/profiles";
import { fromFirestore } from "../store/writer";
import type { MatchDoc } from "../model/types";
import { validGameId } from "./validation";

// Empréstimos de GameBox (Plano 8). Só o servidor escreve em `loans`. Nada aqui regista uid, email, nomes ou o número.

export const LOAN_URL_BASE = "https://s360-prognostico-download.web.app/e/";
const FOOTBALL = "football";
const FINISHED = ["FT", "AET", "PEN", "CANC"];
const LOAN_ID_RE = /^[A-Za-z0-9_-]{22}$/;
// Igual ao modo bilhete da app (mobile/src/data/sports.ts `upcomingQuery` e mobile/app/(app)/gamebox/bilhete.tsx `upcomingHome`):
// só jogos com início nas últimas 4 h ou depois, seja qual for o estado; destes, LIVE/HT, NS e PST. Um jogo preso em LIVE há mais
// de 4 h não conta, tal como a app não o vê.
const NEXT_GRACE_MS = 4 * 3600_000;
const NEXT_QUERY_LIMIT = 30;
const SPORTS = ["football", "futsal", "handball", "roller_hockey", "volleyball", "basketball"] as const;

type Auth = { uid: string } | undefined;
const asObj = (data: unknown): Record<string, unknown> => (typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {});
const denied = (reason: string, msg: string) => new HttpsError("failed-precondition", msg, { reason });

function requireUid(auth: Auth): string {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Sessão necessária.");
  return auth.uid;
}
function loanIdOf(data: unknown): string {
  const id = asObj(data).loanId;
  if (typeof id !== "string" || !LOAN_ID_RE.test(id)) throw new HttpsError("invalid-argument", "Dados inválidos.");
  return id;
}

const venueOf = (sport: string): "stadium" | "pavilion" => (sport === FOOTBALL ? "stadium" : "pavilion");
const textOrNull = (v: unknown): string | null => {
  const s = typeof v === "string" || typeof v === "number" ? String(v).trim() : "";
  return s === "" ? null : s;
};

function seatOf(g: Record<string, unknown>, venue: "stadium" | "pavilion"): LoanSeat {
  const p = SEAT_FIELDS[venue];
  return { gate: textOrNull(g[p[0]]), sector: textOrNull(g[p[1]]), row: textOrNull(g[p[2]]), seat: textOrNull(g[p[3]]) };
}

async function publicNameOf(db: Firestore, uid: string): Promise<string> {
  const snap = await db.doc(`publicProfiles/${uid}`).get();
  return publicName({ displayName: snap.get("displayName") as string | undefined }, uid);
}

/** Próximo jogo em casa, por terminar, das modalidades do recinto (futebol: Estádio; outras: Pavilhão). */
async function nextHomeMatchId(db: Firestore, venue: "stadium" | "pavilion", now: Date): Promise<string | null> {
  const sports = SPORTS.filter((s) => venueOf(s) === venue);
  const from = Timestamp.fromMillis(now.getTime() - NEXT_GRACE_MS);
  const snaps = await Promise.all(
    sports.map((s) => db.collection("matches").where("sport", "==", s).where("kickoff", ">=", from).orderBy("kickoff").limit(NEXT_QUERY_LIMIT).get()),
  );
  let best: { id: string; at: number } | null = null;
  for (const snap of snaps) {
    for (const d of snap.docs) {
      const m = d.data() as MatchDoc;
      if (m.sportingSide !== "home") continue;
      const at = (m.kickoff as unknown as Timestamp).toMillis();
      if (!["LIVE", "HT", "NS", "PST"].includes(m.status)) continue;
      if (!best || at < best.at) best = { id: d.id, at };
    }
  }
  return best?.id ?? null;
}

/** Só o nome da função e o código do erro: nada de mensagem, caminho, uid nem ids (a mensagem do Firestore leva o loanId). */
function logLoanInternal(fn: string, e: unknown): void {
  const code = (e as { code?: unknown } | null)?.code;
  logger.error("LOAN_INTERNAL", { fn, ...(typeof code === "string" || typeof code === "number" ? { code } : {}) });
}

/** Erros que não são HttpsError (Firestore: caminhos com o loanId) nunca chegam ao cliente nem ao log do onCall. */
export async function safely<T>(fn: "createLoan" | "claimLoan" | "cancelLoan", run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    logLoanInternal(fn, e);
    throw new HttpsError("internal", "Algo correu mal. Tenta outra vez.");
  }
}

/** Triggers com retry: regista só função e código e volta a lançar um erro sem caminho, id nem uid, para a plataforma tentar de novo. */
export async function safelyTrigger<T>(fn: "onGameboxUpdated" | "onGameboxDeleted", run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    logLoanInternal(fn, e);
    throw new Error("loan trigger failed");
  }
}

export async function handleCreateLoan(
  db: Firestore,
  auth: Auth,
  data: unknown,
  now: Date,
): Promise<{ loanId: string; url: string }> {
  const uid = requireUid(auth);
  const d = asObj(data);
  const number = typeof d.number === "string" ? normalizeGameboxNumber(d.number) : null;
  if (!validGameId(d.gameboxId) || !validGameId(d.matchId) || !number) throw new HttpsError("invalid-argument", "Dados inválidos.");
  const { gameboxId, matchId } = d;

  const boxSnap = await db.doc(`gamebox/${gameboxId}`).get();
  if (!boxSnap.exists) throw new HttpsError("not-found", "GameBox não encontrada.");
  if (boxSnap.get("userid") !== uid) throw new HttpsError("permission-denied", "Esta GameBox não é tua.");

  const matchSnap = await db.doc(`matches/${matchId}`).get();
  if (!matchSnap.exists) throw new HttpsError("not-found", "Jogo não encontrado.");
  const m = { ...fromFirestore(matchSnap.data() as MatchDoc), id: matchSnap.id };
  if (FINISHED.includes(m.status)) throw denied("finished", "O jogo já terminou.");
  if (m.sportingSide !== "home") throw denied("not-home", "O jogo não é em casa.");
  const venue = venueOf(m.sport);
  if ((await nextHomeMatchId(db, venue, now)) !== matchId) throw denied("not-next", "Só se empresta para o próximo jogo em casa.");

  const ownerName = await publicNameOf(db, uid);
  const expiresAt = loanExpiryOf(m, now);
  // Nunca nasce expirado (por exemplo, jogo por começar há mais de 4 h que já passou da validade).
  if (expiresAt.getTime() <= now.getTime()) throw denied("finished", "O jogo já terminou.");
  const loanId = newLoanId();
  const loan: LoanDoc = {
    ownerUid: uid,
    ownerName,
    gameboxId,
    matchId,
    sport: m.sport,
    match: {
      homeName: m.home.name,
      awayName: m.away.name,
      homeLogo: m.home.logo ?? null,
      awayLogo: m.away.logo ?? null,
      competition: m.competition.name,
      kickoff: Timestamp.fromDate(m.kickoff),
      venue,
    },
    seat: seatOf(boxSnap.data() ?? {}, venue),
    createdAt: Timestamp.fromDate(now),
    expiresAt: Timestamp.fromDate(expiresAt),
    recipientUid: null,
    recipientName: null,
    openedAt: null,
    cancelledAt: null,
    cancelReason: null,
  };

  await db.runTransaction(async (tx) => {
    // Um ativo no máximo por GameBox, verificado dentro da transação.
    const existing = await tx.get(db.collection("loans").where("gameboxId", "==", gameboxId).where("cancelledAt", "==", null));
    const active = existing.docs.some((x) => isLoanActive(x.data() as Pick<LoanDoc, "cancelledAt" | "expiresAt">, now));
    if (active) throw new HttpsError("already-exists", "Esta GameBox já está emprestada.");
    tx.create(db.doc(`loans/${loanId}`), loan);
    tx.create(db.doc(`loans/${loanId}/secret/number`), { number });
  });
  return { loanId, url: `${LOAN_URL_BASE}${loanId}` };
}

export async function handleClaimLoan(
  db: Firestore,
  auth: Auth,
  data: unknown,
  now: Date,
): Promise<{ status: "claimed" | "owner" }> {
  const uid = requireUid(auth);
  const loanId = loanIdOf(data);
  const ref = db.doc(`loans/${loanId}`);
  const name = await publicNameOf(db, uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Empréstimo não encontrado.");
    const l = snap.data() as LoanDoc;
    if (l.ownerUid === uid) return { status: "owner" as const };
    if (!isLoanActive(l, now)) throw denied("inactive", "Este empréstimo já não está ativo.");
    if (l.recipientUid === uid) return { status: "claimed" as const };
    if (l.recipientUid !== null) throw denied("claimed-by-other", "Este empréstimo já foi aberto por outra conta.");
    tx.update(ref, { recipientUid: uid, recipientName: name, openedAt: Timestamp.fromDate(now) });
    return { status: "claimed" as const };
  });
}

export async function handleCancelLoan(db: Firestore, auth: Auth, data: unknown, now: Date): Promise<{ ok: true }> {
  const uid = requireUid(auth);
  const loanId = loanIdOf(data);
  const ref = db.doc(`loans/${loanId}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Empréstimo não encontrado.");
    const l = snap.data() as LoanDoc;
    if (l.ownerUid !== uid) throw new HttpsError("permission-denied", "Só o dono cancela.");
    if (l.cancelledAt === null) tx.update(ref, { cancelledAt: Timestamp.fromDate(now), cancelReason: "owner" });
    tx.delete(db.doc(`loans/${loanId}/secret/number`));
  });
  return { ok: true };
}

export const createLoan = onCall({ region: "europe-west1" }, (req) => safely("createLoan", () => handleCreateLoan(getFirestore(), req.auth, req.data, new Date())));
export const claimLoan = onCall({ region: "europe-west1" }, (req) => safely("claimLoan", () => handleClaimLoan(getFirestore(), req.auth, req.data, new Date())));
export const cancelLoan = onCall({ region: "europe-west1" }, (req) => safely("cancelLoan", () => handleCancelLoan(getFirestore(), req.auth, req.data, new Date())));
