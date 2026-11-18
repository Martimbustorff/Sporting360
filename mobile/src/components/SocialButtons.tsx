// Task 14: "Continuar com o Google" e (só iOS) "Continuar com a Apple" + nota sobre o email oculto da Apple.
// SEM FIGMA: o Figma não tem botões sociais. Apple: botão oficial (AppleAuthenticationButton, branco sobre o fundo
// escuro). Google: regras de marca do Google (tema escuro, logótipo "G" oficial; cores em theme/brand.ts).
// Mesma altura e raio dos botões S360. Sucesso: a sessão passa a signedIn e a guarda de (auth) leva para a app.
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import {
  AppleAuthenticationButton,
  AppleAuthenticationButtonStyle,
  AppleAuthenticationButtonType,
} from 'expo-apple-authentication';
import { FormMessage } from '@/components/AuthForm';
import { NEEDS_EXISTING_LOGIN_MESSAGE, signInWithApple, signInWithGoogle, type SocialResult } from '@/services/social';
import { googleBrand } from '@/theme/brand';
import { layout, radius, type } from '@/theme/tokens';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const GOOGLE_G = require('../../assets/images/google-g.svg');

type Message = { text: string; tone: 'error' | 'info' };

export function SocialButtons() {
  const [message, setMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);
  // Guarda síncrona contra toques duplos (o estado só muda no próximo render).
  const busy = useRef(false);

  const run = async (which: 'google' | 'apple', fn: () => Promise<SocialResult>) => {
    if (busy.current) return;
    busy.current = true;
    setMessage(null);
    setLoading(which);
    try {
      const r = await fn();
      if (r.status === 'needsExistingLogin') setMessage({ text: r.message, tone: 'info' });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : String(e), tone: 'error' });
    } finally {
      busy.current = false;
      setLoading(null);
    }
  };

  const ios = Platform.OS === 'ios';
  return (
    <View style={{ gap: layout.authButtonGap }}>
      {message ? <FormMessage text={message.text} tone={message.tone} /> : null}
      <GoogleButton loading={loading === 'google'} onPress={() => void run('google', signInWithGoogle)} />
      {ios ? (
        <>
          <AppleAuthenticationButton
            testID="apple-sign-in"
            buttonType={AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={radius.button}
            style={{ height: layout.buttonHeight, opacity: loading === 'apple' ? layout.disabledOpacity : 1 }}
            onPress={() => void run('apple', signInWithApple)}
          />
          {/* Spec §9: quem escolhe "ocultar o meu email" e já tem conta deve entrar com o método habitual. */}
          <Text style={[type.authNote, { opacity: layout.authMutedOpacity }]}>{NEEDS_EXISTING_LOGIN_MESSAGE}</Text>
        </>
      ) : null}
    </View>
  );
}

function GoogleButton({ loading, onPress }: { loading: boolean; onPress: () => void }) {
  const label = 'Continuar com o Google';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: loading, busy: loading }}
      disabled={loading}
      onPress={onPress}
      className="flex-row items-center justify-center"
      style={({ pressed }) => ({
        height: layout.buttonHeight,
        borderRadius: radius.button,
        borderWidth: layout.fieldLineWidth,
        borderColor: googleBrand.stroke,
        backgroundColor: googleBrand.fill,
        gap: googleBrand.logoGap,
        opacity: pressed ? layout.pressedOpacity : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={googleBrand.text} />
      ) : (
        <>
          <Image
            source={GOOGLE_G}
            accessible={false}
            style={{ width: googleBrand.logoSize, height: googleBrand.logoSize }}
          />
          <Text style={{ color: googleBrand.text, fontSize: googleBrand.fontSize, fontWeight: googleBrand.fontWeight }}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
