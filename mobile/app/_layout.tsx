import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { FONT_ASSETS } from '@/theme/fontAssets';
import { SessionProvider } from '@/providers/SessionProvider';
import { initFirebase } from '@/services/firebase';
import { legacyCleanup } from '@/services/legacyCleanup';

SplashScreen.preventAutoHideAsync();
// Uma vez no arranque do módulo (não em cada render).
initFirebase();
legacyCleanup();

export default function RootLayout() {
  const [loaded, error] = useFonts(FONT_ASSETS);

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;
  // GestureHandlerRootView: obrigatório para os gestos do Sheet (e de qualquer GestureDetector).
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* fontes/splash > (UpdateGate, T17) > SessionProvider > guardas de rota > (BiometricGate, T15) */}
      <SessionProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </SessionProvider>
    </GestureHandlerRootView>
  );
}
