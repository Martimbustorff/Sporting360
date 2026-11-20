import '../global.css';
import { useCallback, useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as ScreenOrientation from 'expo-screen-orientation';
import { FONT_ASSETS } from '@/theme/fontAssets';
import { getCrashlytics, recordError } from '@react-native-firebase/crashlytics';
import { SessionProvider, useSession } from '@/providers/SessionProvider';
import { BrandSplash } from '@/components/BrandSplash';
import { LoanReferrerGate } from '@/components/LoanReferrerGate';
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
// 20/11: o splash nativo é só a cor de fundo e sai assim que as fontes chegam; o BrandSplash (anéis, S360 e frase)
// fica por cima durante 1,5 s (e enquanto a sessão carrega) e sai num fade por cima da app já montada.
function RootStack({ fontsReady }: { fontsReady: boolean }) {
  const { status } = useSession();
  const ready = fontsReady && status !== 'loading';
  const [splashDone, setSplashDone] = useState(false);
  const done = useCallback(() => setSplashDone(true), []);

  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync();
  }, [fontsReady]);

  if (!fontsReady) return null;
  return (
    <>
      {ready ? (
        <>
          <Stack screenOptions={{ headerShown: false }} />
          <LoanReferrerGate />
        </>
      ) : null}
      {splashDone ? null : <BrandSplash ready={ready} onDone={done} />}
    </>
  );
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
