// Figma V7.1: ficheiro R3IhhyNxNZuVINgUtJjZE3, nó 4940:7186 (13 Welcome). 20/11 (Martim, design do João 564:7178): os
// anéis (welcome-rings.svg) a 100 %, a 709/375 da largura do ecrã, centrados no grupo S360 + frase, que fica dentro do
// círculo; "S360" DIN Condensed 155 com o "S" primary; frase Title L 28 com "VERDE" primary-on-dark; Entrar (branco),
// Criar uma conta (contorno) e os botões sociais a 12, a 8 pt do indicador. O grupo centra-se no espaço acima dos botões
// (os anéis passam por trás dos botões, como no design do João), para não sobrepor os botões em ecrãs baixos.
// R17: com `aviso=conta-apagada` mostra "Conta apagada." (SEM FIGMA: estado não desenhado).
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FormMessage } from '@/components/AuthForm';
import { BrandRings } from '@/components/BrandRings';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SocialButtons } from '@/components/SocialButtons';
import { clearSignOutNotice } from '@/lib/signOutNotice';
import { Text71 } from '@/theme/typography';
import { colors, layout, space, type } from '@/theme/tokens';


export default function Welcome() {
  const router = useRouter();
  const { aviso } = useLocalSearchParams<{ aviso?: string }>();
  const { bottom } = useSafeAreaInsets();
  const paddingBottom = Math.max(bottom, layout.homeIndicator) + layout.welcomeActionsBottom;
  // O aviso pendente (guarda de (app)) já chegou no parâmetro: não se repete no próximo signOut.
  useEffect(() => clearSignOutNotice(), []);

  return (
    <View className="flex-1 overflow-hidden bg-s360-bg">
      <View style={{ flex: 1 }}>
        {/* 20/11 (design do João): anéis a 100 %, centrados no logótipo, que fica dentro do círculo. */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <BrandRings testID="welcome-rings" />
          <Text style={type.welcomeLogo} accessibilityRole="header" accessibilityLabel="S360">
            <Text style={{ color: colors.primary }}>S</Text>360
          </Text>
          <Text71 variant="titleL28" style={{ textAlign: 'center', marginTop: layout.welcomeLogoGap }}>
            {'A tua ligação ao universo\n'}
            <Text71 variant="titleL28" color="primaryOnDark">
              Verde
            </Text71>
            {' & Branco'}
          </Text71>
        </View>
        <View style={{ paddingHorizontal: space.s24, paddingBottom, gap: layout.authButtonGap }}>
          {aviso === 'conta-apagada' ? <FormMessage text="Conta apagada." tone="info" /> : null}
          <PrimaryButton label="Entrar" variant="white" onPress={() => router.push('/entrar')} />
          <PrimaryButton label="Criar uma conta" variant="outline" onPress={() => router.push('/criar-conta')} />
          <SocialButtons />
        </View>
      </View>
    </View>
  );
}
