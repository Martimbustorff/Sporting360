// Plano 8, Task 5: empréstimos de GameBox, só leitura (o servidor escreve). O dono lê os seus (ownerUid == eu) e quem recebeu
// lê os que tem preso (recipientUid == eu), como pedem as regras. O número nunca está nestes documentos.
import { useMemo, useSyncExternalStore } from 'react';
import { MMKV } from 'react-native-mmkv';
import { z } from 'zod';
import { collection, query, where } from '@react-native-firebase/firestore';
import { useSession } from '@/providers/SessionProvider';
import { db } from '@/services/firebase';
import { useNow } from './clock';
import { useCollection, useDocument, type Loadable } from './hooks';
import { LoanSchema, type Loan } from './schemas';

export type LoanItem = Loan & { id: string };

const CLOCK_MS = 30_000;
// Uma app lançada antes das regras novas recebe permissão negada nestas consultas: esperado, não vai ao Crashlytics.
const LOANS_QUERY = { expectDenied: true, reportAs: 'loans' } as const;

/** Ativo: não cancelado e ainda dentro da validade (como functions/src/loans/model.ts isLoanActive). */
export const isLoanActive = (l: Pick<Loan, 'cancelledAt' | 'expiresAt'>, now: Date): boolean =>
  l.cancelledAt === null && l.expiresAt.getTime() > now.getTime();

function useActiveLoans(field: 'ownerUid' | 'recipientUid', gameboxId: string | null): Loadable<LoanItem[]> {
  const session = useSession();
  const uid = session.status === 'signedIn' ? session.user.uid : null;
  const now = useNow(CLOCK_MS);
  const q = useMemo(() => (uid ? query(collection(db(), 'loans'), where(field, '==', uid), ...(field === 'ownerUid' ? [where('cancelledAt', '==', null)] : [])) : null), [uid, field]);
  const all = useCollection(q, LoanSchema, LOANS_QUERY);
  return useMemo(
    () =>
      all.status === 'ready'
        ? { ...all, data: all.data.filter((l) => isLoanActive(l, now) && (gameboxId === null || l.gameboxId === gameboxId)) }
        : all,
    [all, now, gameboxId],
  );
}

/** Empréstimos ativos desta GameBox (consulta pelo dono, filtrada aqui por gameboxId). */
export function useOwnerLoans(gameboxId: string): Loadable<LoanItem[]> {
  return useActiveLoans('ownerUid', gameboxId);
}

/** Empréstimos ativos que o utilizador recebeu. */
export function useRecipientLoans(): Loadable<LoanItem[]> {
  return useActiveLoans('recipientUid', null);
}

// Cancelado ou expirado, as regras negam a leitura: é esperado (não vai ao Crashlytics) e o id do empréstimo nunca entra num relatório.
const LOAN_DOC = { expectDenied: true, reportAs: 'loans/*', cacheMissingIsLoading: true } as const;
const SECRET_DOC = { expectDenied: true, reportAs: 'loans/*/secret/number', cacheMissingIsLoading: true } as const;

const SecretSchema = z.object({ number: z.string().min(1) });
export type LoanSecret = z.infer<typeof SecretSchema>;

/**
 * Um empréstimo (loans/{id}). `id` null não subscreve: o destinatário só lê depois do claim (antes, só o dono lê).
 * Quando as regras deixam de o permitir, o listener falha e o estado passa a `error`.
 */
export function useLoan(id: string | null): Loadable<Loan> {
  return useDocument(id ? `loans/${id}` : null, LoanSchema, LOAN_DOC);
}

/**
 * O número da GameBox emprestada (loans/{id}/secret/number). Só o destinatário preso o lê, enquanto o empréstimo está
 * ativo: cancelado ou expirado, o listener falha com permissão negada (`error`). O número nunca vai a texto nem a logs.
 */
export function useLoanSecret(id: string | null): Loadable<LoanSecret> {
  return useDocument(id ? `loans/${id}/secret/number` : null, SecretSchema, SECRET_DOC);
}

// Aviso ao dono: quem recebeu apagou a conta (cancelReason `recipient-left`). Lê com igualdades apenas (ownerUid e gameboxId),
// filtra aqui. Fechar o aviso guarda-se no MMKV `s360`, por id de empréstimo; o id nunca vai para logs nem para o Analytics.
const NOTICE_KEY = (loanId: string) => `s360.loanNoticeDismissed.${loanId}`;
const noticeListeners = new Set<() => void>();
let noticeVersion = 0;
let noticeStore: MMKV | null = null;
const store = (): MMKV => (noticeStore ??= new MMKV({ id: 's360' }));

const isDismissed = (loanId: string): boolean => {
  try {
    return store().getBoolean(NOTICE_KEY(loanId)) === true;
  } catch {
    return false;
  }
};

/** Fecha o aviso deste empréstimo para sempre (neste aparelho). */
export function dismissOwnerLoanNotice(loanId: string): void {
  try {
    store().set(NOTICE_KEY(loanId), true);
  } catch {
    // sem armazenamento, o aviso volta; não parte o ecrã
  }
  noticeVersion += 1;
  noticeListeners.forEach((l) => l());
}

const subscribeNotice = (cb: () => void) => {
  noticeListeners.add(cb);
  return () => {
    noticeListeners.delete(cb);
  };
};
const noticeSnapshot = () => noticeVersion;

/**
 * O empréstimo cancelado porque quem recebeu apagou a conta, ainda dentro da validade e por fechar; null se não houver.
 * Vários: o mais recente.
 */
export function useOwnerLoanNotice(gameboxId: string): { loanId: string } | null {
  const session = useSession();
  const uid = session.status === 'signedIn' ? session.user.uid : null;
  const now = useNow(CLOCK_MS);
  useSyncExternalStore(subscribeNotice, noticeSnapshot, noticeSnapshot);
  const q = useMemo(
    () => (uid ? query(collection(db(), 'loans'), where('ownerUid', '==', uid), where('gameboxId', '==', gameboxId)) : null),
    [uid, gameboxId],
  );
  const all = useCollection(q, LoanSchema, LOANS_QUERY);
  if (all.status !== 'ready') return null;
  const hit = all.data
    .filter((l) => l.cancelReason === 'recipient-left' && l.expiresAt.getTime() > now.getTime() && !isDismissed(l.id))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  return hit ? { loanId: hit.id } : null;
}
