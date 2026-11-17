// Estrutura comum de Entrar / Criar conta / Recuperar (Figma 564:6896, 564:6926, 564:6956):
// Header com voltar, campos a 32px do header, rodapé (botão + links) encostado em baixo, acima do teclado.
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { Body } from '@/theme/typography';
import { colors, layout, spacing, type } from '@/theme/tokens';

export function AuthScaffold({
  title,
  children,
  footer,
  contentTop = layout.authContentTop,
  bottom = layout.authBottom,
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
  contentTop?: number;
  bottom?: number;
}) {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/welcome'));
  return (
    <Screen padded="none">
      <Header title={title} onBack={back} />
      {/* O teclado nunca tapa o botão: o rodapé sobe com ele nas duas plataformas (react-native-keyboard-controller:
          o SDK 58 é edge-to-edge e a janela Android já não encolhe com o teclado). */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: spacing.authX,
            paddingTop: contentTop,
            paddingBottom: bottom,
          }}
        >
          <View style={{ gap: layout.authFieldsGap }}>{children}</View>
          <View className="flex-1" style={{ minHeight: layout.authFieldsGap }} />
          <View style={{ gap: layout.authButtonGap }}>{footer}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** Linha "texto a 50% + ação a verde" (Figma 564:6900 / 564:6903). */
export function AuthLinkRow({ text, action, onPress }: { text: string; action: string; onPress: () => void }) {
  return (
    <View className="flex-row items-center justify-center" style={{ gap: layout.authLinkGap }}>
      <Text style={[type.authLink, { opacity: layout.authMutedOpacity }]}>{text}</Text>
      <Pressable accessibilityRole="link" accessibilityLabel={action} onPress={onPress} hitSlop={12}>
        <Text style={type.authLinkAction}>{action}</Text>
      </Pressable>
    </View>
  );
}

/** Mensagem do formulário: erro (vermelho, alerta) ou informação neutra. SEM FIGMA (estado não desenhado). */
export function FormMessage({ text, tone = 'error' }: { text: string; tone?: 'error' | 'info' }) {
  return (
    <Body
      variant="body"
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      style={[{ textAlign: 'center' }, tone === 'error' ? { color: colors.cardRed } : null]}
    >
      {text}
    </Body>
  );
}
