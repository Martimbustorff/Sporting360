// Task 14: ecrã mínimo para ligar a Apple à conta com sessão aberta (as Definições do Plano 4 trazem cá o utilizador).
// SEM FIGMA: não desenhado; compõe Header, botão oficial da Apple e FormMessage.
import { useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AppleAuthenticationButton,
  AppleAuthenticationButtonStyle,
  AppleAuthenticationButtonType,
} from 'expo-apple-authentication';
import { FormMessage } from '@/components/AuthForm';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { APPLE_IN_USE_MESSAGE, linkAppleToCurrentUser } from '@/services/social';
import { layout, radius, spacing } from '@/theme/tokens';

type Message = { text: string; tone: 'error' | 'info' };

export default function LigarApple() {
  const router = useRouter();
  const [message, setMessage] = useState<Message | null>(null);
  const busy = useRef(false);

  const link = async () => {
    if (busy.current) return;
    busy.current = true;
    setMessage(null);
    try {
      const r = await linkAppleToCurrentUser();
      if (r === 'linked') setMessage({ text: 'Apple ligada.', tone: 'info' });
      else if (r === 'inUse') setMessage({ text: APPLE_IN_USE_MESSAGE, tone: 'error' });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : String(e), tone: 'error' });
    } finally {
      busy.current = false;
    }
  };

  return (
    <Screen padded="none">
      <Header title="Ligar Apple" onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <View style={{ paddingHorizontal: spacing.authX, paddingTop: layout.authContentTop, gap: layout.authButtonGap }}>
        {message ? <FormMessage text={message.text} tone={message.tone} /> : null}
        {Platform.OS === 'ios' ? (
          <AppleAuthenticationButton
            testID="apple-link"
            buttonType={AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={radius.button}
            style={{ height: layout.buttonHeight }}
            onPress={() => void link()}
          />
        ) : (
          <FormMessage text="Disponível no iPhone." tone="info" />
        )}
      </View>
    </Screen>
  );
}
