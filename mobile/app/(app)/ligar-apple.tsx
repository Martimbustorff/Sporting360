// Task 14: ecrã mínimo para ligar a Apple à conta com sessão aberta. As Definições (Plano 4, Task 26) trazem cá o
// utilizador: a ligação faz-se só aqui, com o botão oficial da Apple (HIG). Depois de ligada, o botão desaparece e a
// sessão relê os providers (refreshProviders, Task 27), para a linha das Definições desaparecer logo.
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
import { useRefreshProviders } from '@/providers/SessionProvider';
import { APPLE_IN_USE_MESSAGE, linkAppleToCurrentUser } from '@/services/social';
import { layout, radius, spacing } from '@/theme/tokens';

export const LIGAR_APPLE_TEXT = { linked: 'Conta Apple ligada.' } as const;

type Message = { text: string; tone: 'error' | 'info' };

export default function LigarApple() {
  const router = useRouter();
  const refreshProviders = useRefreshProviders();
  const [message, setMessage] = useState<Message | null>(null);
  const [linked, setLinked] = useState(false);
  const busy = useRef(false);

  const link = async () => {
    if (busy.current) return;
    busy.current = true;
    setMessage(null);
    try {
      const r = await linkAppleToCurrentUser();
      if (r === 'linked') {
        setLinked(true);
        setMessage({ text: LIGAR_APPLE_TEXT.linked, tone: 'info' });
        // A ligação já está feita: uma falha a reler (ex.: sem rede) não é erro; o próximo arranque corrige.
        refreshProviders().catch(() => {});
      } else if (r === 'inUse') setMessage({ text: APPLE_IN_USE_MESSAGE, tone: 'error' });
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
        {linked ? null : Platform.OS === 'ios' ? (
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
