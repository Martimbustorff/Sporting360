// Figma V7.1 "00 Splash" (5043:18163), a partir do design do João (Background 564:7263 e Splashscreen 564:7339).
// 20/11 (Martim): o splash dura 1,5 s e entra na app com uma transição suave.
// - O splash nativo é só a cor de fundo; quando as fontes chegam este ecrã toma o lugar dele: primeiro os anéis
//   (como o frame "Background"), depois o S360 e a frase aparecem num fade curto (frame "Splashscreen").
// - Fica pelo menos `splashMs` desde que aparece e, se a sessão ainda estiver a carregar, até ela chegar.
// - Sai num fade de `splashFadeMs` por cima da Home (ou do Welcome), que já está montada por baixo.
// - Sem Reanimated (testes) desenha o estado final e sai sem fade.
import { useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { BrandRings } from '@/components/BrandRings';
import { canAnimate, easeOut, MOTION } from '@/lib/motion';
import { colors, fonts, layout, type } from '@/theme/tokens';

export const SPLASH_TEXT = { tagline: 'De Sportinguistas\npara Sportinguistas' } as const;

function Content() {
  // Contexto em vez de useSafeAreaInsets: o splash monta-se na raiz e não pode falhar sem provider.
  const bottom = useContext(SafeAreaInsetsContext)?.bottom ?? 0;
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={styles.center}>
        <BrandRings testID="splash-rings" />
        <Text style={type.welcomeLogo} accessibilityRole="header" accessibilityLabel="S360">
          <Text style={{ color: colors.primary }}>S</Text>360
        </Text>
      </View>
      <Text style={[styles.tagline, { bottom: Math.max(bottom, layout.homeIndicator) + layout.splashTaglineBottom }]}>
        {SPLASH_TEXT.tagline}
      </Text>
    </View>
  );
}

/** `ready`: a app por baixo já pode aparecer (sessão carregada). `onDone`: o splash acabou e pode desmontar-se. */
export function BrandSplash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [minElapsed, setMinElapsed] = useState(false);
  const leavingRef = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), layout.splashMs);
    return () => clearTimeout(t);
  }, []);
  const go = minElapsed && ready;
  if (!canAnimate()) return <StaticSplash go={go} onDone={onDone} />;
  return <AnimatedSplash go={go} leavingRef={leavingRef} onDone={onDone} />;
}

function StaticSplash({ go, onDone }: { go: boolean; onDone: () => void }) {
  useEffect(() => {
    if (go) onDone();
  }, [go, onDone]);
  return (
    <View testID="brand-splash" style={[StyleSheet.absoluteFill, styles.root]} accessibilityViewIsModal>
      <Content />
    </View>
  );
}

function AnimatedSplash({ go, leavingRef, onDone }: { go: boolean; leavingRef: React.RefObject<boolean>; onDone: () => void }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (!go || leavingRef.current) return;
    leavingRef.current = true;
    opacity.set(
      withTiming(0, { duration: layout.splashFadeMs, easing: easeOut() }, (finished) => {
        if (finished) scheduleOnRN(onDone);
      }),
    );
  }, [go, leavingRef, onDone, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View testID="brand-splash" style={[StyleSheet.absoluteFill, styles.root, style]} pointerEvents={go ? 'none' : 'auto'} accessibilityViewIsModal>
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.center}>
          <BrandRings testID="splash-rings" />
        </View>
      </View>
      <Animated.View entering={FadeIn.duration(MOTION.slow).delay(MOTION.fast)} style={StyleSheet.absoluteFill}>
        <LogoAndTagline />
      </Animated.View>
    </Animated.View>
  );
}

/** O S360 e a frase, por cima dos anéis (entram depois deles). */
function LogoAndTagline() {
  // Contexto em vez de useSafeAreaInsets: o splash monta-se na raiz e não pode falhar sem provider.
  const bottom = useContext(SafeAreaInsetsContext)?.bottom ?? 0;
  return (
    <>
      <View style={styles.center}>
        <Text style={type.welcomeLogo} accessibilityRole="header" accessibilityLabel="S360">
          <Text style={{ color: colors.primary }}>S</Text>360
        </Text>
      </View>
      <Text style={[styles.tagline, { bottom: Math.max(bottom, layout.homeIndicator) + layout.splashTaglineBottom }]}>
        {SPLASH_TEXT.tagline}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.bg, zIndex: 1000, elevation: 1000 },
  center: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  tagline: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: colors.white,
    fontFamily: fonts.bodyLightItalic,
    fontSize: 16,
    lineHeight: 22,
  },
});
