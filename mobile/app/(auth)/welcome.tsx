// Figma: ficheiro R3IhhyNxNZuVINgUtJjZE3, nó 564:7178 (Welcome screen); botões 564:7259 ("Entrar") e 564:7261 ("Criar uma conta").
// Anéis (564:7180): um só SVG (welcome-rings.svg) com as 72 elipses iguais do Figma (330x627, traço 0,27) rodadas em
// passos de 2,5 graus à volta do mesmo centro; gerado a partir do asset da elipse 564:7181, desenhado numa só view.
// Fundo: no Figma é preto com um verde a 50% por cima (564:7179), que dá o mesmo verde do token bg.
// R17: com `aviso=conta-apagada` mostra "Conta apagada." (SEM FIGMA: estado não desenhado).
// Task 14 (SEM FIGMA): botões Google e, só em iOS, Apple, por baixo de "Criar uma conta".
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FormMessage } from '@/components/AuthForm';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SocialButtons } from '@/components/SocialButtons';
import { clearSignOutNotice } from '@/lib/signOutNotice';
import { colors, layout, spacing, type } from '@/theme/tokens';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const RINGS = require('../../assets/images/welcome-rings.svg');

export default function Welcome() {
  const router = useRouter();
  const { aviso } = useLocalSearchParams<{ aviso?: string }>();
  const { bottom } = useSafeAreaInsets();
  // Figma: 50px do fundo = 34 da barra home + 16.
  const paddingBottom = Math.max(bottom, layout.homeIndicator) + layout.welcomeBottom;
  // O aviso pendente (guarda de (app)) já chegou no parâmetro: não se repete no próximo signOut.
  useEffect(() => clearSignOutNotice(), []);

  return (
    <View className="flex-1 overflow-hidden bg-s360-bg">
      {/* Anéis e logótipo partilham o centro, 49,5px acima do centro do ecrã. */}
      <View
        style={[StyleSheet.absoluteFill, { paddingBottom: layout.welcomeRingsLift }]}
        className="items-center justify-center"
      >
        <Image
          testID="welcome-rings"
          source={RINGS}
          accessible={false}
          style={{ width: layout.welcomeRings.width, height: layout.welcomeRings.height, pointerEvents: 'none' }}
        />
      </View>
      <View
        style={[StyleSheet.absoluteFill, { paddingBottom: layout.welcomeRingsLift, gap: layout.welcomeLogoGap }]}
        className="items-center justify-center"
      >
        <Text style={type.welcomeLogo} accessibilityRole="header" accessibilityLabel="S360">
          <Text style={{ color: colors.primary }}>S</Text>360
        </Text>
        <Text style={[type.welcomeTagline, { width: layout.welcomeTaglineWidth }]}>
          {'A tua ligação ao universo\n'}
          <Text style={{ color: colors.primary }}>Verde</Text>
          {' & Branco'}
        </Text>
      </View>
      <View
        className="absolute inset-x-0 bottom-0"
        style={{ paddingHorizontal: spacing.authX, paddingBottom, gap: layout.welcomeButtonsGap }}
      >
        {aviso === 'conta-apagada' ? <FormMessage text="Conta apagada." tone="info" /> : null}
        <PrimaryButton label="Entrar" onPress={() => router.push('/entrar')} />
        <PrimaryButton label="Criar uma conta" onPress={() => router.push('/criar-conta')} />
        <SocialButtons />
      </View>
    </View>
  );
}
