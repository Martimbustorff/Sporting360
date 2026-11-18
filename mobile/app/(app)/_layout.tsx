import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';
import { BiometricGate, markFreshSession } from '@/providers/BiometricGate';
import { useSession } from '@/providers/SessionProvider';

// Guarda: só sessões signedIn entram em (app). `loading` não desenha nada (o splash continua no root).
// O BiometricGate envolve só (app): os ecrãs de (auth) nunca ficam bloqueados.
export default function AppLayout() {
  const { status } = useSession();
  useEffect(() => {
    // Um login feito depois de ver signedOut nunca conta como arranque a frio (não bloqueia logo a seguir ao login).
    if (status === 'signedOut') markFreshSession();
  }, [status]);
  if (status === 'loading') return null;
  if (status === 'signedOut') return <Redirect href="/welcome" />;
  return (
    <BiometricGate>
      <Stack screenOptions={{ headerShown: false }} />
    </BiometricGate>
  );
}
