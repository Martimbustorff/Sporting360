// Figma V7.1: Botão social 4939:7208. Google: pílula branca 52, logótipo "G" 20, "Continuar com o Google" Medium 15 preto.
// Apple (só iOS): botão oficial (AppleAuthenticationButton CONTINUE, WHITE) com a mesma altura e raio, mais a nota do email oculto.
// Sucesso: a sessão passa a signedIn e a guarda de (auth) leva para a app.
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Image } from 'expo-image';
import {
  AppleAuthenticationButton,
  AppleAuthenticationButtonStyle,
  AppleAuthenticationButtonType,
} from 'expo-apple-authentication';
import { FormMessage } from '@/components/AuthForm';
import { Touchable } from '@/components/Touchable';
import { NEEDS_EXISTING_LOGIN_MESSAGE, signInWithApple, signInWithGoogle, type SocialResult } from '@/services/social';
import { Text71 } from '@/theme/typography';
import { colors, layout } from '@/theme/tokens';

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
            cornerRadius={layout.buttonHeight / 2}
            style={{ height: layout.buttonHeight, opacity: loading === 'apple' ? layout.disabledOpacity : 1 }}
            onPress={() => void run('apple', signInWithApple)}
          />
          {/* Spec §9: quem escolhe "ocultar o meu email" e já tem conta deve entrar com o método habitual. */}
          <Text71 variant="caption12" color="textSubtle" style={{ textAlign: 'center' }}>
            {NEEDS_EXISTING_LOGIN_MESSAGE}
          </Text71>
        </>
      ) : null}
    </View>
  );
}

function GoogleButton({ loading, onPress }: { loading: boolean; onPress: () => void }) {
  const label = 'Continuar com o Google';
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: loading, busy: loading }}
      disabled={loading}
      onPress={onPress}
      style={{
        height: layout.buttonHeight,
        borderRadius: layout.buttonHeight / 2,
        backgroundColor: colors.white,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: layout.socialGap,
      }}
    >
      {loading ? (
        <ActivityIndicator color={colors.black} />
      ) : (
        <>
          <Image
            source={GOOGLE_G}
            accessible={false}
            style={{ width: layout.socialLogo, height: layout.socialLogo }}
          />
          <Text71 variant="strong14" color="black" numberOfLines={1} style={{ fontSize: layout.socialLabel }}>
            {label}
          </Text71>
        </>
      )}
    </Touchable>
  );
}
