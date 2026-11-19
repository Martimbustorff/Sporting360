// Figma V7.1: ficheiro R3IhhyNxNZuVINgUtJjZE3, nó 4941:7496 (18 Ligar Apple). Só iOS, aberto das Definições: texto Body Light,
// botão oficial da Apple (WHITE, CONTINUE) e, depois de ligada, o botão desaparece e entra a caixa "Conta Apple ligada.".
// A ligação faz-se só aqui; refreshProviders (Task 27) relê os providers para a linha das Definições desaparecer logo.
import { useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AppleAuthenticationButton,
  AppleAuthenticationButtonStyle,
  AppleAuthenticationButtonType,
} from 'expo-apple-authentication';
import { FormMessage, NoticeBox } from '@/components/AuthForm';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useRefreshProviders } from '@/providers/SessionProvider';
import { APPLE_IN_USE_MESSAGE, linkAppleToCurrentUser } from '@/services/social';
import { Text71 } from '@/theme/typography';
import { layout, space } from '@/theme/tokens';

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
      <View style={{ paddingHorizontal: space.s24, paddingTop: layout.authIntroTop, gap: layout.authStackGap }}>
        <Text71 variant="bodyLight14" color="textMuted">
          Liga a Apple à tua conta S360 para também poderes entrar com a Apple.
        </Text71>
        {linked ? null : Platform.OS === 'ios' ? (
          <AppleAuthenticationButton
            testID="apple-link"
            buttonType={AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={layout.buttonHeight / 2}
            style={{ height: layout.buttonHeight }}
            onPress={() => void link()}
          />
        ) : (
          <FormMessage text="Disponível no iPhone." tone="info" />
        )}
        {message ? (
          message.tone === 'info' && linked ? (
            <NoticeBox text={message.text} check />
          ) : (
            <FormMessage text={message.text} tone={message.tone} />
          )
        ) : null}
      </View>
    </Screen>
  );
}
