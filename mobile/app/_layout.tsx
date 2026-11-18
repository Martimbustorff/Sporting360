import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as ScreenOrientation from 'expo-screen-orientation';
import { FONT_ASSETS } from '@/theme/fontAssets';
import { getCrashlytics, recordError } from '@react-native-firebase/crashlytics';
import { SessionProvider, useSession } from '@/providers/SessionProvider';
import { UpdateGate } from '@/providers/UpdateGate';
import { initFirebase } from '@/services/firebase';
import { legacyCleanup } from '@/services/legacyCleanup';

SplashScreen.preventAutoHideAsync();
// Uma vez no arranque do módulo (não em cada render).
try {
  initFirebase();
} catch (e) {
  // Nunca bloquear o arranque (ex.: emulador "already used" em dev).
  console.warn('[firebase] init failed', e);
  try {
    recordError(getCrashlytics(), e instanceof Error ? e : new Error(String(e)));
  } catch {
    // nada mais a fazer
  }
}
legacyCleanup();
// app.json deixa a rotação livre (o player de vídeo roda); o resto da app fica sempre em vertical.
ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});

// Guardas de rota: (auth)/_layout e (app)/_layout redirecionam conforme a sessão.
// Enquanto a sessão está em `loading` não se mostra nada: o splash nativo continua (V2 entra já com sessão).
function RootStack({ fontsReady }: { fontsReady: boolean }) {
  const { status } = useSession();
  const ready = fontsReady && status !== 'loading';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  const [loaded, error] = useFonts(FONT_ASSETS);

  // GestureHandlerRootView: obrigatório para os gestos do Sheet (e de qualquer GestureDetector).
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* teclado (KeyboardProvider) > UpdateGate (esconde o splash quando bloqueia) > SessionProvider > RootStack/guardas de rota > (BiometricGate, T15) */}
      <KeyboardProvider>
        <UpdateGate fontsReady={loaded || !!error}>
          <SessionProvider>
            <RootStack fontsReady={loaded || !!error} />
          </SessionProvider>
        </UpdateGate>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
