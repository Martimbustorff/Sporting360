// Plano 8, Task 7: no arranque (só Android) lê o referrer da Play Store, uma vez por instalação. Um id encontrado passa por
// setPendingLink('/e/{id}'): sem sessão o guarda de (auth) abre o empréstimo depois de entrar; com sessão abre-se logo.
// Espera pela sessão (`loading`) antes de decidir e age uma só vez. Não renderiza nada; nunca regista o id.
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { readLoanReferrerOnce } from '@/lib/installReferrer';
import { setPendingLink, takePendingLink } from '@/lib/pendingLink';
import { useSession } from '@/providers/SessionProvider';

export function LoanReferrerGate() {
  const { status } = useSession();
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    let alive = true;
    readLoanReferrerOnce()
      .then((found) => {
        if (alive && found) setId(found);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!id || handled.current || status === 'loading') return;
    handled.current = true;
    if (status === 'signedIn') {
      takePendingLink();
      router.push({ pathname: '/emprestimo/[id]', params: { id } });
    } else {
      setPendingLink(`/e/${id}`);
    }
  }, [id, status, router]);

  return null;
}
