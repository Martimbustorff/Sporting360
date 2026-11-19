// Modelo dos empréstimos de GameBox (Plano 8). Só o servidor escreve em `loans`; o cliente lê.
import { randomBytes } from "node:crypto";
import type { Timestamp } from "firebase-admin/firestore";

export type LoanMatch = {
  homeName: string;
  awayName: string;
  homeLogo: string | null;
  awayLogo: string | null;
  competition: string;
  kickoff: Timestamp;
  venue: "stadium" | "pavilion";
};

export type LoanSeat = {
  gate: string | null;
  sector: string | null;
  row: string | null;
  seat: string | null;
};

// O número da GameBox fica em `loans/{id}/secret/number` = { number: string }, fora deste documento.
export type LoanDoc = {
  ownerUid: string;
  ownerName: string;
  gameboxId: string;
  matchId: string;
  sport: string;
  match: LoanMatch;
  seat: LoanSeat;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  recipientUid: string | null;
  recipientName: string | null;
  openedAt: Timestamp | null;
  cancelledAt: Timestamp | null;
};

const HORA = 3600 * 1000;

/**
 * Fim da validade: início + 4 h; FT, AET e PEN: fim do jogo + 2 h; adiado ou cancelado sem nova data:
 * hora original + 2 h. CANC (inclui ABD/AWD/WO) dá sempre kickoff + 2 h. Com nova data, `kickoff` já é a hora remarcada.
 */
export function computeExpiresAt(m: {
  kickoff: Date;
  status: string;
  finishedAt: Date | null;
  postponedWithoutDate: boolean;
}): Date {
  if ((m.status === "FT" || m.status === "AET" || m.status === "PEN") && m.finishedAt) {
    return new Date(m.finishedAt.getTime() + 2 * HORA);
  }
  if (m.status === "CANC" || (m.status === "PST" && m.postponedWithoutDate)) {
    return new Date(m.kickoff.getTime() + 2 * HORA);
  }
  return new Date(m.kickoff.getTime() + 4 * HORA);
}

/** Ativo: não cancelado e ainda dentro da validade (expiresAt > now). */
export function isLoanActive(l: Pick<LoanDoc, "cancelledAt" | "expiresAt">, now: Date): boolean {
  return l.cancelledAt === null && l.expiresAt.toMillis() > now.getTime();
}

/** Id do empréstimo: 16 bytes aleatórios em base64url (22 caracteres). */
export function newLoanId(): string {
  return randomBytes(16).toString("base64url");
}
