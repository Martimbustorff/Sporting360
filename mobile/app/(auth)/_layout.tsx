import { Redirect, Stack } from 'expo-router';
import { useSession } from '@/providers/SessionProvider';

// Guarda: só sessões signedOut entram em (auth); quem entra/cria conta é levado para a app.
export default function AuthLayout() {
  const { status } = useSession();
  if (status === 'loading') return null;
  if (status === 'signedIn') return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
