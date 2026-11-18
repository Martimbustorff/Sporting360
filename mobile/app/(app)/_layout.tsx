import { Redirect, Stack } from 'expo-router';
import { peekSignOutNotice } from '@/lib/signOutNotice';
import { BiometricGate } from '@/providers/BiometricGate';
import { useSession } from '@/providers/SessionProvider';

// Guarda: só sessões signedIn entram em (app). `loading` não desenha nada (o splash continua no root).
// O BiometricGate envolve só (app): os ecrãs de (auth) nunca ficam bloqueados.
// R17: um aviso pendente (ex.: conta apagada) segue no redirect para o Welcome, que o mostra e limpa.
export default function AppLayout() {
  const { status } = useSession();
  if (status === 'loading') return null;
  if (status === 'signedOut') {
    const aviso = peekSignOutNotice();
    return <Redirect href={aviso ? { pathname: '/welcome', params: { aviso } } : '/welcome'} />;
  }
  return (
    <BiometricGate>
      <Stack screenOptions={{ headerShown: false }} />
    </BiometricGate>
  );
}
