// SEM FIGMA: o ecrã de atualização obrigatória não existe no Figma. Feito com tokens e componentes existentes:
// logótipo centrado como o splash (mesmo asset), texto e botão ("Atualizar", PrimaryButton).
import { Image } from 'expo-image';
import * as Application from 'expo-application';
import * as SplashScreen from 'expo-splash-screen';
import { type ReactNode, useEffect } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAppConfig } from '@/data/hooks';
import { isVersionBelow, resolveStoreUrl } from '@/lib/version';
import { colors, spacing, type } from '@/theme/tokens';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require('../../assets/images/splash-logo.png');

/**
 * Por fora de todas as outras guardas. Em `loading`, `missing` ou `error` mostra os filhos (falha aberta).
 * Ao bloquear, os filhos (e por isso o RootStack, que é quem esconde o splash) não montam:
 * é aqui que se chama `hideAsync`, só depois de as fontes estarem prontas.
 */
export function UpdateGate({ children, fontsReady = true }: { children: ReactNode; fontsReady?: boolean }) {
  const config = useAppConfig();
  const os = Platform.OS === 'android' ? 'android' : 'ios';
  const blocked =
    config.status === 'ready' && isVersionBelow(Application.nativeApplicationVersion as string, config.data.minVersion[os]);

  useEffect(() => {
    if (blocked && fontsReady) SplashScreen.hideAsync().catch(() => {});
  }, [blocked, fontsReady]);

  if (!blocked) return <>{children}</>;
  if (!fontsReady) return null;

  const url = resolveStoreUrl(os, config.status === 'ready' ? config.data.storeUrls : undefined);
  const open = () => {
    try {
      Promise.resolve(Linking.openURL(url)).catch(() => {});
    } catch {
      // sem loja disponível: o botão não faz nada, a app não falha
    }
  };

  return (
    <View testID="update-screen" accessibilityViewIsModal style={[StyleSheet.absoluteFill, styles.root]}>
      <Image source={LOGO} accessible={false} contentFit="contain" style={styles.logo} />
      <Text style={[type.screenTitle, styles.center]} accessibilityRole="header">
        Atualização necessária
      </Text>
      <Text style={[type.authIntro, styles.center]}>Há uma nova versão da S360. Atualiza para continuar.</Text>
      <View style={styles.button}>
        <PrimaryButton label="Atualizar" onPress={open} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.authX, gap: spacing.authX },
  logo: { width: 240, height: 120 },
  center: { textAlign: 'center' },
  button: { alignSelf: 'stretch' },
});
