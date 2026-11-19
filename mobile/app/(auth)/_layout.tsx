import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';
import { peekPendingLink, pendingLinkRoute, takePendingLink } from '@/lib/pendingLink';
import { useSession } from '@/providers/SessionProvider';

// Guarda: só sessões signedOut entram em (auth); quem entra/cria conta é levado para a app, ou para o link que abriu
// antes de ter sessão (/e/{id} abre /emprestimo/{id}; /j), guardado pelo guarda de (app) em lib/pendingLink.
export default function AuthLayout() {
  const { status } = useSession();
  // O render só lê o link (pode repetir-se); consome-se depois de a sessão estar aberta.
  useEffect(() => {
    if (status === 'signedIn') takePendingLink();
  }, [status]);
  if (status === 'loading') return null;
  if (status === 'signedIn') {
    const pending = peekPendingLink();
    return <Redirect href={(pending ? pendingLinkRoute(pending) : '/') as '/'} />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
