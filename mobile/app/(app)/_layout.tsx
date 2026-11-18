import { Redirect, Stack } from 'expo-router';
import { BiometricGate } from '@/providers/BiometricGate';
import { useSession } from '@/providers/SessionProvider';

// Guarda: só sessões signedIn entram em (app). `loading` não desenha nada (o splash continua no root).
// O BiometricGate envolve só (app): os ecrãs de (auth) nunca ficam bloqueados.
export default function AppLayout() {
  const { status } = useSession();
  if (status === 'loading') return null;
  if (status === 'signedOut') return <Redirect href="/welcome" />;
  return (
    <BiometricGate>
      <Stack screenOptions={{ headerShown: false }} />
    </BiometricGate>
  );
}
