import { Redirect, Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import { peekPendingLink, pendingLinkRoute, takePendingLink } from '@/lib/pendingLink';
import { useSession } from '@/providers/SessionProvider';

// Guarda: só sessões signedOut entram em (auth); quem entra/cria conta é levado para a app, ou para o link que abriu
// antes de ter sessão (/e/{id} abre /emprestimo/{id}; /j), guardado pelo guarda de (app) em lib/pendingLink.
export default function AuthLayout() {
  const { status } = useSession();
  // O destino fica fixo no primeiro render com sessão: um novo render (depois de o link ser consumido) não o troca por `/`.
  const target = useRef<string | null>(null);
  // O render só lê o link (pode repetir-se); consome-se depois de a sessão estar aberta.
  useEffect(() => {
    if (status === 'signedIn') takePendingLink();
  }, [status]);
  if (status === 'loading') return null;
  if (status === 'signedIn') {
    if (target.current === null) {
      const pending = peekPendingLink();
      target.current = pending ? pendingLinkRoute(pending) : '/';
    }
    return <Redirect href={target.current as '/'} />;
  }
  target.current = null;
  return <Stack screenOptions={{ headerShown: false }} />;
}
