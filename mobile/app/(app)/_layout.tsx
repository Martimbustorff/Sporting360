import { Redirect, Stack } from 'expo-router';
import { useSession } from '@/providers/SessionProvider';

// Guarda: só sessões signedIn entram em (app). `loading` não desenha nada (o splash continua no root).
export default function AppLayout() {
  const { status } = useSession();
  if (status === 'loading') return null;
  if (status === 'signedOut') return <Redirect href="/welcome" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
