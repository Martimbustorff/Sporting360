// Plano 8, Task 5: empréstimos de GameBox, só leitura (o servidor escreve). O dono lê os seus (ownerUid == eu) e quem recebeu
// lê os que tem preso (recipientUid == eu), como pedem as regras. O número nunca está nestes documentos.
import { useMemo } from 'react';
import { collection, query, where } from '@react-native-firebase/firestore';
import { useSession } from '@/providers/SessionProvider';
import { db } from '@/services/firebase';
import { useNow } from './clock';
import { useCollection, type Loadable } from './hooks';
import { LoanSchema, type Loan } from './schemas';

export type LoanItem = Loan & { id: string };

const CLOCK_MS = 30_000;

/** Ativo: não cancelado e ainda dentro da validade (como functions/src/loans/model.ts isLoanActive). */
export const isLoanActive = (l: Pick<Loan, 'cancelledAt' | 'expiresAt'>, now: Date): boolean =>
  l.cancelledAt === null && l.expiresAt.getTime() > now.getTime();

function useActiveLoans(field: 'ownerUid' | 'recipientUid', gameboxId: string | null): Loadable<LoanItem[]> {
  const session = useSession();
  const uid = session.status === 'signedIn' ? session.user.uid : null;
  const now = useNow(CLOCK_MS);
  const q = useMemo(() => (uid ? query(collection(db(), 'loans'), where(field, '==', uid), ...(field === 'ownerUid' ? [where('cancelledAt', '==', null)] : [])) : null), [uid, field]);
  const all = useCollection(q, LoanSchema);
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
