// Plano 8, Task 5: empréstimos de GameBox, só leitura (o servidor escreve). O dono lê os seus (ownerUid == eu) e quem recebeu
// lê os que tem preso (recipientUid == eu), como pedem as regras. O número nunca está nestes documentos.
import { useMemo } from 'react';
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
