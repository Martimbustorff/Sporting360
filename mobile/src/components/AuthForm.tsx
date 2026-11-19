// Estrutura comum de Entrar / Criar conta / Recuperar e dos ecrãs de conta (Figma V7.1 14, 15, 16, 21, 23, 24):
// Header com voltar, campos a 36 do Header, rodapé (botões e ligações a 12) encostado em baixo, acima do teclado.
import type { ReactNode } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { ScrollView, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { Touchable } from '@/components/Touchable';
import { Text71 } from '@/theme/typography';
import { colors, layout, radii, space, text71 } from '@/theme/tokens';

export function AuthScaffold({
  title,
  children,
  footer,
  contentTop = layout.authContentTop,
  bottom = layout.authBottom,
  fieldsGap = layout.authFieldsGap,
  fallbackHref = '/welcome',
  footerInline = false,
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
  contentTop?: number;
  bottom?: number;
  /** Espaço entre os blocos de cima (campos e textos); 32 por omissão. */
  fieldsGap?: number;
  /** Para onde "Voltar" leva quando não há histórico (ecrãs de (app) usam '/'). */
  fallbackHref?: '/welcome' | '/';
  /** O rodapé segue logo os campos (com `fieldsGap`) em vez de ficar encostado em baixo (24 Nome público, 4942:7882). */
  footerInline?: boolean;
}) {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace(fallbackHref));
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
            paddingHorizontal: space.s24,
            paddingTop: contentTop,
            paddingBottom: bottom,
          }}
        >
          <View style={{ gap: fieldsGap }}>
            {children}
            {footerInline ? <View style={{ gap: layout.authButtonGap }}>{footer}</View> : null}
          </View>
          {footerInline ? null : (
            <>
              <View className="flex-1" style={{ minHeight: layout.authFieldsGap }} />
              <View style={{ gap: layout.authButtonGap }}>{footer}</View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** Excesso do alvo de 44 pt sobre a linha de texto, por cada lado: devolve-se com margem negativa (o frame tem as linhas a `authLinksRowGap`). */
const LINK_ROW_OVERHANG = (layout.minTouch - text71.captionStrong12.lineHeight) / 2;

/** Linha "texto Caption 12 text-muted + ação Caption Strong primary-on-dark" (Figma 4940:7374). */
export function AuthLinkRow({ text, action, onPress }: { text: string; action: string; onPress: () => void }) {
  return (
    <View testID="auth-link-row" className="flex-row items-center justify-center" style={{ gap: layout.authLinkGap, marginVertical: -LINK_ROW_OVERHANG }}>
      <Text71 variant="caption12" color="textMuted">
        {text}
      </Text71>
      <Touchable
        accessibilityRole="link"
        accessibilityLabel={action}
        onPress={onPress}
        style={{ minHeight: layout.minTouch, justifyContent: 'center' }}
      >
        <Text71 variant="captionStrong12" color="primaryOnDark">
          {action}
        </Text71>
      </Touchable>
    </View>
  );
}

/** Mensagem do formulário: erro (vermelho, alerta) ou informação neutra. SEM FIGMA (estado não desenhado). */
export function FormMessage({ text, tone = 'error' }: { text: string; tone?: 'error' | 'info' }) {
  return (
    <Text71
      variant="body14"
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      color={tone === 'error' ? 'danger' : 'white'}
      style={{ textAlign: 'center' }}
    >
      {text}
    </Text71>
  );
}

/** Mensagem em caixa (Figma 4941:7389 "Mensagem enviada", 4941:7496 "Depois de ligar"): surface-06, raio 12, padding 12 / 14. */
export function NoticeBox({ text, check = false }: { text: string; check?: boolean }) {
  return (
    <View
      testID="notice-box"
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: check ? layout.noticeGap : space.s12,
        backgroundColor: colors.surface06,
        borderRadius: radii.r12,
        paddingVertical: space.s12,
        paddingHorizontal: layout.noticePadX,
      }}
    >
      {check ? (
        <Feather
          name="check"
          size={layout.noticeIcon}
          color={colors.primaryOnDark}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      ) : null}
      <Text71 variant={check ? 'body14' : 'caption12'} style={{ flex: 1 }}>
        {text}
      </Text71>
    </View>
  );
}
